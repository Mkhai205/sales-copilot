# Domain Model Specification (Phase 1)

## 1. Ubiquitous Language & Core Terminology

| Thuật ngữ | Tiếng Việt | Định nghĩa nghiệp vụ |
| :--- | :--- | :--- |
| **Workspace** | Không gian làm việc / Doanh nghiệp | Tenant isolation boundary cao nhất (tương đương `Account` trong Chatwoot), sở hữu Inboxes, Channels, Contacts, Conversations. |
| **User** | Người dùng hệ thống | Tài khoản nhân sự với `PlatformRole` (`SUPER_ADMIN`, `USER`). |
| **WorkspaceMember** | Thành viên doanh nghiệp | Liên kết giữa User và Workspace với `WorkspaceRole` (`OWNER`, `ADMIN`, `AGENT`, `VIEWER`). |
| **Team** | Đội ngũ | Nhóm các Agent được phân công phụ trách các Inbox hoặc nhóm khách hàng trong Workspace. |
| **Contact** | Khách hàng / Liên hệ | Thực thể khách hàng duy nhất trong Workspace, sở hữu nhiều Channel Identity. |
| **Channel Identity** | Định danh kênh | Danh tính của khách hàng trên một kênh cụ thể (PSID Facebook, Zalo User ID, Email). |
| **Inbox** | Hộp thư tiếp nhận | Đại diện cho một kênh kết nối cụ thể (1:1 với Channel), chứa cấu hình phân công tự động. |
| **Channel** | Kênh tương tác | Cấu hình tích hợp kỹ thuật với nhà cung cấp (Facebook Page, Zalo OA, Telegram, Web Chat). |
| **ChannelEvent** | Sự kiện kênh | Log sự kiện webhook đến dùng để deduplicate và đảm bảo tính idempotent. |
| **Conversation** | Cuộc hội thoại | Phiên tương tác liên tục giữa một Contact và Workspace qua một Inbox. |
| **Message** | Tin nhắn | Đơn vị nội dung giao tiếp (`CONTACT`, `USER`, `SYSTEM`) trong Conversation. |
| **Attachment** | Tệp đính kèm | Tệp đa phương tiện liên kết với Message, lưu trên MinIO S3. |
| **Label** | Nhãn hội thoại | Tag màu dùng để phân loại hội thoại trong Workspace. |
| **ConversationLabel** | Gán nhãn | Bảng junction M:N giữa Conversation và Label. |
| **CannedResponse** | Mẫu trả lời nhanh | Câu trả lời tạo sẵn gắn với shortcode để Agent chèn nhanh vào hội thoại. |
| **AutomationRule** | Quy tắc tự động | Tập luật Trigger ──► Condition ──► Action thực thi tự động khi có sự kiện. |
| **WebhookSubscription** | Đăng ký Webhook | Cấu hình gửi sự kiện ra ngoài hệ thống cho bên thứ 3. |
| **WebhookDelivery** | Lịch sử gửi Webhook | Bản ghi trạng thái và nhật ký gửi webhook cùng cơ chế retry. |
| **AuditLog** | Nhật ký kiểm toán | Ghi nhận các thao tác quản trị và bảo mật trong Workspace. |

---

## 2. Phase 1 Aggregate Structure (21 Models)

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        IDENTITY & MULTI-TENANCY                        │
│                 [Workspace] 1 ──── N [WorkspaceMember]                │
│                      │ 1                   │ N                         │
│                      │                     ▼ 1                         │
│                      │                   [User]                        │
│                      ▼ N                   │ 1                         │
│                   [Team] 1 ─── N [TeamMember]                          │
└──────────────────────┬─────────────────────────────────────────────────┘
                       │ 1
                       ├──────────────────────────┐ 1
                       ▼ N                        ▼ N
┌──────────────────────────────────────┐   ┌─────────────────────────────┐
│       OMNICHANNEL & INGESTION        │   │     CONTACT & IDENTITY      │
│  [Inbox] 1 ─── 1 [Channel]           │   │  [Contact]                  │
│     │ 1              │ 1             │   │     │ 1                     │
│     │                ▼ N             │   │     │                       │
│     │           [ChannelEvent]       │   │     ▼ N                     │
│     ▼ N                              │   │  [ChannelIdentity]          │
│  [InboxMember]                       │   └──────┬──────────────────────┘
└──────┬───────────────────────────────┘          │ 1
       │ 1                                        │
       ▼ N                                        ▼ N
┌────────────────────────────────────────────────────────────────────────┐
│                       CONVERSATION & MESSAGING                         │
│  [Conversation] 1 ────────────────────────────── N [Message]           │
│     │ 1                                               │ 1              │
│     │                                                 ▼ N              │
│     ▼ N                                           [Attachment]         │
│  [ConversationLabel] N ─── 1 [Label]                                   │
└────────────────────────────────────────────────────────────────────────┘
                       │ 1
                       ▼ N
┌────────────────────────────────────────────────────────────────────────┐
│                        OPERATIONS & EXTENSIONS                         │
│  [CannedResponse]      [AutomationRule]      [WebhookSubscription]     │
│                                                       │ 1              │
│                                                       ▼ N              │
│  [AuditLog]                                   [WebhookDelivery]        │
└────────────────────────────────────────────────────────────────────────┘
```
