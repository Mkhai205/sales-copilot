# Epic 1.2: Contact Management

## 1. Overview

Hiện thực module quản lý thông tin khách hàng (`Contact`) trong Workspace: tạo mới, tìm kiếm, cập nhật, xóa, với hỗ trợ thuộc tính tùy chỉnh (`customAttributes`, `additionalAttributes`), normalize dữ liệu đầu vào, và phát tán domain events qua `EventEmitter2`.

- **ID**: `EPIC-1.2`
- **Status**: ✅ Done
- **Dependencies**: `EPIC-1.1` (Identity & Multi-Tenancy)
- **References**:
  - `.docs/references/chatwoot/source/app/models/contact.rb`
  - `.docs/references/chatwoot/source/app/controllers/api/v1/accounts/contacts_controller.rb`

### Design Decisions

- **Search**: Sử dụng `ILIKE` đơn giản trên name/email/phone/identifier. Không dùng full-text search (`tsvector`) ở Phase 1.
- **Filtering**: Basic filtering (name, email, phone, createdAt range) + sorting + offset pagination. Không implement advanced filter engine.
- **Events**: Emit `EventEmitter2` events (`contact.created`, `contact.updated`, `contact.deleted`). Consumer/listener triển khai ở Epic 1.7.

---

## 2. Features Summary

| Feature | Tên | Complexity | Lý do | Trạng thái |
| :--- | :--- | :---: | :--- | :---: |
| **F-1.2.1** | Contact CRUD & Custom Attributes | 🟡 **Medium** | CRUD + deep merge customAttributes, ILIKE search, email normalization, domain events, pagination & sorting | ✅ **Done** |

---

## 3. Feature Specifications

---

### 📦 Feature F-1.2.1: Contact CRUD & Custom Attributes — 🟡 Medium

#### Objective

Cung cấp đầy đủ khả năng quản lý khách hàng trong Workspace: tạo mới, xem danh sách (phân trang, tìm kiếm ILIKE, sắp xếp), xem chi tiết, cập nhật thông tin và thuộc tính tùy chỉnh, và xóa Contact.

#### Scope

- Create contact với thông tin cơ bản (name, email, phoneNumber, identifier) và custom attributes
- List contacts với phân trang offset, tìm kiếm ILIKE theo name/email/phone/identifier, sắp xếp theo createdAt/name
- Get contact detail
- Update contact (deep merge `customAttributes` và `additionalAttributes`)
- Delete contact
- Contact search endpoint (`GET /api/v1/contacts/search?q=...`)
- Zod schemas & DTOs cho toàn bộ operations
- Emit domain events: `contact.created`, `contact.updated`, `contact.deleted`

#### Acceptance Criteria

- [x] Contact được tạo thành công với `workspaceId` scope bắt buộc
- [x] `Contact.identifier` duy nhất trong cùng Workspace (`@@unique([workspaceId, identifier])`)
- [x] `Contact.email` normalize thành lowercase trước khi lưu
- [x] Email rỗng (`""`) chuyển thành `null` để tránh lỗi unique index
- [x] Update `customAttributes` thực hiện deep merge (không ghi đè toàn bộ object)
- [x] Search contact hỗ trợ `ILIKE` trên name, email, phoneNumber, identifier
- [x] Mọi query đều include `workspaceId` trong where clause (tenant isolation)
- [x] PhoneNumber validate format E.164 (`/^\+[1-9]\d{1,14}$/`) — allow blank
- [x] REST API endpoints:
  - `GET    /api/v1/contacts` — List (phân trang, sort)
  - `GET    /api/v1/contacts/search` — Search by query string
  - `POST   /api/v1/contacts` — Create
  - `GET    /api/v1/contacts/:id` — Detail
  - `PATCH  /api/v1/contacts/:id` — Update
  - `DELETE /api/v1/contacts/:id` — Delete
- [x] Guards: `JwtAuthGuard` + `WorkspaceGuard` trên tất cả endpoints
- [x] `POST`, `PATCH`, `DELETE` yêu cầu role `ADMIN`, `OWNER` hoặc `AGENT`

#### Dependencies

- `EPIC-1.1` (Identity & Multi-Tenancy — WorkspaceGuard, RolesGuard)
