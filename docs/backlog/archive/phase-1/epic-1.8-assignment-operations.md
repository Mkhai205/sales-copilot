# Epic 1.8: Assignment, Labels & Canned Responses

## 1. Overview

Hiện thực các nghiệp vụ vận hành cốt lõi: thuật toán phân công tự động luân phiên (Round-Robin Auto-Assignment dựa trên Online Presence và Open Conversations), phân công thủ công Agent/Team, mẫu câu trả lời nhanh (Canned Responses), và hệ thống nhật ký kiểm toán xuyên suốt (Cross-cutting Audit Logging).

- **ID**: `EPIC-1.8`
- **Status**: ✅ Done
- **Dependencies**: `EPIC-1.5` (Conversation Core), `EPIC-1.7` (Realtime & Presence)
- **References**:
  - `docs/references/chatwoot/source/app/services/auto_assignment/`
  - `docs/references/chatwoot/source/app/models/canned_response.rb`

---

## 2. Features Summary

| Feature | Tên | Complexity | Lý do |
| :--- | :--- | :---: | :--- |
| **F-1.8.1** | Round-Robin Auto-Assignment Engine | 🟡 **Medium** | Algorithm round-robin + presence query + conversation count, event-driven trigger, nhiều edge cases (no agent online, already assigned) |
| **F-1.8.2** | Manual Assignment | 🟢 **Low** | Simple update + event emission, validation cơ bản |
| **F-1.8.3** | Canned Responses | 🟢 **Low** | Simple CRUD + prefix search, ít business logic |
| **F-1.8.4** | Audit Logging | 🟢 **Low** | Cross-cutting service, event-driven, immutable records |

---

## 3. Feature Specifications

---

### 📦 Feature F-1.8.1: Round-Robin Auto-Assignment Engine — 🟡 Medium

#### Objective

Hiện thực thuật toán tự động phân công hội thoại mới cho Agent theo luân phiên (Round-Robin), dựa trên trạng thái Online Presence và số lượng conversation `OPEN` hiện tại của mỗi Agent trong Inbox.

#### Scope

- `AutoAssignmentService.assignConversation(workspaceId, conversation)`:
  1. Kiểm tra `Inbox.isAutoAssignmentEnabled`
  2. Lấy danh sách `InboxMember` agents đang `ONLINE` (từ Presence — Epic 1.7)
  3. Đếm số conversation `OPEN` của mỗi agent
  4. Chọn agent có ít conversation `OPEN` nhất (Round-Robin tiebreaker)
  5. Gán `conversation.assigneeId = selectedAgent.id`
- Event-driven trigger: listen `conversation.created` event
- Skip assignment nếu conversation đã có `assigneeId`
- Skip assignment nếu không có agent online

#### Acceptance Criteria

- [x] Conversation mới trong Inbox có `isAutoAssignmentEnabled = true` → tự động gán Agent
- [x] Chỉ chọn Agent đang `ONLINE` trong `InboxMember` list
- [x] Agent có ít `OPEN` conversations nhất được chọn (BR-4.2)
- [x] Conversation đã có assignee → skip auto-assignment
- [x] Không có agent online → conversation giữ `assigneeId = null` (unassigned)
- [x] `isAutoAssignmentEnabled = false` → skip auto-assignment
- [x] Emit event `conversation.assigned` sau khi gán thành công

#### Dependencies

- `F-1.3.2` (Inbox & Channel — `InboxMember`, `isAutoAssignmentEnabled`)
- `F-1.7.4` (Agent Online Presence Tracking)
- `EPIC-1.5` (Conversation Core)

---

### 📦 Feature F-1.8.2: Manual Assignment — 🟢 Low

#### Objective

Cung cấp API cho Agent/Admin gán hoặc đổi assignee (Agent) và/hoặc Team cho Conversation.

#### Scope

- Assign Agent cho conversation: `PATCH /api/v1/conversations/:id/assign` (đã define ở F-1.5.2, implement logic ở đây)
- Assign Team cho conversation
- Unassign (set assigneeId/teamId = null)
- Emit event `conversation.assigned` khi assignment thay đổi

#### Acceptance Criteria

- [x] Gán Agent thành công → `assigneeId` updated, event emitted
- [x] Gán Team thành công → `teamId` updated, event emitted
- [x] Agent phải là `WorkspaceMember` của cùng Workspace
- [x] Unassign thành công (set null)
- [x] WebSocket broadcast assignment change tới old assignee + new assignee

#### Dependencies

- `EPIC-1.5` (Conversation Core)
- `F-1.7.5` (Realtime Event Dispatcher — broadcast assignment)

---

### 📦 Feature F-1.8.3: Canned Responses — 🟢 Low

#### Objective

Quản lý mẫu câu trả lời nhanh (Canned Responses) trong Workspace, hỗ trợ tìm kiếm theo shortcode để Agent chèn nhanh vào hội thoại (e.g., `/chao`, `/baogia`).

#### Scope

- CRUD Canned Response (shortCode, content)
- Tìm kiếm nhanh theo shortcode prefix: `GET /api/v1/canned-responses?search=/chao`
- Shortcode normalization (lowercase, strip leading `/`)
- Zod schemas & DTOs

#### Acceptance Criteria

- [x] Canned Response tạo thành công với `workspaceId` scope
- [x] Shortcode duy nhất trong cùng Workspace (`@@unique([workspaceId, shortCode])`)
- [x] Search by shortcode prefix trả về kết quả matching (e.g., `/bao` → `/baogia`, `/baohiem`)
- [x] REST API endpoints:
  - `GET    /api/v1/canned-responses` — List (with optional search query)
  - `POST   /api/v1/canned-responses` — Create
  - `PATCH  /api/v1/canned-responses/:id` — Update
  - `DELETE /api/v1/canned-responses/:id` — Delete
- [x] Guards: `JwtAuthGuard` + `WorkspaceGuard`; CUD yêu cầu `ADMIN`, `OWNER` hoặc `AGENT`
- [x] Tenant isolation: mọi query include `workspaceId`

#### Dependencies

- `EPIC-1.1` (Identity)

---

### 📦 Feature F-1.8.4: Audit Logging — 🟢 Low

#### Objective

Xây dựng cross-cutting `AuditLogService` ghi nhận các thao tác quản trị và bảo mật quan trọng trong Workspace.

#### Scope

- `AuditLogService.log(workspaceId, action, actorId, resourceType, resourceId, metadata?)`:
  - Action types: `MEMBER_ADDED`, `MEMBER_REMOVED`, `ROLE_CHANGED`, `CONTACT_MERGED`, `CHANNEL_CREATED`, `CHANNEL_DELETED`, `INBOX_CREATED`, `AUTOMATION_TRIGGERED`, etc.
- Event-driven: listen domain events và tự động ghi audit log
- List audit logs: `GET /api/v1/audit-logs` (phân trang, filter by action/actor/resource)
- Immutable records (không cho update/delete)

#### Acceptance Criteria

- [x] Audit log ghi nhận đầy đủ: action, actorId, resourceType, resourceId, metadata, timestamp
- [x] Audit logs là immutable — không có API update/delete
- [x] List endpoint hỗ trợ filter by action type, actor, date range
- [x] REST API endpoints:
  - `GET /api/v1/audit-logs` — List audit logs (filter, phân trang)
- [x] Guards: `JwtAuthGuard` + `WorkspaceGuard`; chỉ `ADMIN` và `OWNER` xem được
- [x] Tenant isolation: mọi query include `workspaceId`

#### Dependencies

- `EPIC-1.1` (Identity)
