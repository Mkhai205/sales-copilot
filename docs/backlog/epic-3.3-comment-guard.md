# Epic 3.3 — Comment Guard: Vệ Sĩ Ẩn Bình Luận & Kéo Khách Vào Inbox

> **Mục tiêu**: Xây dựng pipeline tự động quét bình luận Facebook chứa số điện thoại, ẩn comment để bảo vệ thông tin khách hàng, gửi Private Reply kéo khách vào Inbox để AI hoặc nhân viên tư vấn tiếp.\
> **Tiên quyết**: Epic 3.1 (AI Agent Core) — cần AI Dispatcher đã hoạt động để route conversation mới\
> **Ước lượng**: 1-1.5 tuần\
> **Tham chiếu**: [RFC Architecture §4](../architecture/rfc-ai-agent-framework.md)

---

## 1. Mô Tả Tổng Quan

Comment Guard là **module độc lập** chạy 24/7, **không cần LLM** (chi phí token = 0). Nó giải quyết vấn đề lớn nhất của Social Commerce Việt Nam: **khách comment SĐT công khai** trên bài viết/livestream → bị đối thủ "cướp khách" bằng cách gọi SĐT.

**Luồng**:
1. Khách comment: *"Tư vấn mình nhé, SĐT 0912345678"*
2. System quét Regex < 5ms → phát hiện SĐT
3. Ẩn comment trên Facebook (Graph API) < 1 giây
4. Gửi Private Reply: *"Shop đã nhận SĐT, mình nhắn riêng tư vấn bạn nhé 😊"*
5. Tạo/mở Conversation trong Unified Inbox → AI (nếu AUTOPILOT bật) hoặc nhân viên tiếp nhận

**Comment Guard chạy độc lập với AI Agent**: Khi AUTOPILOT bật → ẩn comment + kéo inbox + AI tư vấn. Khi AUTOPILOT tắt → ẩn comment + kéo inbox + nhân viên tư vấn.

---

## 2. Quy Tắc Nghiệp Vụ

### 2.1. Điều kiện kích hoạt

- Facebook Page webhook `entry.changes` với `field === 'feed'` và `value.item === 'comment'` và `value.verb === 'add'`.
- **Chỉ quét comment mới** (`verb: 'add'`). Không quét edit, remove.
- **Chỉ quét khi `commentGuard.enabled === true`** cho channel đó.
- Không quét comment của Page chính nó (filter out `from.id === page_id`).

### 2.2. Phát hiện SĐT — Regex thuần

Sử dụng `VIETNAMESE_PHONE_EXTRACT_REGEX`:
```
/(?:(?:\+84|84|0)[3|5|7|8|9])(?:\d{8}|\b(?:\d{2,3}[\s.-]?){3}\d)/g
```

Bao phủ:
- `0912345678` (chuẩn 10 số)
- `+84912345678` (quốc tế)
- `091 234 5678` (có khoảng trắng)
- `091-234-5678` (có dấu gạch)
- `091.234.5678` (có dấu chấm)

### 2.3. Hành động khi phát hiện SĐT

| Bước | Hành động | API/Logic | SLA |
|---|---|---|---|
| 1 | Ẩn comment trên Facebook | `POST /{comment-id}` body: `{ is_hidden: true }` | < 1 giây |
| 2 | Gửi Private Reply cho commenter | `POST /{comment-id}/private_replies` body: `{ message: template }` | < 2 giây |
| 3 | Resolve Contact | `ContactResolutionService` — tìm/tạo Contact từ Facebook PSID | - |
| 4 | Tạo/mở Conversation | `ConversationsService.findOrCreate()` | - |
| 5 | Lưu comment gốc | Lưu message vào conversation (nội dung comment + metadata) | - |
| 6 | AI hoặc nhân viên tiếp nhận | AiDispatcherListener xử lý conversation mới | - |

### 2.4. Private Reply Template

```
Dạ shop đã nhận thông tin của bạn rồi ạ 😊
Shop sẽ tư vấn riêng cho bạn trong tin nhắn này nhé!
```

- Template lưu trong `channel.settings.commentGuard.privateReplyTemplate`.
- Nếu không cấu hình → dùng template mặc định trên.
- Chỉ gửi Private Reply **1 lần** per comment (dedup bằng `ChannelEvent.externalEventId`).

### 2.5. Deduplication

- Mỗi comment webhook tạo 1 `ChannelEvent` với `externalEventId = comment_id`.
- Unique constraint `[channelId, externalEventId]` → tránh xử lý trùng.
- Facebook có thể gửi webhook retry → idempotent nhờ dedup.

### 2.6. Rate Limiting — Facebook Graph API

- Graph API rate limit: ~200 calls/hour/Page.
- Nếu đang bị rate limit (HTTP 429) → queue retry với exponential backoff.
- Log metrics: số comment quét, số ẩn thành công, số fail.

---

## 3. Kiến Trúc

### 3.1. Luồng Xử Lý

```
Facebook Webhook (POST /webhooks/facebook)
  → Verify HMAC signature (existing)
  → Parse payload:
      entry.changes? field === 'feed'? → CommentGuardService
      entry.messaging? → Existing ChannelIngestionProcessor
  
CommentGuardService.processComment(comment):
  → Dedup: ChannelEvent upsert
  → Regex scan: VIETNAMESE_PHONE_EXTRACT_REGEX
  → Nếu có SĐT:
      → Facebook Graph API: hide comment
      → Facebook Graph API: private reply
      → Contact resolution (tìm/tạo Contact từ PSID)
      → Conversation find/create
      → MessagesService.create() (lưu comment gốc)
      → message.created event → AiDispatcherListener handles the rest
```

### 3.2. Cấu hình Comment Guard

Lưu trong `channel.settings.commentGuard`:

```typescript
{
  enabled: boolean,                  // Bật/tắt Comment Guard cho channel này
  privateReplyTemplate?: string,     // Template tin nhắn riêng (tùy chọn)
}
```

- Cấu hình **per Channel** (mỗi Facebook Page có thể bật/tắt riêng).
- Không lưu per Inbox vì 1 Channel có thể connect nhiều Inbox.

### 3.3. Facebook Graph API Methods Cần Thêm

| Method | Endpoint | Body | Mục đích |
|---|---|---|---|
| `hideComment` | `POST /{comment-id}` | `{ is_hidden: true }` | Ẩn comment (chỉ admin Page thấy) |
| `sendPrivateReply` | `POST /{comment-id}/private_replies` | `{ message: string }` | Gửi tin nhắn riêng cho commenter |

Cần thêm vào `FacebookAdapter` hoặc tạo `FacebookGraphService` riêng.

### 3.4. Xử lý edge cases

| Case | Xử lý |
|---|---|
| Comment chứa SĐT nhưng là của admin/editor Page | Bỏ qua (filter `from.id !== page_id`) |
| Comment trả lời (reply) có SĐT | Vẫn ẩn + Private Reply |
| Khách comment nhiều lần với SĐT | Dedup — chỉ tạo 1 Conversation, append messages |
| Facebook API lỗi (429, 500) | Retry queue, exponential backoff, log metric |
| Comment đã bị ẩn bởi Facebook spam filter | Vẫn xử lý bình thường (idempotent) |
| Channel không có quyền `pages_manage_engagement` | Log warning, skip hide action |

---

## 4. Tiêu Chí Nghiệm Thu

### Comment Detection
- [ ] Regex phát hiện SĐT Việt Nam: `0912345678`, `+84912345678`, `091 234 5678`, `091-234-5678`
- [ ] Không false positive: text "mua 0 sản phẩm" hoặc "giá 350000đ" không bị detect
- [ ] Latency < 5ms cho regex scan

### Facebook Integration
- [ ] Parse `entry.changes` đúng (hiện tại chỉ parse `entry.messaging`)
- [ ] Hide comment thành công via Graph API
- [ ] Private Reply gửi đúng template
- [ ] Dedup: webhook retry không tạo duplicate

### Conversation Flow
- [ ] Comment → Ẩn → Private Reply → Contact tạo → Conversation mở → Message lưu
- [ ] Nếu AUTOPILOT bật → AI tự động tư vấn trong conversation mới
- [ ] Nếu AUTOPILOT tắt → Conversation hiện trong Inbox cho nhân viên

### Configuration
- [ ] UI cấu hình bật/tắt Comment Guard per Channel
- [ ] UI edit Private Reply template
- [ ] Feature flag `feature.comment_masking_enabled` hoạt động

### Resilience
- [ ] Facebook API 429 → retry với backoff, không crash worker
- [ ] Webhook nhận HTTP 200 < 100ms (non-blocking processing)
