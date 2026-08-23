# Data Architecture & Security (Phase 1)

## 1. Relational Database (PostgreSQL 16)

PostgreSQL là nguồn chân lý (Source of Truth) cho toàn bộ dữ liệu nghiệp vụ giao dịch (ACID transactions).

### 1.1 Tenant Isolation Strategy
- Mọi bảng dữ liệu vận hành đều chứa cột `workspaceId` có index.
- Composite Unique Constraints bảo vệ tính toàn vẹn:
  - `Workspace.slug` (`@unique`)
  - `Contact`: `@@unique([workspaceId, identifier])`
  - `Channel`: `@@unique([workspaceId, channelType, providerAccountId])`
  - `ChannelIdentity`: `@@unique([channelId, externalContactId])`
  - `ChannelEvent`: `@@unique([channelId, externalEventId])`
  - `Conversation`: `@@unique([workspaceId, displayId])`
  - `ConversationLabel`: `@@id([conversationId, labelId])`
  - `Message`: `@@unique([conversationId, externalId])`
  - `WebhookDelivery`: `@@unique([subscriptionId, eventId])`

---

## 2. In-Memory & Caching Engine (Redis 7)

Redis được sử dụng cho 3 mục đích chính:
1. **WebSocket Pub/Sub Adapter**: Đồng bộ hóa tin nhắn và sự kiện realtime giữa nhiều tiến trình NestJS server.
2. **Presence & Online State**: Lưu tập hợp Agent đang online (`presence:workspace_{wsId}`) phục vụ điều phối Round-Robin.
3. **Queue / Background Workers**: Quản lý hàng đợi xử lý webhook và retry qua BullMQ.

---

## 3. Object Storage (MinIO S3)

Toàn bộ file đa phương tiện (ảnh, video, âm thanh, tài liệu) được lưu trữ trên MinIO S3:

---

## 4. Channel Credentials Encryption Policy

- Toàn bộ secret/token trong `Channel.credentials` phải được mã hóa bằng **AES-256-GCM** trước khi ghi vào database.
- Khóa bí mật mã hóa (`ENCRYPTION_MASTER_KEY`) được quản lý qua biến môi trường bảo mật, không commit lên git.
