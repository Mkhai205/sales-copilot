# Epic 1.3: Channel Platform Foundation

## 1. Overview

Xây dựng lớp nền tảng kết nối kênh: trừu tượng hóa `ChannelAdapter` Contract, mã hóa thông tin xác thực an toàn (`ChannelCredentialService` chuẩn AES-256-GCM), quản lý Inbox & Channel 1:1, gán Agent vào Inbox (`InboxMember`), và quy trình tiếp nhận Webhook bất đồng bộ (Inbound Webhook Pipeline) với cơ chế chống trùng lặp qua `ChannelEvent` và hàng đợi BullMQ.

- **ID**: `EPIC-1.3`
- **Status**: ✅ Done
- **Dependencies**: `EPIC-1.2` (Contact Management)
- **References**:
  - `.docs/references/chatwoot/source/app/models/inbox.rb`
  - `.docs/references/chatwoot/source/app/models/channel/`
  - `.docs/references/chatwoot/source/app/controllers/webhooks/`
  - `.docs/references/chatwoot/source/app/builders/contact_inbox_builder.rb`

---

## 2. Features Summary

| Feature | Tên | Complexity | Lý do |
| :--- | :--- | :---: | :--- |
| **F-1.3.1** | Channel Credential Encryption Service | 🟢 **Low** | Scoped rõ, AES-256-GCM encrypt/decrypt + key management, ít edge cases |
| **F-1.3.2** | Inbox & Channel Management | 🟡 **Medium** | CRUD Inbox+Channel 1:1, InboxMember management, credentials integration, nhiều endpoints |
| **F-1.3.3** | ChannelAdapter Abstraction & Registry | 🟢 **Low** | Interface definition + registry pattern, không có business logic phức tạp |
| **F-1.3.4** | Inbound Webhook Ingestion Pipeline | 🔴 **High** | Public webhook endpoint, HMAC verification, ChannelEvent dedup, BullMQ queue dispatch + worker, error handling & DLQ |

---

## 2.1. Design Decisions

| Quyết định | Lựa chọn |
|:---|:---|
| **Encryption integration** | Service-level (`ChannelCredentialService` inject tường minh), không dùng Prisma middleware |
| **Service organization** | 1 `InboxesService` gom Inbox + Channel + InboxMember. Controller tách 2 files (theo pattern workspaces) |
| **Adapter interface location** | `apps/server/src/integrations/` — backend-only. Chỉ export normalized payload types ra `shared-contracts` |
| **Webhook worker scope** | Skeleton worker — chỉ log received job. Full processing (contact resolution, conversation, message) implement ở Epic 1.4/1.5 |

---

## 2.2. Task Breakdown (5 Tasks)

| Task | Feature | Tên | Complexity |
| :--- | :--- | :--- | :---: |
| **T-1.3.1** | F-1.3.1 | Channel Credential Encryption Service | 🟢 **Low** |
| **T-1.3.2** | F-1.3.3 | ChannelAdapter Interface & Registry | 🟢 **Low** |
| **T-1.3.3** | F-1.3.2 (pt.1) | Inbox & Channel CRUD (5 endpoints) | 🟡 **Medium** |
| **T-1.3.4** | F-1.3.2 (pt.2) | InboxMember Management (3 endpoints) | 🟢 **Low** |
| **T-1.3.5** | F-1.3.4 | Inbound Webhook Ingestion Pipeline — Stub (BullMQ + dedup) | 🟡 **Medium** |

### Execution Order (DAG)

```text
T-1.3.1 (Encryption) ──┐
                        ├──► T-1.3.3 (Inbox CRUD) ──► T-1.3.4 (InboxMember) ──► T-1.3.5 (Webhook)
T-1.3.2 (Adapter)   ───┘                                                           ▲
                                                                              T-1.3.2 (Adapter)
```

---

## 3. Feature Specifications

---

### 📦 Feature F-1.3.1: Channel Credential Encryption Service — 🟢 Low

#### Objective

Xây dựng `ChannelCredentialService` chịu trách nhiệm mã hóa và giải mã toàn bộ access tokens, app secrets, webhook secrets trong `Channel.credentials` bằng thuật toán AES-256-GCM trước khi lưu vào database.

#### Scope

- `encrypt(plaintext: object)` → ciphertext string (IV + AuthTag + EncryptedData)
- `decrypt(ciphertext: string)` → plaintext object
- Encryption key management từ environment variable (`CHANNEL_ENCRYPTION_KEY`)
- Integration với Prisma middleware hoặc service-level read/write

#### Acceptance Criteria

- [x] Credentials không bao giờ lưu plaintext trong database
- [x] Mỗi lần encrypt sinh IV ngẫu nhiên riêng (không reuse IV)
- [x] Decrypt ciphertext bị tamper trả lỗi rõ ràng (AuthTag verification failed)
- [x] Không log, không expose plaintext credentials trong logs hoặc API responses
- [x] Unit tests cover encrypt/decrypt roundtrip và tamper detection

#### Dependencies

- `EPIC-1.0` (Foundation)

---

### 📦 Feature F-1.3.2: Inbox & Channel Management — 🟡 Medium

#### Objective

Cung cấp khả năng quản lý Inbox và Channel liên kết 1:1 trong Workspace, cùng với quản lý `InboxMember` (gán Agent vào Inbox để phục vụ auto-assignment và phân quyền trả lời).

#### Scope

- CRUD Inbox (name, greeting message, auto-assignment toggle)
- Tạo Channel liên kết 1:1 với Inbox (type: `WEB_CHAT`, `FACEBOOK`, `TELEGRAM`, `ZALO`, `EMAIL`)
- Channel credentials CRUD (read/write qua `ChannelCredentialService`)
- `InboxMember` management: thêm/xóa Agent vào Inbox
- Liệt kê danh sách Inbox trong Workspace
- Zod schemas & DTOs cho Inbox/Channel/InboxMember operations

#### Acceptance Criteria

- [x] Mỗi Inbox gắn với đúng 1 Channel (`1:1 mapping` — BR-2.1)
- [x] `InboxMember` chỉ thêm User đã là `WorkspaceMember` của cùng Workspace (BR-1.3)
- [x] Channel credentials được mã hóa khi lưu, giải mã khi đọc
- [x] Xóa Inbox cascade xóa Channel và InboxMember liên quan
- [x] REST API endpoints:
  - `GET    /api/v1/inboxes` — List inboxes
  - `POST   /api/v1/inboxes` — Create inbox + channel
  - `GET    /api/v1/inboxes/:id` — Detail (include channel info, member count)
  - `PATCH  /api/v1/inboxes/:id` — Update inbox settings
  - `DELETE /api/v1/inboxes/:id` — Delete inbox
  - `GET    /api/v1/inboxes/:id/members` — List inbox members
  - `POST   /api/v1/inboxes/:id/members` — Add member
  - `DELETE /api/v1/inboxes/:id/members/:userId` — Remove member
- [x] Guards: `JwtAuthGuard` + `WorkspaceGuard`; CRUD yêu cầu role `ADMIN` hoặc `OWNER`
- [x] Tenant isolation: mọi query include `workspaceId`

#### Dependencies

- `EPIC-1.1` (Identity — WorkspaceGuard, RolesGuard)
- `F-1.3.1` (Channel Credential Encryption)

---

### 📦 Feature F-1.3.3: ChannelAdapter Abstraction & Registry — 🟢 Low

#### Objective

Định nghĩa `ChannelAdapter` interface — hợp đồng kỹ thuật chung cho tất cả channel integrations — và `ChannelAdapterRegistry` để lookup adapter theo channel type tại runtime.

#### Scope

- `ChannelAdapter` interface contract:
  - `verifyWebhook(request): boolean` — xác thực chữ ký webhook inbound
  - `parseInboundPayload(rawBody): InboundMessagePayload` — chuẩn hóa payload thành internal format
  - `sendMessage(channel, message): SendMessageResult` — gửi tin nhắn outbound qua kênh
  - `getChannelInfo(channel): ChannelInfo` — lấy thông tin kênh (page name, bot username, etc.)
- `InboundMessagePayload` normalized type (externalContactId, externalMessageId, content, contentType, attachments, senderInfo, timestamp)
- `SendMessageResult` type (externalMessageId, deliveryStatus)
- `ChannelAdapterRegistry` — NestJS injectable service, register/lookup adapter by `ChannelType`

#### Acceptance Criteria

- [x] Interface có đầy đủ 4 methods contract
- [x] Normalized `InboundMessagePayload` type covers: text, image, video, audio, file messages
- [x] `ChannelAdapterRegistry` throw `NotFoundException` cho channel type chưa có adapter
- [x] Interface và types được export từ shared contracts package

#### Dependencies

- `EPIC-1.0` (Foundation — shared contracts)

---

### 📦 Feature F-1.3.4: Inbound Webhook Ingestion Pipeline — 🔴 High

#### Objective

Xây dựng quy trình tiếp nhận webhook từ các kênh bên ngoài: xác thực chữ ký (qua `ChannelAdapter.verifyWebhook`), chống trùng lặp qua `ChannelEvent`, và dispatch sang BullMQ queue để xử lý bất đồng bộ.

#### Scope

- Public webhook endpoint: `POST /api/v1/channels/:channelId/webhook` (không yêu cầu JWT auth)
- Webhook signature verification qua adapter
- `ChannelEvent` creation với deduplication (`@@unique([channelId, externalEventId])`)
- BullMQ queue dispatch (`channel-ingestion` queue)
- BullMQ worker consumer: parse payload → resolve contact → create/update conversation → create message
- Error handling và dead letter queue cho failed webhooks

#### Acceptance Criteria

- [x] Webhook endpoint accessible mà không cần JWT (public endpoint cho platforms callback)
- [x] Webhook với signature không hợp lệ bị reject (`401 Unauthorized`)
- [x] Duplicate webhook (cùng `externalEventId`) bị bỏ qua (idempotency — BR-2.2)
- [x] `ChannelEvent` ghi nhận mọi webhook đến (kể cả ignored duplicates) cho audit trail
- [x] BullMQ worker xử lý message creation bất đồng bộ
- [x] Failed jobs được retry tối đa 3 lần với exponential backoff
- [x] Worker log đầy đủ cho debugging (không log plaintext credentials)

#### Dependencies

- `F-1.3.2` (Inbox & Channel — cần Channel tồn tại để nhận webhook)
- `F-1.3.3` (ChannelAdapter — cần adapter để verify và parse)
