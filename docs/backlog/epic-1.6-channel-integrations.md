# Epic 1.6: Channel Integrations

## 1. Overview

Hiện thực các `ChannelAdapter` cụ thể kết nối vào hệ thống dựa trên `ChannelAdapter` interface đã định nghĩa tại Epic 1.3 và đẩy dữ liệu vào Conversation Core tại Epic 1.5: **Web Chat Widget, Facebook Messenger, Telegram Bot**. Mỗi adapter chịu trách nhiệm xác thực webhook, chuẩn hóa payload, và gửi tin nhắn outbound qua kênh tương ứng.

- **ID**: `EPIC-1.6`
- **Status**: ✅ Done
- **Dependencies**: `EPIC-1.5` (Conversation & Messaging Core)
- **References**:
  - `docs/references/chatwoot/source/app/models/channel/`
  - `docs/references/chatwoot/source/app/services/`

### Design Decisions

- **Phase 1 Channels**: Chỉ implement 3 channels: Web Chat, Facebook Messenger, Telegram Bot.
- **Deferred Channels**: Zalo OA và Email Channel sẽ implement ở giai đoạn sau Phase 1 hoặc đầu Phase 2.

---

## 2. Features Summary

| Feature | Tên | Complexity | Lý do |
| :--- | :--- | :---: | :--- |
| **F-1.6.1** | Web Chat Widget Channel | 🔴 **High** | Widget JS SDK cross-origin, WebSocket bidirectional (không qua BullMQ), visitor identification, real-time messaging, widget customization |
| **F-1.6.2** | Facebook Messenger Channel | 🔴 **High** | Facebook Platform API integration, HMAC-SHA256 verification, PSID mapping, media download, delivery receipts, page subscription |
| **F-1.6.3** | Telegram Bot Channel | 🟡 **Medium** | Telegram Bot API tương tự Facebook nhưng API đơn giản hơn, webhook setup đơn giản, file download qua getFile |

---

## 3. Feature Specifications

---

### 📦 Feature F-1.6.1: Web Chat Widget Channel — 🔴 High

#### Objective

Hiện thực `WebChatAdapter` — kênh chat trực tiếp trên website, cung cấp widget JS embed code để khách hàng (visitor) nhắn tin trực tiếp với Agent qua trình duyệt web. Khác với các kênh khác, Web Chat sử dụng WebSocket trực tiếp thay vì webhook callback.

#### Scope

- `WebChatAdapter` implements `ChannelAdapter`:
  - `verifyWebhook()` — xác thực widget token
  - `parseInboundPayload()` — chuẩn hóa message từ widget SDK
  - `sendMessage()` — push message qua WebSocket tới widget client
  - `getChannelInfo()` — trả về widget configuration
- Web Chat widget SDK (JS embeddable snippet)
- Anonymous visitor → Contact creation (auto-generate identifier)
- Visitor identification qua `setUser()` SDK method (trigger `ContactIdentifyService`)
- Real-time bidirectional messaging qua WebSocket (không qua BullMQ queue)
- Widget customization: greeting message, color theme, position, business hours

#### Acceptance Criteria

- [x] Widget embed code hoạt động trên bất kỳ website nào (cross-origin)
- [x] Visitor mới tự động tạo Contact + ChannelIdentity
- [x] `setUser({ identifier, email, name })` trigger contact identification/merge
- [x] Message gửi từ widget → tạo Conversation + Message trong hệ thống
- [x] Agent reply → push realtime tới widget client
- [x] Widget hiển thị greeting message khi mở lần đầu
- [x] Adapter đăng ký thành công trong `ChannelAdapterRegistry`

#### Dependencies

- `F-1.3.3` (ChannelAdapter Abstraction)
- `EPIC-1.5` (Conversation & Messaging Core)
- `EPIC-1.4` (Contact Identity Resolution — cho `setUser`)

---

### 📦 Feature F-1.6.2: Facebook Messenger Channel — 🔴 High

#### Objective

Hiện thực `FacebookAdapter` — kết nối với Facebook Messenger Platform API để nhận và gửi tin nhắn qua Facebook Page. Hỗ trợ text và media messages.

#### Scope

- `FacebookAdapter` implements `ChannelAdapter`:
  - `verifyWebhook()` — xác thực Facebook webhook verification challenge (`hub.verify_token`) và HMAC-SHA256 payload signature (`X-Hub-Signature-256`)
  - `parseInboundPayload()` — chuẩn hóa Facebook webhook payload (messaging events) thành `InboundMessagePayload`
  - `sendMessage()` — gọi Facebook Send API (`POST /me/messages`) với Page Access Token
  - `getChannelInfo()` — lấy thông tin Facebook Page (name, avatar)
- PSID (Page-Scoped User ID) → ChannelIdentity mapping
- Support message types: text, image, video, audio, file (attachment)
- Delivery status webhook (delivered, read receipts) → update `Message.deliveryStatus`
- Page subscription management (subscribe/unsubscribe webhook)

#### Acceptance Criteria

- [x] Facebook webhook verification challenge (`GET` request) respond đúng `hub.challenge`
- [x] Inbound message webhook (`POST`) verify HMAC-SHA256 signature
- [x] Text message từ user → tạo Message trong Conversation tương ứng
- [x] Media message (image/video/audio/file) → download và lưu trên MinIO, tạo Attachment
- [x] Agent reply → gọi Facebook Send API thành công
- [x] PSID mapping → đúng Contact qua ChannelIdentity
- [x] Delivery/Read receipts → cập nhật `deliveryStatus`
- [x] Invalid signature → reject webhook (`401`)
- [x] Adapter đăng ký thành công trong `ChannelAdapterRegistry`

#### Dependencies

- `F-1.3.3` (ChannelAdapter Abstraction)
- `F-1.3.4` (Inbound Webhook Pipeline)
- `EPIC-1.5` (Conversation & Messaging Core)

---

### 📦 Feature F-1.6.3: Telegram Bot Channel — 🟡 Medium

#### Objective

Hiện thực `TelegramAdapter` — kết nối với Telegram Bot API để nhận và gửi tin nhắn qua Telegram Bot. Hỗ trợ text và media messages.

#### Scope

- `TelegramAdapter` implements `ChannelAdapter`:
  - `verifyWebhook()` — xác thực Telegram webhook secret token (custom header hoặc URL secret path)
  - `parseInboundPayload()` — chuẩn hóa Telegram Update object thành `InboundMessagePayload`
  - `sendMessage()` — gọi Telegram Bot API (`sendMessage`, `sendPhoto`, `sendDocument`, etc.)
  - `getChannelInfo()` — gọi `getMe` API lấy thông tin Bot
- Telegram Chat ID → ChannelIdentity mapping
- Support message types: text, photo, video, audio, document, voice, sticker
- Webhook registration: `setWebhook` API khi tạo Channel
- Bot commands support (optional: `/start`, `/help`)

#### Acceptance Criteria

- [x] Telegram webhook nhận Update object và xử lý đúng
- [x] Webhook secret token verification hoạt động
- [x] Text message → tạo Message trong Conversation
- [x] Media messages (photo/video/document/audio/voice) → download file qua Telegram `getFile` API, lưu MinIO, tạo Attachment
- [x] Agent reply → gọi Telegram Bot API gửi tin nhắn thành công
- [x] Chat ID mapping → đúng Contact qua ChannelIdentity
- [x] `setWebhook` được gọi tự động khi tạo Channel mới
- [x] Adapter đăng ký thành công trong `ChannelAdapterRegistry`

#### Dependencies

- `F-1.3.3` (ChannelAdapter Abstraction)
- `F-1.3.4` (Inbound Webhook Pipeline)
- `EPIC-1.5` (Conversation & Messaging Core)
