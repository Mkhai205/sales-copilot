# Epic 1.5: Conversation & Messaging Core

## 1. Overview

Hiện thực trái tim của hệ thống hội thoại: Label management, State Machine quản lý vòng đời cuộc trò chuyện (`OPEN`, `PENDING`, `RESOLVED`, `SNOOZED`), gán nhãn hội thoại, chuỗi tin nhắn đa hình (`CONTACT`, `USER`, `SYSTEM`), ghi chú nội bộ riêng tư (Private Note), theo dõi trạng thái chuyển phát, lưu trữ tệp đính kèm đa phương tiện trên MinIO S3, và tích hợp đầu cuối với Inbound Ingestion Pipeline.

- **ID**: `EPIC-1.5`
- **Status**: ✅ Done
- **Dependencies**: `EPIC-1.3` (Channel Platform), `EPIC-1.4` (Contact Identity Resolution)
- **References**:
  - `docs/references/chatwoot/source/app/models/conversation.rb`
  - `docs/references/chatwoot/source/app/models/message.rb`
  - `docs/references/chatwoot/source/app/models/attachment.rb`
  - `docs/references/chatwoot/source/app/models/label.rb`
  - `docs/references/chatwoot/source/app/controllers/api/v1/accounts/conversations/`
  - `docs/references/chatwoot/source/app/controllers/api/v1/accounts/labels_controller.rb`

---

## 2. Architecture & Design Decisions

| Quyết định | Lựa chọn kiến trúc | Lý do & Quy tắc |
| :--- | :--- | :--- |
| **Module Boundaries** | 3 Modules độc lập: `labels/`, `conversations/`, `messages/` | Tuân thủ Modular Monolith, tách biệt trách nhiệm rõ ràng, dễ test và tránh bloated service. |
| **State Machine Execution** | Validation Guard Matrix bên trong `ConversationsService` | Đơn giản, trực tiếp (KISS), không lạm dụng state pattern trừu tượng quá mức. Chặn mọi chuyển trạng thái không hợp lệ với `400 Bad Request`. |
| **Message Atomicity & Side Effects** | Prisma `$transaction` gom Message + Attachments + Conversation state update | Đảm bảo tính nhất quán dữ liệu (lastActivityAt, unread count, auto-reopen), phát tán domain events (`message.created`, `conversation.status_updated`) sau khi commit. |
| **Attachment Storage** | Hybrid: Multipart Direct Server Upload + Presigned URL support | Hỗ trợ upload trực tiếp qua form data cho API client đơn giản, đồng thời cung cấp URL an toàn qua `StorageService` (MinIO S3). |
| **Inbound Threading Strategy** | Tìm Conversation active (`OPEN`, `PENDING`, `SNOOZED`) gần nhất; tạo mới nếu chỉ có `RESOLVED` | Phù hợp với luồng phiên làm việc omnichannel (Chatwoot standard), gom tin nhắn vào thread đang mở hoặc mở thread mới khi vấn đề cũ đã giải quyết. |
| **Polymorphic Sender Invariant** | Strict validation (BR-5.1) theo `senderType` | `CONTACT` -> `senderId` là `Contact.id`; `USER` -> `senderId` là `User.id`; `SYSTEM` -> `senderId` là `null`. |
| **Private Notes Security** | Filter `isPrivate` theo quyền truy cập | Tin nhắn ghi chú nội bộ (`isPrivate = true`) chỉ hiển thị cho nhân viên (Agents/Users), không gửi ra kênh ngoài hoặc khách hàng. |

---

## 2.1. Task Breakdown (7 Granular Tasks)

| Task ID | Feature Code | Tên Task | Complexity | Mô tả vắn tắt |
| :--- | :--- | :--- | :---: | :--- |
| **T-1.5.1** | Cross-cutting | Shared Contracts, DTOs & Validation Schemas | 🟢 **Low** | Zod schemas, TypeScript types, DTOs và Event interfaces cho Labels, Conversations, Messages, Attachments. |
| **T-1.5.2** | F-1.5.1 | Labels Module (CRUD & Workspace Scoping) | 🟢 **Low** | `LabelsService`, `LabelsController`, REST endpoints, unique title constraint, emit events và unit tests. |
| **T-1.5.3** | F-1.5.2 (pt.1) | Conversation Core Service & State Machine | 🔴 **High** | `ConversationsService` với State Machine 4 trạng thái, assignment, priority, unread count, filter query & unit tests. |
| **T-1.5.4** | F-1.5.2 (pt.2) + F-1.5.3 | Conversation Labels & REST Controller | 🟡 **Medium** | Junction `ConversationLabel` operations, REST API Controller cho conversations và labels, module wiring. |
| **T-1.5.5** | F-1.5.5 | Attachment & Media Storage Integration | 🟡 **Medium** | `AttachmentsService` tích hợp `StorageService` (MinIO), MIME/size validation, stream upload, presigned URLs. |
| **T-1.5.6** | F-1.5.4 | Messages Service & Polymorphic Sender Threading | 🔴 **High** | `MessagesService`, `MessagesController`, polymorphic validation, private notes, delivery status, auto-reopen side-effects, unit tests. |
| **T-1.5.7** | F-1.5.2 + F-1.5.4 | Inbound Ingestion Pipeline Integration & E2E Validation | 🟡 **Medium** | Nối `channel-ingestion.processor.ts` với Contact Resolution -> Conversation findOrCreate -> Message Creation -> E2E unit tests. |

---

## 2.2. Execution Order (DAG)

```text
       ┌───────────────────────────────┐
       │ T-1.5.1: Shared Contracts     │
       └──────────────┬────────────────┘
                      │
        ┌─────────────┴─────────────┐
        ▼                           ▼
┌───────────────┐           ┌─────────────────────────────┐
│ T-1.5.2:      │           │ T-1.5.3: Conversation Core  │
│ Labels Module │           │ & State Machine Service     │
└───────┬───────┘           └──────────────┬──────────────┘
        │                                  │
        └──────────────┬───────────────────┘
                       ▼
        ┌─────────────────────────────┐
        │ T-1.5.4: Conversation Labels│
        │ & REST Controller           │
        └──────────────┬──────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
┌─────────────────────────┐   ┌─────────────────────────────┐
│ T-1.5.5: Attachment &   │   │ T-1.5.6: Messages Service   │
│ Media Storage Service   ├──►│ & Polymorphic Threading     │
└─────────────────────────┘   └──────────────┬──────────────┘
                                             │
                                             ▼
                              ┌─────────────────────────────┐
                              │ T-1.5.7: Inbound Ingestion  │
                              │ Pipeline & E2E Integration  │
                              └─────────────────────────────┘
```

---

## 3. Feature Specifications

---

### 📦 Feature F-1.5.1: Label Management — 🟢 Low

#### Objective
Cung cấp khả năng tạo và quản lý nhãn (`Label`) trong Workspace để phân loại hội thoại. Label là prerequisite cho Conversation Labels (F-1.5.3).

#### Scope
- CRUD Label (title, description, color, showOnSidebar)
- Enforce unique title trong cùng Workspace (`@@unique([workspaceId, title])`)
- REST API endpoints:
  - `GET    /api/v1/labels` — List labels
  - `POST   /api/v1/labels` — Create label
  - `GET    /api/v1/labels/:id` — Get label detail
  - `PATCH  /api/v1/labels/:id` — Update label
  - `DELETE /api/v1/labels/:id` — Delete label (cascade xóa ConversationLabel)
- Guards: `JwtAuthGuard` + `WorkspaceGuard`; CUD yêu cầu `ADMIN` hoặc `OWNER`
- Domain Events: `label.created`, `label.updated`, `label.deleted`

#### Acceptance Criteria
- [x] Label title duy nhất trong cùng Workspace (`@@unique([workspaceId, title])`), throw `409 Conflict` nếu trùng
- [x] Color hex code hợp lệ (`/^#[0-9A-Fa-f]{6}$/`)
- [x] Delete label tự động dọn sạch các liên kết trong `ConversationLabel` (DB Cascade)
- [x] Tenant isolation: mọi query bắt buộc có `workspaceId`

---

### 📦 Feature F-1.5.2: Conversation Lifecycle & State Machine — 🔴 High

#### Objective
Quản lý phiên hội thoại với state machine chặt chẽ, hỗ trợ phân công Agent/Team, mức độ ưu tiên (priority), theo dõi unread count và lọc hội thoại đa tiêu chí.

#### Scope
- Quản lý vòng đời trạng thái (`ConversationStatus`): `OPEN`, `PENDING`, `SNOOZED`, `RESOLVED`
- State transition matrix (BR-4.1):
  - `OPEN` -> `PENDING`, `SNOOZED`, `RESOLVED`
  - `PENDING` -> `OPEN`, `SNOOZED`, `RESOLVED`
  - `SNOOZED` -> `OPEN`, `RESOLVED` (bắt buộc `snoozedUntil` khi sang `SNOOZED`)
  - `RESOLVED` -> `OPEN` (mở lại thủ công hoặc tự động khi Contact nhắn tin)
- Assignment: gán `assigneeId` (phải là `WorkspaceMember` và `InboxMember` của Inbox tương ứng) và `teamId` (phải thuộc Workspace)
- Priority: `URGENT`, `HIGH`, `MEDIUM`, `LOW`
- Unread count: tăng khi Contact gửi tin nhắn, reset về 0 khi Agent xem hoặc phản hồi (BR-4.3)
- List conversations với filters: `status`, `inboxId`, `assigneeId`, `teamId`, `labelId`, `search`, pagination offset, sort theo `lastActivityAt DESC`
- Domain Events: `conversation.created`, `conversation.status_updated`, `conversation.assigned`, `conversation.priority_updated`, `conversation.reopened`

#### Acceptance Criteria
- [x] Chuyển đổi trạng thái trái phép bị từ chối với `400 Bad Request` (`code: 'INVALID_STATUS_TRANSITION'`)
- [x] Chuyển sang `SNOOZED` mà không có `snoozedUntil` hợp lệ trong tương lai -> `400 Bad Request`
- [x] Gán Agent không thuộc `InboxMember` của Inbox -> `400 Bad Request` (`code: 'ASSIGNEE_NOT_IN_INBOX'`)
- [x] Auto-reopen hoạt động chính xác khi có inbound message từ khách hàng
- [x] API endpoints:
  - `GET    /api/v1/conversations`
  - `POST   /api/v1/conversations`
  - `GET    /api/v1/conversations/:id`
  - `PATCH  /api/v1/conversations/:id/status`
  - `PATCH  /api/v1/conversations/:id/assign`
  - `PATCH  /api/v1/conversations/:id/priority`
  - `POST   /api/v1/conversations/:id/reset-unread`

---

### 📦 Feature F-1.5.3: Conversation Labels — 🟢 Low

#### Objective
Hỗ trợ gán và gỡ nhãn cho hội thoại thông qua junction table `ConversationLabel` (quan hệ M:N giữa Conversation và Label).

#### Scope
- Gán danh sách labels cho conversation (`idempotent`)
- Gỡ label khỏi conversation
- Liệt kê danh sách labels của conversation
- REST API endpoints:
  - `GET    /api/v1/conversations/:id/labels`
  - `POST   /api/v1/conversations/:id/labels`
  - `DELETE /api/v1/conversations/:id/labels/:labelId`

#### Acceptance Criteria
- [x] Gán label trùng -> Idempotent, không báo lỗi, không sinh bản ghi duplicate
- [x] Gán label thuộc Workspace khác -> `404 Not Found` (tenant isolation)
- [x] Gỡ label không tồn tại trên conversation -> `404 Not Found`
- [x] Domain Event: `conversation.labels_updated`

---

### 📦 Feature F-1.5.4: Message Threading & Polymorphic Senders — 🔴 High

#### Objective
Hiện thực chuỗi tin nhắn trong conversation: hỗ trợ đa hình sender (`CONTACT`, `USER`, `SYSTEM`), private notes cho Agent, theo dõi trạng thái chuyển phát, cập nhật hoạt động hội thoại và quản lý unread count.

#### Scope
- Create message:
  - `senderType`: `CONTACT`, `USER`, `SYSTEM`
  - `senderId`: `Contact.id` (nếu CONTACT), `User.id` (nếu USER), `null` (nếu SYSTEM) — BR-5.1
  - `content`: chuỗi văn bản (nullable nếu có attachments — BR-5.2)
  - `contentType`: `TEXT`, `IMAGE`, `VIDEO`, `AUDIO`, `FILE`
  - `messageType`: `INCOMING`, `OUTGOING`, `ACTIVITY`, `TEMPLATE`
  - `isPrivate`: boolean — private notes chỉ hiển thị nội bộ
  - `deliveryStatus`: `PENDING` -> `SENT` -> `DELIVERED` -> `READ` / `FAILED`
  - `externalId`: ID tin nhắn từ kênh bên ngoài (unique per conversation: `@@unique([conversationId, externalId])`)
- Side-effects trong $transaction:
  - Cập nhật `Conversation.lastActivityAt = now()`
  - Nếu `CONTACT`: tăng `unreadMessagesCount`, tự động chuyển `RESOLVED`/`SNOOZED` -> `OPEN`
  - Nếu `USER`: reset `unreadMessagesCount = 0`, ghi nhận `firstReplyCreatedAt` nếu là phản hồi đầu tiên, tự động chuyển `OPEN` -> `PENDING` (nếu message không phải private note)
- List messages với phân trang và sắp xếp chronological
- REST API endpoints:
  - `GET    /api/v1/conversations/:id/messages`
  - `POST   /api/v1/conversations/:id/messages`
  - `PATCH  /api/v1/messages/:id/delivery-status`

#### Acceptance Criteria
- [x] Vi phạm BR-5.1 (`senderType` và `senderId` không khớp) -> `400 Bad Request`
- [x] Vi phạm BR-5.2 (`content` rỗng và không có attachments) -> `400 Bad Request`
- [x] Private notes không bao giờ gửi ra kênh tích hợp bên ngoài và không làm reset trạng thái conversation
- [x] Idempotency: Inbound message với cùng `externalId` trong 1 conversation không bị tạo trùng lặp
- [x] Domain Event: `message.created`, `message.delivery_status_updated`

---

### 📦 Feature F-1.5.5: Attachment & Media Storage — 🟡 Medium

#### Objective
Hỗ trợ upload và quản lý file đính kèm đa phương tiện (hình ảnh, video, audio, tài liệu) trên MinIO S3, liên kết chặt chẽ với Message.

#### Scope
- `AttachmentsService` kết nối `StorageService` (MinIO client)
- File validation:
  - Max file size: 25MB (configurable)
  - MIME types cho phép: Images (`image/jpeg`, `image/png`, `image/gif`, `image/webp`), Audio (`audio/mpeg`, `audio/ogg`, `audio/wav`, `audio/mp4`), Video (`video/mp4`, `video/webm`), Documents (`application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.*`, `text/plain`, `text/csv`, `application/zip`)
- S3 Storage Path cấu trúc chuẩn: `attachments/{workspaceId}/{messageId}/{uuid}-{filename}`
- Presigned URL generation và direct public URL
- Cascade delete dọn dẹp cả DB và MinIO object khi xóa attachment/message

#### Acceptance Criteria
- [x] File quá dung lượng hoặc sai MIME type bị từ chối rõ ràng (`400 Bad Request`)
- [x] Lưu trữ đầy đủ metadata: `fileName`, `fileType`, `fileSize`, `storagePath`, `contentType`
- [x] Presigned URL có thời hạn hết hạn an toàn (mặc định 15 phút)
- [x] Xóa Message tự động xóa các records `Attachment` và delete file trên S3

---

## 4. Detailed Task Implementation Specifications (AI Agent Ready)

---

### 📋 Task T-1.5.1: Shared Contracts, DTOs & Validation Schemas — 🟢 Low

#### 1. Mục tiêu
Định nghĩa toàn bộ Zod schemas, TypeScript types, DTOs, Enums và Event payloads cho Labels, Conversations, Messages và Attachments trong `@sales-copilot/shared-contracts`.

#### 2. Files tác động
- `packages/shared-contracts/src/labels/schemas.ts`
- `packages/shared-contracts/src/conversations/schemas.ts`
- `packages/shared-contracts/src/conversations/enums.ts`
- `packages/shared-contracts/src/messages/schemas.ts`
- `packages/shared-contracts/src/messages/enums.ts`
- `packages/shared-contracts/src/index.ts`

#### 3. Chi tiết Implementation
- **Labels Schemas**:
  - `createLabelSchema`: `title` (1-50 chars), `description` (optional, max 200), `color` (hex regex `/^#[0-9A-Fa-f]{6}$/`), `showOnSidebar` (boolean, default true).
  - `updateLabelSchema`: partial của `createLabelSchema`.
  - `labelDto`: type tương ứng.
- **Conversations Schemas**:
  - `createConversationSchema`: `contactId` (uuid), `inboxId` (uuid), `assigneeId` (uuid optional), `teamId` (uuid optional), `priority` (enum `ConversationPriority` optional), `customAttributes` (record optional).
  - `updateConversationStatusSchema`: `status` (`OPEN`, `PENDING`, `RESOLVED`, `SNOOZED`), `snoozedUntil` (ISO string optional, required if status is `SNOOZED`).
  - `assignConversationSchema`: `assigneeId` (uuid optional nullable), `teamId` (uuid optional nullable).
  - `updateConversationPrioritySchema`: `priority` (`URGENT`, `HIGH`, `MEDIUM`, `LOW`).
  - `conversationFilterQuerySchema`: `page`, `limit`, `status`, `inboxId`, `assigneeId`, `teamId`, `labelId`, `q` (search), `sortBy`, `sortOrder`.
  - `assignLabelsSchema`: `labelIds` (array of string min 1).
  - Domain Event types: `ConversationCreatedEvent`, `ConversationStatusUpdatedEvent`, `ConversationAssignedEvent`, `ConversationPriorityUpdatedEvent`, `ConversationReopenedEvent`, `ConversationLabelsUpdatedEvent`.
- **Messages & Attachments Schemas**:
  - `createMessageSchema`: `content` (optional string), `contentType` (`TEXT`, `IMAGE`, `VIDEO`, `AUDIO`, `FILE`), `messageType` (`INCOMING`, `OUTGOING`, `ACTIVITY`, `TEMPLATE`), `isPrivate` (boolean default false), `externalId` (optional string), `metadata` (record optional), `attachments` (array optional).
  - `updateDeliveryStatusSchema`: `deliveryStatus` (`PENDING`, `SENT`, `DELIVERED`, `READ`, `FAILED`).
  - `messageFilterQuerySchema`: `page`, `limit`, `beforeId`, `afterId`.
  - Domain Event types: `MessageCreatedEvent`, `MessageDeliveryStatusUpdatedEvent`.

#### 4. Verification
- `pnpm nx run shared-contracts:build` hoặc `pnpm nx run shared-contracts:lint` pass 100%.

---

### 📋 Task T-1.5.2: Labels Module (CRUD & Workspace Scoping) — 🟢 Low

#### 1. Mục tiêu
Xây dựng module quản lý Label hoàn chỉnh cho Workspace với đầy đủ service, controller, guards và unit tests.

#### 2. Files tác động
- `[NEW] apps/server/src/modules/labels/labels.service.ts`
- `[NEW] apps/server/src/modules/labels/labels.controller.ts`
- `[NEW] apps/server/src/modules/labels/labels.module.ts`
- `[NEW] apps/server/src/modules/labels/labels.mapper.ts`
- `[NEW] apps/server/src/modules/labels/index.ts`
- `[NEW] apps/server/src/modules/labels/__tests__/labels.service.spec.ts`
- `[NEW] apps/server/src/modules/labels/__tests__/labels.controller.spec.ts`
- `[MODIFY] apps/server/src/app.module.ts` (import `LabelsModule`)

#### 3. Chi tiết Implementation
- **`LabelsService`**:
  - `create(workspaceId, dto)`: kiểm tra trùng `title` trong workspace (`findFirst({ where: { workspaceId, title } })`), throw `ConflictException` nếu trùng. Lưu vào DB, emit `label.created`, trả về `LabelDto`.
  - `list(workspaceId)`: lấy danh sách labels sắp xếp theo `title ASC`.
  - `getById(workspaceId, id)`: tìm label theo `id` và `workspaceId`, throw `NotFoundException` nếu không thấy.
  - `update(workspaceId, id, dto)`: kiểm tra tồn tại, nếu đổi title thì check trùng title, cập nhật, emit `label.updated`.
  - `delete(workspaceId, id)`: kiểm tra tồn tại, xóa label (DB cascade xóa `ConversationLabel`), emit `label.deleted`.
- **`LabelsController`**:
  - `@UseGuards(JwtAuthGuard, WorkspaceGuard)`
  - `GET /api/v1/labels`
  - `POST /api/v1/labels` (`@UseGuards(RolesGuard)`, `@Roles('ADMIN', 'OWNER')`, `@ZodBody(createLabelSchema)`)
  - `GET /api/v1/labels/:id`
  - `PATCH /api/v1/labels/:id` (`@UseGuards(RolesGuard)`, `@Roles('ADMIN', 'OWNER')`, `@ZodBody(updateLabelSchema)`)
  - `DELETE /api/v1/labels/:id` (`@UseGuards(RolesGuard)`, `@Roles('ADMIN', 'OWNER')`)

#### 4. Verification & Tests
- Unit test `labels.service.spec.ts` dùng `node:test` + in-memory Prisma mock:
  - Tạo label thành công, chặn duplicate title trong cùng workspace.
  - Đổi tên label sang tên đã tồn tại -> throw Conflict.
  - List và delete label hoạt động đúng tenant scope.
- Command: `pnpm nx run server:test -- --testPathPattern=labels`

---

### 📋 Task T-1.5.3: Conversation Core Service & State Machine — 🔴 High

#### 1. Mục tiêu
Xây dựng `ConversationsService` quản lý vòng đời hội thoại, State Machine 4 trạng thái, phân công Agent/Team, priority và unread counter.

#### 2. Files tác động
- `[NEW] apps/server/src/modules/conversations/conversations.service.ts`
- `[NEW] apps/server/src/modules/conversations/conversations.mapper.ts`
- `[NEW] apps/server/src/modules/conversations/__tests__/conversations.service.spec.ts`

#### 3. Chi tiết Implementation
- **State Machine Transitions Map**:
  ```typescript
  const ALLOWED_TRANSITIONS: Record<ConversationStatus, ConversationStatus[]> = {
    [ConversationStatus.OPEN]: [ConversationStatus.PENDING, ConversationStatus.SNOOZED, ConversationStatus.RESOLVED],
    [ConversationStatus.PENDING]: [ConversationStatus.OPEN, ConversationStatus.SNOOZED, ConversationStatus.RESOLVED],
    [ConversationStatus.SNOOZED]: [ConversationStatus.OPEN, ConversationStatus.RESOLVED],
    [ConversationStatus.RESOLVED]: [ConversationStatus.OPEN],
  };
  ```
- **Methods trong `ConversationsService`**:
  - `create(workspaceId, dto, tx?)`:
    - Validate `contactId` tồn tại trong Workspace.
    - Validate `inboxId` tồn tại trong Workspace.
    - Nếu có `assigneeId`: validate là `WorkspaceMember` và `InboxMember` của inbox đó.
    - Nếu có `teamId`: validate thuộc workspace.
    - Tạo `Conversation` với `status = OPEN`, `priority = dto.priority || MEDIUM`, `lastActivityAt = now()`.
    - Emit `conversation.created`.
  - `updateStatus(workspaceId, id, dto, tx?)`:
    - Fetch conversation with tenant scope (`id`, `workspaceId`). Throw `NotFoundException` nếu không thấy.
    - Validate transition: `ALLOWED_TRANSITIONS[current.status].includes(dto.status)`. Nếu sai, throw `BadRequestException({ code: 'INVALID_STATUS_TRANSITION', message: ... })`.
    - Nếu `dto.status === 'SNOOZED'`: validate `dto.snoozedUntil` phải là ngày tương lai.
    - Nếu `dto.status !== 'SNOOZED'`: clear `snoozedUntil = null`.
    - Update conversation, emit `conversation.status_updated` (và `conversation.reopened` nếu từ RESOLVED/SNOOZED sang OPEN).
  - `assign(workspaceId, id, dto, assignedByUserId?, tx?)`:
    - Validate conversation tồn tại.
    - Nếu gán `assigneeId`: kiểm tra assignee là thành viên của Inbox (`InboxMember`).
    - Update `assigneeId` và `teamId`, emit `conversation.assigned`.
  - `updatePriority(workspaceId, id, priority, tx?)`:
    - Update `priority`, emit `conversation.priority_updated`.
  - `resetUnreadCount(workspaceId, id)`:
    - Update `unreadMessagesCount = 0`.
  - `findActiveByContactAndInbox(workspaceId, contactId, inboxId)`:
    - Query `findFirst` với status `in: ['OPEN', 'PENDING', 'SNOOZED']`, order by `lastActivityAt DESC`.
  - `list(workspaceId, query)`:
    - Filter theo `status`, `inboxId`, `assigneeId`, `teamId`, `labelId` (qua junction `labels: { some: { labelId } }`).
    - Text search `q` trên Contact `name`, `email`, `phoneNumber`, hoặc message content.
    - Offset pagination (`page`, `limit`), order by `lastActivityAt DESC`.
    - Trả về `{ items, meta }`.
  - `getById(workspaceId, id)`:
    - Return detail bao gồm `contact`, `inbox`, `assignee`, `team`, `labels`, `channelIdentity`.

#### 4. Verification & Tests
- Unit test `conversations.service.spec.ts`:
  - Test đầy đủ 4 trạng thái và mọi cặp transition hợp lệ / không hợp lệ.
  - Test validation assignee phải là InboxMember.
  - Test filter list theo status, inboxId, labelId.
- Command: `pnpm nx run server:test -- --testPathPattern=conversations.service`

---

### 📋 Task T-1.5.4: Conversation Labels & REST Controller — 🟡 Medium

#### 1. Mục tiêu
Hiện thực các API endpoints quản lý Conversation, gán/gỡ nhãn (`ConversationLabel`) và đăng ký `ConversationsModule`.

#### 2. Files tác động
- `[NEW] apps/server/src/modules/conversations/conversations.controller.ts`
- `[NEW] apps/server/src/modules/conversations/conversations.module.ts`
- `[NEW] apps/server/src/modules/conversations/index.ts`
- `[MODIFY] apps/server/src/modules/conversations/conversations.service.ts` (thêm label junction methods)
- `[NEW] apps/server/src/modules/conversations/__tests__/conversations.controller.spec.ts`
- `[MODIFY] apps/server/src/app.module.ts` (import `ConversationsModule`)

#### 3. Chi tiết Implementation
- **Junction Label Methods trong `ConversationsService`**:
  - `assignLabels(workspaceId, conversationId, labelIds[])`:
    - Validate conversation và tất cả labels thuộc cùng `workspaceId`.
    - Idempotent: dùng `prisma.conversationLabel.createMany({ data: [...], skipDuplicates: true })`.
    - Emit `conversation.labels_updated`.
  - `removeLabel(workspaceId, conversationId, labelId)`:
    - Xóa bản ghi trong `conversationLabel` với `where: { conversationId_labelId: { conversationId, labelId } }`.
    - Emit `conversation.labels_updated`.
  - `getLabels(workspaceId, conversationId)`: list labels của conversation.
- **`ConversationsController` Endpoints**:
  - `GET    /api/v1/conversations` — List conversations with query params
  - `POST   /api/v1/conversations` — Create conversation
  - `GET    /api/v1/conversations/:id` — Detail conversation
  - `PATCH  /api/v1/conversations/:id/status` — Update status
  - `PATCH  /api/v1/conversations/:id/assign` — Assign agent/team
  - `PATCH  /api/v1/conversations/:id/priority` — Update priority
  - `POST   /api/v1/conversations/:id/reset-unread` — Reset unread count
  - `GET    /api/v1/conversations/:id/labels` — List conversation labels
  - `POST   /api/v1/conversations/:id/labels` — Assign labels
  - `DELETE /api/v1/conversations/:id/labels/:labelId` — Remove label
- **Guards**: `@UseGuards(JwtAuthGuard, WorkspaceGuard)` trên toàn controller.

#### 4. Verification & Tests
- Unit test `conversations.controller.spec.ts` kiểm tra HTTP status codes, routing và parameter passing.
- Command: `pnpm nx run server:test -- --testPathPattern=conversations`

---

### 📋 Task T-1.5.5: Attachment & Media Storage Integration — 🟡 Medium

#### 1. Mục tiêu
Xây dựng `AttachmentsService` để quản lý file đính kèm đa phương tiện, tích hợp chặt chẽ với `StorageService` (MinIO S3).

#### 2. Files tác động
- `[NEW] apps/server/src/modules/messages/attachments.service.ts`
- `[NEW] apps/server/src/modules/messages/attachments.mapper.ts`
- `[NEW] apps/server/src/modules/messages/__tests__/attachments.service.spec.ts`

#### 3. Chi tiết Implementation
- **MIME Type & File Type Mapping**:
  ```typescript
  const ALLOWED_MIME_TYPES: Record<string, FileType> = {
    'image/jpeg': FileType.IMAGE,
    'image/png': FileType.IMAGE,
    'image/gif': FileType.IMAGE,
    'image/webp': FileType.IMAGE,
    'audio/mpeg': FileType.AUDIO,
    'audio/ogg': FileType.AUDIO,
    'audio/wav': FileType.AUDIO,
    'video/mp4': FileType.VIDEO,
    'video/webm': FileType.VIDEO,
    'application/pdf': FileType.FILE,
    'text/plain': FileType.FILE,
    'text/csv': FileType.FILE,
    'application/zip': FileType.FILE,
    // Office documents
    'application/msword': FileType.FILE,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': FileType.FILE,
    'application/vnd.ms-excel': FileType.FILE,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': FileType.FILE,
  };
  const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
  ```
- **Methods trong `AttachmentsService`**:
  - `validateFile(file: Express.Multer.File | { mimeType: string; size: number })`: kiểm tra size và mime type. Throw `BadRequestException` nếu vi phạm.
  - `uploadAndCreate(workspaceId, messageId, file: Express.Multer.File, tx?)`:
    - Validate file.
    - Generate unique storage key: `attachments/${workspaceId}/${messageId}/${crypto.randomUUID()}-${file.originalname}`.
    - Upload buffer lên S3 qua `StorageService.upload(key, file.buffer, file.mimetype)`.
    - Tạo bản ghi `Attachment` trong DB.
    - Trả về Attachment DTO với download URL.
  - `createFromExternalUrl(messageId, externalData, tx?)`: dùng cho inbound webhook khi platform gửi CDN URL.
  - `deleteByMessageId(messageId, tx?)`: lấy danh sách attachments, xóa objects trên S3, xóa records DB.
  - `getSignedDownloadUrl(attachmentId, workspaceId)`: tạo presigned URL có hạn thông qua `StorageService.getPresignedUrl()`.

#### 4. Verification & Tests
- Unit test `attachments.service.spec.ts`:
  - Test reject file sai MIME type hoặc quá dung lượng.
  - Test upload and create attachment record.
  - Test cleanup S3 files khi delete.
- Command: `pnpm nx run server:test -- --testPathPattern=attachments`

---

### 📋 Task T-1.5.6: Messages Service & Polymorphic Sender Threading — 🔴 High

#### 1. Mục tiêu
Xây dựng `MessagesService` và `MessagesController` quản lý chuỗi hội thoại, polymorphic sender validation, private notes, delivery tracking và atomicity trong Prisma `$transaction`.

#### 2. Files tác động
- `[NEW] apps/server/src/modules/messages/messages.service.ts`
- `[NEW] apps/server/src/modules/messages/messages.controller.ts`
- `[NEW] apps/server/src/modules/messages/messages.module.ts`
- `[NEW] apps/server/src/modules/messages/messages.mapper.ts`
- `[NEW] apps/server/src/modules/messages/index.ts`
- `[NEW] apps/server/src/modules/messages/__tests__/messages.service.spec.ts`
- `[NEW] apps/server/src/modules/messages/__tests__/messages.controller.spec.ts`
- `[MODIFY] apps/server/src/app.module.ts` (import `MessagesModule`)

#### 3. Chi tiết Implementation
- **Polymorphic Sender Invariant (BR-5.1)**:
  - Nếu `senderType === 'CONTACT'`: `senderId` bắt buộc bằng `conversation.contactId`.
  - Nếu `senderType === 'USER'`: `senderId` bắt buộc là User ID hợp lệ trong workspace (`workspace_members`).
  - Nếu `senderType === 'SYSTEM'`: `senderId` bắt buộc là `null`.
- **Content / Attachment Invariant (BR-5.2)**:
  - `content` có thể `null` nếu có ít nhất 1 `attachment`. Nếu không có attachment và `content` rỗng -> Throw `BadRequestException({ code: 'MESSAGE_CONTENT_REQUIRED' })`.
- **`createMessage` Transaction Workflow**:
  ```typescript
  async createMessage(workspaceId, conversationId, dto, files?, tx?) {
    // 1. Fetch conversation & validate workspace scope
    // 2. Validate senderType & senderId (BR-5.1)
    // 3. Run in Prisma transaction:
    //    a. Insert Message record
    //    b. If files: AttachmentsService.uploadAndCreate for each file
    //    c. Update Conversation:
    //       - lastActivityAt = now()
    //       - if CONTACT: unreadMessagesCount += 1; if RESOLVED/SNOOZED -> status = OPEN
    //       - if USER && !isPrivate: unreadMessagesCount = 0; if firstReplyCreatedAt == null -> firstReplyCreatedAt = now(); if status == OPEN -> status = PENDING
    // 4. Emit 'message.created' event
    // 5. Return MessageResponseDto
  }
  ```
- **`listMessages`**:
  - Offset hoặc cursor pagination, sort by `createdAt ASC` (chronological).
  - Filter `isPrivate`: Nếu người gọi không phải là Agent/User trong workspace thì giấu các tin nhắn `isPrivate = true`.
- **`updateDeliveryStatus`**:
  - Cập nhật `deliveryStatus` (`SENT`, `DELIVERED`, `READ`, `FAILED`), emit `message.delivery_status_updated`.
- **`MessagesController` Endpoints**:
  - `GET   /api/v1/conversations/:id/messages`
  - `POST  /api/v1/conversations/:id/messages` (hỗ trợ multipart upload với `@UseInterceptors(FilesInterceptor('attachments'))`)
  - `PATCH /api/v1/messages/:id/delivery-status`

#### 4. Verification & Tests
- Unit test `messages.service.spec.ts`:
  - Test đầy đủ các trường hợp polymorphic sender (Contact, User, System) và reject khi sai senderId.
  - Test auto-reopen conversation khi Contact gửi tin vào conversation RESOLVED.
  - Test unread count tăng/giảm đúng quy tắc.
  - Test private notes không làm đổi trạng thái conversation sang PENDING.
- Command: `pnpm nx run server:test -- --testPathPattern=messages`

---

### 📋 Task T-1.5.7: Inbound Ingestion Pipeline Integration & E2E Validation — 🟡 Medium

#### 1. Mục tiêu
Kết nối hoàn chỉnh luồng Webhook Inbound từ Epic 1.3/1.4 sang Epic 1.5 bên trong `ChannelIngestionProcessor`, đảm bảo tin nhắn từ khách hàng tự động resolve Contact, tìm/tạo Conversation và lưu trữ Message an toàn.

#### 2. Files tác động
- `[MODIFY] apps/server/src/infrastructure/queue/channel-ingestion.processor.ts`
- `[MODIFY] apps/server/src/infrastructure/queue/queue.module.ts`
- `[NEW] apps/server/src/infrastructure/queue/__tests__/channel-ingestion.processor.spec.ts`

#### 3. Chi tiết Implementation
- **Pipeline Orchestration trong `ChannelIngestionProcessor.process(job)`**:
  1. Lấy thông tin `channelId`, `channelEventId`, `payload` từ job.
  2. Lấy Channel và WorkspaceId từ `channelId`.
  3. Gọi `ContactResolutionService.resolveFromChannel(workspaceId, channelId, externalContactId, contactInfo)` để lấy `contact` và `channelIdentity`.
  4. Tìm conversation active: `ConversationsService.findActiveByContactAndInbox(workspaceId, contact.id, channel.inboxId)`.
     - Nếu chưa có hoặc đã RESOLVED: gọi `ConversationsService.create(workspaceId, { contactId: contact.id, inboxId: channel.inboxId, channelIdentityId: channelIdentity.id })`.
  5. Tạo Inbound Message qua `MessagesService.createMessage(...)`:
     - `senderType = CONTACT`, `senderId = contact.id`, `messageType = INCOMING`
     - `externalId = payload.externalMessageId` (ngăn chặn duplicate message)
     - Lưu attachments từ inbound payload nếu có.
  6. Đánh dấu `ChannelEvent.processedAt = now()`.
- **E2E Unit Test**:
  - Giả lập Inbound Webhook event với contact mới -> kiểm tra tạo Contact, ChannelIdentity, Conversation (OPEN) và Message (INCOMING).
  - Giả lập tin nhắn tiếp theo từ cùng Contact -> kiểm tra gom vào cùng Conversation hiện tại.
  - Giả lập tin nhắn khi Conversation đã RESOLVED -> kiểm tra tạo Conversation mới hoặc auto-reopen.

#### 4. Verification & Tests
- Command: `pnpm nx run server:test -- --testPathPattern=channel-ingestion`
- Full test suite: `pnpm nx run server:test`

---

## 5. Definition of Done for Epic 1.5

- [x] Toàn bộ 7 tasks (T-1.5.1 đến T-1.5.7) được implement và unit tests pass 100%.
- [x] Không có circular dependencies giữa `labels`, `conversations`, `messages`, `contacts`, `inboxes`.
- [x] Mọi database query đều có `workspaceId` tenant scope bắt buộc.
- [x] Strict adherence to Business Rules BR-4.1, BR-4.3, BR-5.1, BR-5.2.
- [x] Linter và Build chạy thành công không có lỗi:
  - `pnpm nx run-many -t lint`
  - `pnpm nx run-many -t test`
  - `pnpm nx run-many -t build`
