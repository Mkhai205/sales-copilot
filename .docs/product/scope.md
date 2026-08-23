# Sales Copilot Platform — Product Scope

## 1. Scope Phasing & Objectives

Sales Copilot Platform được chia thành 2 giai đoạn chiến lược:

```text
Phase 1: Omnichannel Conversation Platform Core (ACTIVE)
  ├── Multi-Tenancy (Workspace, User, Roles)
  ├── Omnichannel Ingestion (Channels, Inboxes 1:1, ChannelEvents)
  ├── Contact & Identity (Contacts, ChannelIdentities 3NF)
  ├── Conversation & Messaging (Conversations, Messages, Attachments, Labels)
  ├── Operations (Canned Responses, Automation Rules, Webhooks, Audit Logs)
  └── Realtime Updates (WebSocket Gateway, Redis Pub/Sub)

Phase 2: Sales Intelligence & AI Copilot (FUTURE SCOPE)
  ├── Lead / Opportunity Lifecycle
  ├── AI Lead Scoring & Buying Signals Extraction
  ├── Copilot Decision Suggestions & Next Best Actions
  └── Autonomous Agent Tool Execution Engine
```

---

## 2. Phase 1 Scope (Current Active)

### 2.1 Multi-Tenancy
- **Workspace**: Tenant isolation boundary (tương đương `Account` trong Chatwoot). Toàn bộ dữ liệu nghiệp vụ bắt buộc gắn liền với `workspaceId`.
- **User & Roles**:
  - `PlatformRole`: `SUPER_ADMIN`, `USER`.
  - `WorkspaceRole`: `OWNER`, `ADMIN`, `AGENT`, `VIEWER`.
- **Teams**: Gom nhóm các Agent trong cùng một Workspace (`Team`, `TeamMember`).

### 2.2 Omnichannel & Ingestion
- **1:1 Inbox to Channel Mapping**: Mỗi `Inbox` gắn với đúng 1 `Channel` (Web Chat, Facebook Messenger, Zalo OA, Telegram, Email).
- **Idempotent Ingestion**: Ghi nhận và chống trùng lặp webhook thông qua `ChannelEvent` (`@@unique([channelId, externalEventId])`).
- **Channel Security**: Toàn bộ access tokens, app secrets trong `Channel.credentials` phải được mã hóa AES-256-GCM.

### 2.3 Contact & Identity Resolution
- **Contact**: Hồ sơ khách hàng duy nhất trong Workspace (`@@unique([workspaceId, identifier])`).
- **ChannelIdentity**: Định danh khách hàng trên từng kênh (`@@unique([channelId, externalContactId])`), hỗ trợ 1 khách hàng kết nối đa kênh.

### 2.4 Conversation & Messaging
- **Conversation Aggregate**: Quản lý vòng đời (`OPEN`, `PENDING`, `RESOLVED`, `SNOOZED`), độ ưu tiên (`URGENT`, `HIGH`, `MEDIUM`, `LOW`), phân công Agent/Team.
- **Message Aggregate**:
  - `senderType`: `[CONTACT, USER, SYSTEM]`.
  - `senderId`: Nullable (cho phép tin nhắn hệ thống `SYSTEM` không cần User/Contact ID).
  - `content`: Nullable (hỗ trợ tin nhắn chỉ đính kèm tệp/hình ảnh).
  - `deliveryStatus`: `PENDING` ──► `SENT` ──► `DELIVERED` ──► `READ` / `FAILED`.
- **Attachments**: Lưu trữ file/ảnh/video/audio trên MinIO S3.
- **ConversationLabel**: Gán nhãn hội thoại M:N qua bảng junction table `conversation_labels`.

### 2.5 Operations & Realtime
- **Canned Responses**: Quản lý mẫu câu trả lời nhanh và tìm kiếm theo shortcode (`/chao`, `/baogia`...).
- **Automation Rules Engine**: Đánh giá và thực thi hành động tự động khi có sự kiện (gán nhãn, phân công team/agent).
- **Outbound Webhooks**: Đăng ký nhận webhook (`WebhookSubscription`) và lưu log gửi/thử lại (`WebhookDelivery`).
- **Audit Logs**: Ghi nhận lịch sử thao tác quản trị và bảo mật.
- **Realtime**: WebSocket Gateway (Socket.io) đồng bộ trạng thái tức thì với Next.js UI.

---

## 3. Explicitly Out of Scope for Phase 1

Các thành phần sau **tuyệt đối không triển khai trong Phase 1**:
- Lead, Opportunity, Deals pipeline.
- AI scoring, Lead stage histories, buying signal extraction models.
- Copilot decisions, tool execution records.
- ERP, kế toán, quản lý kho hàng, marketing automation platform.
