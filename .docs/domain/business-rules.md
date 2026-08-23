# Business Rules & Invariants (Phase 1)

## 1. Multi-Tenancy Invariants

- **BR-1.1**: Mọi bản ghi dữ liệu hoạt động (`Contact`, `Inbox`, `Channel`, `Conversation`, `Message`, `Label`, `AutomationRule`, `WebhookSubscription`) bắt buộc phải có `workspaceId`.
- **BR-1.2**: Người dùng thực hiện thao tác trên tài nguyên phải là `WorkspaceMember` của Workspace đó và có vai trò (`WorkspaceRole`) hợp lệ.
- **BR-1.3**: `InboxMember` chỉ được thêm những `User` đã là thành viên hợp lệ trong cùng `Workspace`.

---

## 2. Inbound Ingestion & Channel Invariants

- **BR-2.1**: Mỗi `Inbox` chỉ liên kết với tối đa 1 `Channel` (`1:1 mapping`).
- **BR-2.2 (Idempotency)**: Webhook đến phải được kiểm tra `ChannelEvent` theo cặp `(channelId, externalEventId)`. Nếu đã tồn tại thì bỏ qua để tránh trùng lặp tin nhắn.
- **BR-2.3 (Credentials Security)**: Toàn bộ access tokens / app secrets của Channel phải được mã hóa trước khi lưu xuống database và giải mã khi thực hiện gọi outbound API.

---

## 3. Contact & Identity Resolution Invariants

- **BR-3.1**: Khi tin nhắn từ một kênh đổ về:
  1. Tìm `ChannelIdentity` theo `(channelId, externalContactId)`.
  2. Nếu chưa có, tạo mới `Contact` và tạo `ChannelIdentity` liên kết.
  3. Nếu đã có, lấy `Contact` tương ứng.
- **BR-3.2**: `Contact.identifier` phải là duy nhất trong cùng một `Workspace` (`@@unique([workspaceId, identifier])`).
- **BR-3.3**: Khi gộp 2 Contact (Merge), toàn bộ `ChannelIdentity` và `Conversation` của Contact phụ sẽ được chuyển sang Contact chính, sau đó xóa Contact phụ và ghi `AuditLog`.

---

## 4. Conversation State Transitions & Assignment Invariants

- **BR-4.1 (State Machine)**:
  - `OPEN` ──► `PENDING`: Khi Agent gửi tin nhắn phản hồi.
  - `OPEN` ──► `SNOOZED`: Khi Agent đặt lịch tạm ẩn (`snoozedUntil`).
  - `OPEN` / `PENDING` / `SNOOZED` ──► `RESOLVED`: Khi Agent đánh dấu hoàn thành.
  - `RESOLVED` / `SNOOZED` ──► `OPEN`: Tự động kích hoạt khi khách hàng gửi tin nhắn mới.
- **BR-4.2 (Round-Robin Auto-Assignment)**:
  - Nếu `Inbox.isAutoAssignmentEnabled = true` và Conversation chưa có người phụ trách (`assigneeId = null`), hệ thống tự động tìm Agent thuộc `InboxMember` đang **Online** và có số lượng hội thoại `OPEN` ít nhất để gán việc.
- **BR-4.3 (Unread Count)**:
  - Khi có tin nhắn mới từ `CONTACT`, tăng `unreadMessagesCount` lên 1.
  - Khi Agent mở xem hoặc gửi tin nhắn phản hồi, reset `unreadMessagesCount = 0`.

---

## 5. Message Polymorphism & Content Invariants

- **BR-5.1**:
  - `senderType = CONTACT`: `senderId` bắt buộc trỏ về `Contact.id`.
  - `senderType = USER`: `senderId` bắt buộc trỏ về `User.id`.
  - `senderType = SYSTEM`: `senderId` là `null` (tin nhắn hệ thống / activity).
- **BR-5.2**: `Message.content` có thể `null` nếu tin nhắn chứa `Attachment` (hình ảnh, file, voice note).
