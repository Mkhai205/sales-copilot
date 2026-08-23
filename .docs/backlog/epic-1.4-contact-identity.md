# Epic 1.4: Contact Identity Resolution & Merge

## 1. Overview

Hiện thực hệ thống định danh đa kênh chuẩn hóa 3NF (`ChannelIdentity`), bộ máy nhận diện đối soát khách hàng (`ContactIdentifyService` — priority chain: `identifier` > `email` > `phoneNumber`), orchestrator phân giải Contact từ kênh inbound (`ContactResolutionService`), và thuật toán gộp khách hàng nguyên tử (`ContactMergeService`).

- **ID**: `EPIC-1.4`
- **Status**: ✅ Done
- **Dependencies**: `EPIC-1.3` (Channel Platform Foundation)
- **References**:
  - `.docs/references/chatwoot/source/app/models/contact_inbox.rb`
  - `.docs/references/chatwoot/source/app/actions/contact_identify_action.rb`
  - `.docs/references/chatwoot/source/app/actions/contact_merge_action.rb`
  - `.docs/references/chatwoot/source/app/builders/contact_inbox_builder.rb`
  - `.docs/references/chatwoot/source/app/controllers/api/v1/accounts/actions/contact_merges_controller.rb`

### Design Decisions

- **Events**: Emit `EventEmitter2` events (`contact.merged`). Consumer/listener triển khai ở Epic 1.7.
- **Transaction**: Contact Merge và Identification logic chạy trong Prisma `$transaction` để đảm bảo tính nguyên tử.

---

## 2. Features Summary

| Feature | Tên | Complexity | Lý do |
| :--- | :--- | :---: | :--- |
| **F-1.4.1** | Channel Identity & Multi-Channel Mapping | 🟡 **Medium** | CRUD + idempotent findOrCreate, transfer batch, cross-workspace validation, REST API |
| **F-1.4.2** | Contact Identification Engine | 🔴 **High** | Priority chain logic phức tạp (identifier > email > phone), conflict guards, auto-merge, Prisma $transaction, core business logic quan trọng nhất |
| **F-1.4.3** | Contact Resolution from Channel | 🟡 **Medium** | Orchestrator service kết hợp ChannelIdentity + ContactIdentify, idempotent, nhưng logic chính delegate |
| **F-1.4.4** | Atomic Contact Merge Engine | 🔴 **High** | Multi-table transfer trong 1 transaction (ChannelIdentity + Conversation + Message), deep merge attributes, AuditLog, rollback safety |

---

## 3. Feature Specifications

---

### 📦 Feature F-1.4.1: Channel Identity & Multi-Channel Mapping — 🟡 Medium

#### Objective

Quản lý bảng `ChannelIdentity` — bản ghi liên kết giữa một `Contact` và danh tính của họ trên một `Channel` cụ thể (PSID Facebook, Telegram Chat ID, Web Chat visitor ID). Mỗi Contact có thể có nhiều ChannelIdentity trên các Channel khác nhau (chuẩn 3NF).

#### Scope

- `ChannelIdentityService`:
  - `findOrCreate(workspaceId, channelId, externalContactId, contactId?, metadata?)` — idempotent
  - `findByChannelAndExternalId(channelId, externalContactId)` — lookup nhanh cho inbound routing
  - `findByContactId(workspaceId, contactId)` — list all identities của một contact
  - `delete(workspaceId, identityId)` — unlink
  - `transferToContact(identityIds[], targetContactId, tx?)` — chuyển identities sang contact khác (phục vụ merge)
- Zod schemas & DTOs cho ChannelIdentity operations
- REST API endpoints (nested under Contact):
  - `GET    /api/v1/contacts/:contactId/identities`
  - `POST   /api/v1/contacts/:contactId/identities`
  - `DELETE /api/v1/contacts/:contactId/identities/:id`

#### Acceptance Criteria

- [x] `ChannelIdentity` enforce unique constraint `@@unique([channelId, externalContactId])`
- [x] `findOrCreate` idempotent: gọi 2 lần cùng params trả về cùng record
- [x] Validate `channelId` thuộc đúng `workspaceId` trước khi tạo
- [x] Contact detail trả về kèm danh sách `ChannelIdentity`
- [x] `transferToContact` update `contactId` cho batch identities trong transaction
- [x] Tạo `ChannelIdentity` với `channelId` không thuộc Workspace hiện tại bị từ chối (`403 Forbidden` / `404 Not Found`)
- [x] Xóa `ChannelIdentity` không xóa Contact
- [x] Guards: `JwtAuthGuard` + `WorkspaceGuard`

#### Dependencies

- `EPIC-1.2` (Contact Management)
- `F-1.3.2` (Inbox & Channel — cần Channel tồn tại)

---

### 📦 Feature F-1.4.2: Contact Identification Engine — 🔴 High

#### Objective

Xây dựng `ContactIdentifyService` — bộ máy nhận diện khách hàng tự động theo chuỗi ưu tiên `identifier` > `email` > `phoneNumber`. Khi nhận thông tin từ kênh bên ngoài (inbound message hoặc SDK setUser), hệ thống tự động: (1) tìm Contact hiện tại, (2) merge nếu phát hiện trùng lặp, (3) update Contact với thông tin mới.

#### Scope

- `ContactIdentifyService.identify(workspaceId, currentContact, params)`:
  - Priority chain logic:
    1. `params.identifier` → tìm Contact khác cùng workspace có `identifier` match → merge
    2. `params.email` → tìm Contact khác có `email` match → merge (trừ khi identifier conflict)
    3. `params.phoneNumber` → tìm Contact khác có `phoneNumber` match → merge (trừ khi email conflict)
    4. Update Contact với params còn lại
  - Conflict guards: không merge nếu existing contact có `identifier` khác
  - Deep merge `customAttributes` và `additionalAttributes`
  - Toàn bộ logic chạy trong Prisma `$transaction`

#### Acceptance Criteria

- [x] Identifier match → merge thành công, Contact phụ bị xóa
- [x] Email match nhưng identifier conflict → không merge, bỏ qua email
- [x] Phone match nhưng email conflict → không merge, bỏ qua phone
- [x] Priority chain: `identifier` > `email` > `phoneNumber`
- [x] Không merge 2 contacts có identifier khác nhau
- [x] `customAttributes` deep merge hoạt động đúng
- [x] Transaction rollback nếu bất kỳ bước nào thất bại
- [x] Emit event `contact.merged` khi merge xảy ra

#### Dependencies

- `F-1.4.1` (Channel Identity)
- `F-1.4.4` (Contact Merge Service — sử dụng merge engine)

---

### 📦 Feature F-1.4.3: Contact Resolution from Channel — 🟡 Medium

#### Objective

Xây dựng `ContactResolutionService` — service orchestrator cho luồng inbound message: lookup `ChannelIdentity` → resolve/create `Contact` → trả về kết quả. Service này được gọi bởi Channel Ingestion Pipeline (Epic 1.3 worker) khi nhận webhook inbound.

#### Scope

- `resolveFromChannel(workspaceId, channelId, externalContactId, contactInfo?)`:
  - Return `{ contact, channelIdentity, isNewContact }`
  - Flow:
    1. Lookup `ChannelIdentity` by `(channelId, externalContactId)`
    2. Nếu có → lấy Contact, optionally run `ContactIdentifyService` nếu có thêm info
    3. Nếu chưa có → tạo Contact mới + tạo ChannelIdentity link
  - Idempotent: gọi nhiều lần cùng params trả về cùng kết quả

#### Acceptance Criteria

- [x] Inbound message lần đầu → tạo Contact + ChannelIdentity, return `isNewContact: true`
- [x] Inbound message lần hai cùng `externalContactId` → trả về existing, `isNewContact: false`
- [x] Nếu `contactInfo.email` được cung cấp → trigger identify logic để enrich/merge
- [x] Business rule BR-3.1 được implement chính xác
- [x] Tenant isolation: resolution trong Workspace A không ảnh hưởng Workspace B

#### Dependencies

- `F-1.4.1` (Channel Identity)
- `F-1.4.2` (Contact Identification Engine)

---

### 📦 Feature F-1.4.4: Atomic Contact Merge Engine — 🔴 High

#### Objective

Cung cấp `ContactMergeService` — engine gộp 2 Contact trong cùng Workspace thành 1. Chuyển toàn bộ `ChannelIdentity`, `Conversation` và `Message` (sender) từ Contact phụ (mergee) sang Contact chính (base), xóa mergee và ghi `AuditLog`. Toàn bộ trong 1 Prisma `$transaction`.

#### Scope

- `ContactMergeService.merge(workspaceId, baseContactId, mergeeContactId)`:
  - Transaction steps:
    1. Validate cả 2 contacts tồn tại và thuộc cùng workspace
    2. Transfer `ChannelIdentity` records (mergee → base)
    3. Transfer `Conversation` records (mergee → base)
    4. Transfer `Message` records (senderType=CONTACT, senderId=mergee → base)
    5. Deep merge attributes (base ưu tiên giữ lại)
    6. Delete mergee contact
    7. Create `AuditLog` entry
  - Emit `contact.merged` event sau transaction commit
- Zod schema cho merge request
- REST API endpoint: `POST /api/v1/contacts/merge`

#### Acceptance Criteria

- [x] Merge thành công trong single Prisma `$transaction`
- [x] Base contact giữ nguyên attributes đã có, chỉ bổ sung từ mergee
- [x] Tất cả ChannelIdentity, Conversation, Message của mergee chuyển sang base
- [x] Mergee bị xóa khỏi database
- [x] `AuditLog` ghi nhận merge action (`baseContactId`, `mergeeContactId`)
- [x] Merge 2 contacts khác workspace → `404 Not Found` (tenant-scoped lookup trả not found vì lý do bảo mật, không leak thông tin contact tồn tại ở workspace khác)
- [x] Self-merge (cùng contactId) → REST API reject ở schema validation layer (`400`); service handle gracefully cho programmatic callers (trả về contact hiện tại, không merge)
- [x] Chỉ `ADMIN` và `OWNER` được phép merge contacts
- [x] Transaction rollback hoàn toàn nếu bất kỳ step nào fail

#### Dependencies

- `F-1.4.1` (Channel Identity — `transferToContact`)
- `EPIC-1.2` (Contact Management — Contact CRUD)
