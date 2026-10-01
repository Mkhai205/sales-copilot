# Implementation Plan — TASK-3C-02: Tích hợp kênh Zalo Official Account (Zalo OA)

> **Trạng thái:** Đã phê duyệt (2026-10-01)
> **Phạm vi:** Zalo OA qua OpenAPI v3 + OAuth v4 (OA). KHÔNG làm Zalo Mini App, Zalo Shop, ZNS/Transaction message (backlog cấm / out-of-scope).
> **Tham chiếu:** [Xác thực và ủy quyền cho ứng dụng (OAuth v4 + API Explorer)](https://developers.zalo.me/docs/official-account/bat-dau/xac-thuc-va-uy-quyen-cho-ung-dung-new), [Zalo OA OpenAPI v3.0](https://developers.zalo.me/docs/official-account), kiến trúc Channel Adapter hiện có (Facebook/Telegram).

---

## 1. Tổng quan kiến thức Zalo OA API (đã nghiên cứu)

### 1.1. Xác thực & Ủy quyền (OAuth v4 — docs chính thức 10/2026)

Tài liệu chính thức ghi nhận **2 cách** lấy token: giao thức **OAuth v4** (dùng trong hệ thống) và công cụ **Zalo API Explorer** (thủ công, dành cho operator test/lấy token nhanh).

- **Platform App dùng chung:** operator cấu hình `ZALO_APP_ID` / `ZALO_APP_SECRET` env một lần (mô hình giống `FB_APP_ID`/`FB_APP_SECRET`).
- **Authorize:** OA admin click link `https://oauth.zaloapp.com/v4/oa/permission?app_id&redirect_uri` (URL front-channel xác nhận qua tài liệu cộng đồng — cần verify với app thật) → đăng nhập Zalo → ủy quyền OA cho app → redirect về callback kèm `code` + `oa_id`.
- **Đổi token:** `POST https://oauth.zaloapp.com/v4/oa/access_token`, **`secret_key` truyền ở HEADER**, body form-urlencoded: `app_id`, `grant_type=authorization_code` + `code` (lần đầu) hoặc `grant_type=refresh_token` + `refresh_token` (tự động). PKCE (`code_verifier`) chỉ bắt buộc nếu authorize có `code_challenge` — hệ thống không dùng.
- **Token lifetime (theo docs):** `access_token` hạn **25 giờ** (`expires_in` ≈ 90.000s — luôn đọc giá trị từ response); `refresh_token` hạn **3 tháng**, **single-use** và xoay vòng mỗi lần refresh → bắt buộc persist cặp token mới.

### 1.2. Webhook (đăng ký thủ công trong OA Console)
- Không có API set-webhook như Telegram. Owner copy **Webhook URL** từ màn cấu hình inbox dán vào OA Console.
- **Verify URL:** Zalo gửi POST `{event_name: "oa_callback_verify", data: {verify_token}}` → server echo lại verify_token.
- **Chữ ký sự kiện:** header `X-ZEvent-Signature` ≈ `sha256(app_id + rawBody + timestamp + oa_secret_key)`, timing-safe compare, fail-closed khi thiếu secret.

### 1.3. Gửi tin CS (Customer Service)
- `POST https://openapi.zalo.me/v3.0/oa/message/cs`, header `access_token`, body `{recipient: {user_id}, message: {...}}`.
- Hỗ trợ: `text`, `attachment` (image/file), `template` qua `attachment.payload.template_type` (buttons, quick reply, media_list...).
- **CS window 7 ngày:** chỉ gửi được cho user đã tương tác với OA trong 7 ngày gần nhất.

### 1.4. API khác
- User info: `POST /v3.0/oa/user/info` `{user_id}` → `display_name`, `avatar`, `shared_info` → đồng bộ `Contact`.
- OA info: `GET /v3.0/oa` → `oa_id`, `name`, `avatar`.
- Sự kiện webhook: `user_send_text/image/file/link/sticker/voice`, `follow`/`unfollow`, `user_receive_message` (delivered), `oa_message_seen` (read), `oa_send_message` (agent trả lời từ app Zalo — chỉ log, không ingest).

## 2. Quyết định thiết kế (đã chốt với user)

| # | Quyết định | Lý do |
|---|---|---|
| 1 | **OAuth popup, platform Zalo App dùng chung** (pattern Facebook) | UX nhẹ nhất cho chủ shop; đúng intent backlog; tái dùng pattern `facebook.controller.ts` |
| 2 | Template gửi qua `OutboundMessagePayload.metadata.zaloTemplate` (adapter-level) | Composer template UI chưa tồn tại ở kênh nào; đủ acceptance criteria |
| 3 | Ingress tái dùng route generic `POST /api/v1/channels/:channelId/webhook` | Telegram/WebChat đã dùng; Zalo OA đăng ký 1 URL/OA nên không cần central webhook như Meta |
| 4 | Không dependency mới (fetch toàn bộ) | Ponytail Decision Ladder |

**Luồng kết nối (chủ shop):** Click "Kết nối Zalo" → popup OAuth ủy quyền OA → server lưu token tạm vào Redis (sessionId) → chủ shop nhập **OA Secret Key** (copy từ OA Console) → tạo Inbox+Channel → copy **Webhook URL** dán vào OA Console → Zalo handshake `oa_callback_verify` → hoàn tất. Sau đó token tự refresh + xoay vòng, hoàn toàn tự động.

## 3. Thành phần triển khai

### Server (`apps/server/src/modules/omnichannel/integrations/zalo/`)
| File | Vai trò |
|---|---|
| `zalo.constants.ts` | Endpoints, credential keys, refresh margin (24h), timestamp tolerance, error codes |
| `zalo.types.ts` | ZaloWebhookEvent, CS payload, TokenResponse, UserInfoResponse, error envelope |
| `zalo-oa-token.service.ts` | `exchangeCode`, `getValidAccessToken` (cache → refresh → **persist xoay vòng** AES-256-GCM), single-flight, re-read DB khi race, mark `reauthorizationRequired` khi refresh token chết |
| `zalo-oa.controller.ts` | `GET integrations/zalo/auth-url` (state CSRF + Redis 10'), `GET integrations/zalo/callback` (đổi token → lưu Redis session → redirect frontend), `GET integrations/zalo/session` (thông tin OA đã ủy quyền cho connect UI), `POST integrations/zalo/connect` (tạo Inbox+Channel từ sessionId + oaSecretKey, hoặc reauthorize khi session có channelId). Ngắt kết nối tái dùng generic `DELETE /inboxes/:id` |
| `zalo.adapter.ts` | `ChannelAdapter` impl: MAC verify, callback-verify echo, parse event → `InboundMessagePayload[]`, send CS (text/ảnh/template), user info sync, OA info |
| `zalo.lifecycle.ts` | `channel.created/updated` → validate token, OA-id guard (chống swap OA), ghi `providerAccountId`/`settings` + hướng dẫn webhook |
| `zalo.module.ts` | Register adapter `onModuleInit` (Telegram pattern) |

### Webhook seam (dùng chung)
- `ChannelAdapter.handleCallbackVerification?(rawBody)` — hook POST-handshake (Zalo echo token).
- `WebhooksController/Service` forward `req.rawBody` (Buffer, byte-exact MAC verify thay JSON.stringify fallback).
- `FacebookAdapter` ưu tiên Buffer rawBody khi có.

### Web UI (`apps/web/src/features/settings/inboxes/`)
- `channel-registry.ts` + `new/channels/zalo/zalo-flow.tsx` (OAuth popup + bước nhập OA Secret Key) + `zalo-schema.ts`.
- Generalize `useFacebookOauthPopup` → hook popup dùng chung (duplication thứ 2, Rule of Three).
- `detail/channels/zalo-config.tsx`: trạng thái, OA name, Webhook URL + copy, Reauthorize, đổi OA Secret Key. Xóa nhánh "coming soon" cho Zalo trong `UnsupportedChannelPlaceholder`.

## 4. Bất biến & ràng buộc
- Strict multi-tenancy: mọi query channel theo `{id, workspaceId}`; refresh token persist bằng `prisma.channel.update({where: {workspaceId_id}})`.
- Token/access token không bao giờ trả ra client; credentials chỉ tồn tại mã hóa.
- MAC verify fail-closed khi thiếu `oaSecretKey`.
- Data integrity: tạo Inbox+Channel trong 1 transaction.

## 5. Checklist smoke test thủ công (cần 1 Zalo OA thật + Zalo App)

1. [ ] Cấu hình `ZALO_APP_ID`/`ZALO_APP_SECRET` env; trên developers.zalo.me: (a) **Đăng ký sử dụng API** nhóm Official Account và **chờ Zalo xét duyệt** — chưa duyệt thì authorize trả `-14029 The application is not approved` (đã gặp thật 2026-10-01); (b) **đăng ký Redirect URI** `{WEBHOOK_BASE_URL}/api/v1/integrations/zalo/callback` (Cài đặt ứng dụng → Đăng nhập → Thêm nền tảng → Web; + Xác thực domain nếu bị yêu cầu) — thiếu thì authorize trả `-14003 Invalid redirect uri` (đã gặp thật 2026-10-01). UI zalo-flow hiển thị sẵn URI này kèm nút copy (GET /integrations/zalo/config).
2. [ ] Settings → Inboxes → New → Zalo OA → popup OAuth → ủy quyền → nhập OA Secret Key → inbox tạo thành công, OA name/avatar hiển thị đúng.
3. [ ] Copy Webhook URL → OA Console → cấu hình Webhook → handshake `oa_callback_verify` được echo, console báo thành công.
4. [ ] Nhắn tin từ user Zalo vào OA → tin xuất hiện trong Inbox (text/ảnh/sticker/file), Contact tự sync (display_name + avatar).
5. [ ] Trả lời từ Sales Copilot → user nhận được tin trên Zalo; `Message.externalId` = msg_id của Zalo.
6. [ ] AI Copilot bật autopilot cho inbox Zalo → trả lời tự động hoạt động.
7. [ ] Gửi template qua `metadata.zaloTemplate` (buttons / media_list) → hiển thị đúng trên Zalo.
8. [ ] Gửi tin cho user quá 7 ngày CS window → Message FAILED với deliveryError rõ ràng, không crash.
9. [ ] Đọc receipts: user nhận tin → DELIVERED; user xem → READ.
10. [ ] Giả lập refresh: thu hẹp `accessTokenExpiresAt` → tin nhắn tiếp theo tự refresh, credentials trong DB xoay vòng, channel vẫn `isConnected`.
11. [ ] Refresh token chết (revoke trên dev console) → channel chuyển `isConnected:false`, `reauthorizationRequired:true` → Reauthorize popup → khôi phục.
12. [ ] Follow/unfollow event không tạo conversation rác; webhook trùng lặp bị dedupe (1 Message duy nhất).

## 5b. Bản đồ mã lỗi luồng connect (đã gặp thật 2026-10-01)

| Mã | Ý nghĩa | Khắc phục |
|---|---|---|
| `-14029` The application is not approved | App chưa được duyệt quyền API OA | Quản lý ứng dụng → Đăng ký sử dụng API (nhóm Official Account) → chờ duyệt |
| `-14003` Invalid redirect uri | Callback **chưa đăng ký đúng chỗ** — luồng OA permission đối chiếu ở **Official Account → Thiết lập chung → Official Account Call back Url**, KHÔNG phải "Đăng nhập bằng Zalo" (đăng ký cả hai cho chắc) | Đăng ký `{WEBHOOK_BASE_URL}/api/v1/integrations/zalo/callback` + Xác thực domain |
| `-14068` User don't own any Official Accounts | Tài khoản Zalo ủy quyền **không sở hữu OA nào** | Tạo OA bằng tài khoản đó (bỏ qua xác thực được) hoặc đăng nhập bằng tài khoản chủ OA |

Thứ tự cấu hình app đã kiểm chứng: Đăng ký sử dụng API (duyệt) → Official Account Call back Url → Xác thực domain → (Đăng nhập bằng Zalo callback chỉ cần cho social login).

## 6. Rủi ro cần xác minh với OA thật khi dev (điểm cô lập)
- Thứ tự concat chính xác của MAC + nguồn timestamp (body vs header) + định dạng header `X-ZEvent-Signature` → cô lập trong `computeExpectedMac`.
- Response shape chuẩn của `oa_callback_verify` → cô lập trong `handleCallbackVerification`.
- MAC dùng **OA Secret Key** (console) hay app secret → nếu app secret thì bỏ bước nhập OA Secret Key (thay đổi 1 điểm).
- Field path đính kèm CS payload (`data.image.url`, `data.file.url`, `msg_ids`...) → cô lập trong `parseInboundPayload`.
- Error code "invalid access token" (giả định `-216`) → cô lập trong `ZALO_ERROR_CODES`.
- URL authorize front-channel (`/v4/oa/permission`) + việc Zalo có echo lại param `state` ở callback hay không (docs cộng đồng chỉ ghi callback trả `code` + `oa_id`) → nếu không echo: chuyển sang bind workspace lúc claim session (`connect`) thay vì lúc authorize. Cô lập trong `getAuthUrl`/`handleCallback`.
- Field `msg_id` trong response gửi CS (để khớp delivery receipt) → cô lập trong `deliverCsMessage`.
