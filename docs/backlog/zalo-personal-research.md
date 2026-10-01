# Khảo sát — Tích hợp Zalo Cá nhân (Personal Account) thay thế Zalo OA

> **Trạng thái:** Báo cáo khảo sát (2026-10-01) — CHƯA phê duyệt implement.
> **Bối cảnh:** TASK-3C-02 (Zalo OA) đã code xong, đang chờ OA thật để smoke (blocker: user cá nhân không có pháp nhân để xác thực OA). User muốn dùng **tài khoản Zalo cá nhân** thay thế.
> **Tham chiếu kiến trúc:** `docs/backlog/phase-3c-zalo-oa-implementation-plan.md` (mô hình Channel Adapter hiện có).

---

## 1. Kết luận nhanh (TL;DR)

- **Khả thi về kỹ thuật**: thư viện cộng đồng **[zca-js](https://github.com/RFS-ADRENO/zca-js)** (MIT, ~650★, đang phát triển tích cực) mô phỏng Zalo Web bằng Node — QR login, nghe tin nhắn realtime (WebSocket), gửi tin văn bản/ảnh/sticker, tra user info. Đủ mọi thứ cần cho một kênh chat.
- **Rủi ro cốt lõi KHÔNG phải kỹ thuật**: Zalo **không cấp API chính thức cho tài khoản cá nhân** — mọi thư viện đều vi phạm ToS và cảnh báo rõ *"có thể bị khóa/banned vĩnh viễn"* (zca-js, zca-bridge, zlapi, @nguyennhuy/zalo-api... đều ghi nhận). **Bắt buộc dùng tài khoản phụ, không dùng tài khoản kinh doanh/chính.**
- **Khác biệt kiến trúc lớn nhất so với OA**: Zalo cá nhân **không có webhook** — inbound là **persistent WebSocket listener chạy trong server**; outbound là REST mô phỏng. Session lưu dạng `{imei, cookie, userAgent}`, quét QR **một lần duy nhất** rồi `zalo.login(cred)` tái sử dụng.
- **Khuyến nghị**: làm được, nhưng xây như một **kênh song song** (`ZALO_PERSONAL` — dùng thử/dev), KHÔNG thay thế `ZALO` OA. OA vẫn là đường chính thức duy nhất cho production SaaS.

## 2. Thư viện zca-js — năng lực thực tế

| Năng lực | API | Ghi chú |
|---|---|---|
| Đăng nhập QR | `zalo.loginQR({userAgent, language, qrPath}, callback)` | callback event `GotLoginInfo` trả **credentials `{imei, cookie[], userAgent}`** — lưu lại để tái sử dụng |
| Đăng nhập lại KHÔNG cần QR | `zalo.login(credentials)` | chạy khi server restart — người dùng chỉ quét QR **một lần duy nhất** |
| Nghe tin nhắn | `api.listener.on("message"|"typing"|"reaction"|"undo"|"delivered_messages"|"seen_messages"|"friend_event"|"connected"|"disconnected"|"error", ...)` + `api.listener.start()` | WebSocket; `message.isSelf`, `ThreadType.User`/`Group`; có sẵn delivered/seen receipts |
| Gửi tin | `api.sendMessage({msg, quote?/styles?/mentions?}, threadId, threadType)`; sticker: `getStickers` + `sendMessageSticker`; ảnh/file: `api.uploadAttachment(path, threadId, threadType)` | v2 đã bỏ phụ thuộc `sharp` (gửi ảnh cần tự cung cấp `imageMetadataGetter`) |
| User info | `api.getUserInfo([ids], AvatarSize)`, `api.getMultiUsersByPhones`, `api.getAllFriends`, `api.lastOnline` | đồng bộ Contact: display_name + avatar |
| Option | `new Zalo({selfListen: true/false})` | `selfListen` mặc định false (bỏ tin của chính mình) |

**Giới hạn đã ghi nhận:**
- **Chỉ 1 web listener mỗi tài khoản** — mở Zalo Web (chat.zalo.me) trên browser cùng lúc sẽ踢 listener của server (`DuplicateConnection`/`KickConnection`). App Zalo trên điện thoại thì không ảnh hưởng.
- **1 instance server mỗi tài khoản** — chạy 2 process cùng account gây reconnect loop (kinh nghiệm từ [zalo-agent-cli](https://github.com/PhucMPham/zalo-agent-cli)).
- API nội bộ Zalo có thể đổi bất kỳ lúc nào mà không báo trước → thư viện có thể vỡ sau một đợt Zalo update.

## 3. Hệ sinh thái tham chiếu

| Dự án | Bài học rút ra |
|---|---|
| [zca-bridge](https://github.com/diendh/zca-bridge) (Chatwoot sidecar, Apache-2.0) | Kiến trúc chuẩn cho sản phẩm thật: **session supervisor** với reconnect exponential backoff (5s→15s→45s→2m→cap 5m); **chỉ khi lỗi rõ ràng hết phiên** mới yêu cầu quét QR lại; durable queue đệm giữa Zalo bất định và hệ thống; per-account egress proxy để tách IP |
| [OpenClaw zalouser plugin](https://docs.openclaw.ai/vi/channels/zalouser) | Session persist ra file JSON (`zalo-session.json`) — chỉ quét QR lần đầu |
| [n8n Zalo nodes](https://github.com/bautran1911/n8n-nodes-zalo-oa) | Mẫu QR login + auto token management |
| zlapi (Python), zca-cli, openzca | Cộng đồng lớn, pattern giống nhau — xác nhận hướng đi phổ biến |

## 4. Thiết kế tích hợp vào Sales Copilot (nếu triển khai)

### 4.1. Mô hình dữ liệu & contracts
- Thêm `ChannelType.ZALO_PERSONAL` vào Prisma enum + `packages/shared-contracts` (migration).
- Credentials (mã hóa AES-256-GCM như hiện tại): `{imei, cookie, userAgent, ownUserId}` — **không có token để refresh**, chỉ có session cookie có thể hết hạn.
- `settings`: `{zaloName, avatar, lastConnectedAt, lastSyncError}`.

### 4.2. Server — tái dùng tối đa pipeline hiện có
```
[zca-js listener] --(envelope)--> WebhooksService.handleInboundWebhook(channelId, envelope,
                                        {skipSignatureVerification: true})
                                        → ChannelEvent (dedupe) → BullMQ → IngestionProcessor
                                        → ZaloPersonalAdapter.parseInboundPayload
                                        → Contact/Conversation/Message (giữ nguyên)
Outbound: message.created → OutboundMessageListener → ZaloPersonalAdapter.sendMessage → api.sendMessage
```
- **`ZaloPersonalConnectionService`** (mới, hạt nhân): map `channelId → {zalo instance, api, reconnect state}`; `OnApplicationBootstrap` đăng nhập lại từ credentials cho mọi channel connected; supervisor bắt `disconnected` → backoff reconnect → nếu lỗi hết phiên → `isConnected:false` + `reauthorizationRequired` (pattern có sẵn).
- **`ZaloPersonalAdapter`** implements `ChannelAdapter`: `parseInboundPayload` map message zca-js → `InboundMessagePayload` (text/sticker/attachment, `externalMessageId = message.data.msgId`); `sendMessage` (text → `sendMessage`; ảnh → `uploadAttachment`); `fetchSenderInfo` → `getUserInfo`; `getChannelInfo` → profile tài khoản own. `verifyWebhook` không cần (không có webhook) — nops.
- Inbound envelope gọi thẳng `handleInboundWebhook` với `skipSignatureVerification` (pattern Facebook central webhook đã có) → được luôn dedupe + queue + AI Copilot miễn phí.
- **Ràng buộc scale**: listener 1 process/tài khoản — khi deploy nhiều replica sẽ cần leader election/Redis lock (ghi nhận, chưa làm — hiện chỉ 1 instance server).

### 4.3. Web — luồng connect quét QR
- `new/channels/zalo-personal/zalo-personal-flow.tsx`: server sinh QR (`loginQR` với callback event) → UI poll/SSE lấy ảnh QR hiện ra → user quét bằng app Zalo → server nhận `GotLoginInfo` → lưu credentials mã hóa → tạo Inbox+Channel (1 transaction) → mở listener.
- Config page: trạng thái kết nối, hướng dẫn "đừng mở Zalo Web cùng tài khoản", nút **Kết nối lại (quét QR mới)** khi session chết, xóa kênh.
- Không cần env gì (không app_id/secret).

### 4.4. Phạm vi MVP đề xuất
1. QR connect + persist session + reconnect supervisor.
2. Inbound text + contact sync (name/avatar) + dedupe.
3. Outbound text (kèm quote-reply nếu đơn giản).
4. Delivery/seen receipts từ listener events.
5. *Sau MVP:* ảnh/file, sticker, nhóm (`ThreadType.Group` — cân nhắc có nên nhận không), typing/reactions.

**Ước lượng**: server ~1.2–1.5k LOC (gồm tests, mock zca-js cho unit test), web ~400 LOC, migration enum.

## 5. Rủi ro & đánh giá thẳng thắn

| Rủi ro | Mức độ | Đối sách |
|---|---|---|
| **Vi phạm ToS Zalo → khóa tài khoản** | **Cao — đã ghi nhận ở mọi thư viện cùng hệ sinh thái** | Dùng **tài khoản phụ** riêng cho bot; tuyệt đối không dùng tài khoản chính/kinh doanh; ghi rõ trong UI "kênh không chính thức"; chấp nhận rủi ro tài khoản chết bất cứ lúc nào |
| API nội bộ Zalo đổi → thư viện vỡ | Trung bình | Pin version `zca-js`; theo dõi repo; adapter tách biệt để sửa nhanh; pipeline có queue nên outage không mất tin (listener chết = không nhận tin mới) |
| Chỉ 1 web session/tài khoản | Trung bình | Hướng dẫn user không mở Zalo Web cùng tài khoản; supervisor auto-reconnect khi bị kick |
| Giới hạn nhắn người lạ / anti-spam | Trung bình | Ổn cho use-case phản hồi khách chủ động nhắn trước; KHÔNG dùng để broadcast |
| Nhiều replica server | Thấp (hiện tại) | Ghi nhận ràng buộc 1 listener/account; khi scale mới xử lý |
| Pháp lý / dữ liệu cá nhân | Trung bình | Tin nhắn cá nhân chứa PII nhạy cảm hơn OA — cân nhắc Luật Bảo vệ dữ liệu cá nhân 2026 khi lưu |

## 6. Khuyến nghị quyết định

1. **Nếu mục đích là dev/demo/test** (như hiện tại — bị chặn bởi OA xác thực): **NÊN làm** — chi phí thấp, nhận được đầy đủ tin nhắn thật vào hệ thống, dùng tài khoản phụ.
2. **Nếu mục đích là production cho khách SaaS**: cân nhắc kỹ — đây là nền gạch không chính thức, rủi ro ban tài khoản nằm ở phía KHÁCH HÀNG (tài khoản shop của họ). Khuyến nghị: vẫn giữ `ZALO` OA làm kênh chính thức khi khách có pháp nhân; `ZALO_PERSONAL` bán kèm với **cảnh báo rõ ràng**.
3. Hai kênh **song song, không thay thế nhau**: `ZALO` (OA, chính thức) + `ZALO_PERSONAL` (không chính thức) — cùng pipeline, khác adapter + connect flow.

> **Cần quyết định trước khi implement**: (a) có làm không, (b) có nhận nhóm (ThreadType.Group) không hay chỉ nhắn 1-1, (c) MVP có cần gửi ảnh/sticker ngay không.
