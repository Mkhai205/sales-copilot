# Sales Copilot Platform — Product Requirements

## 1. Functional Requirements

### 1.1 Multi-Tenancy & Identity (Phase 1 Baseline)
- **FR-1.1**: Hệ thống hỗ trợ phân quyền 2 tầng: `PlatformRole` (`SUPER_ADMIN`, `USER`) và `WorkspaceRole` (`OWNER`, `ADMIN`, `AGENT`, `VIEWER`).
- **FR-1.2**: Mỗi người dùng có thể tham gia vào nhiều Workspace với các vai trò khác nhau.
- **FR-1.3**: Hỗ trợ tạo `Team` và gán thành viên `TeamMember` trong Workspace.

### 1.2 Omnichannel & Ingestion (Phase 1 Baseline)
- **FR-2.1**: Hỗ trợ kết nối kênh 1:1 với `Inbox` (Web Chat, Facebook Messenger, Zalo OA, Telegram, Email).
- **FR-2.2**: Tiếp nhận webhook từ các kênh bên ngoài, xác thực chữ ký (HMAC-SHA256) và chống trùng lặp qua `ChannelEvent`.
- **FR-2.3**: Toàn bộ credentials trong `Channel.credentials` phải được mã hóa AES-256-GCM khi lưu trong database.

### 1.3 Contact & Identity Resolution (Phase 1 Baseline)
- **FR-3.1**: Tự động tìm kiếm hoặc tạo mới `ChannelIdentity` theo `(channelId, externalContactId)`.
- **FR-3.2**: Liên kết `ChannelIdentity` vào `Contact`. Một Contact có thể sở hữu danh tính trên nhiều kênh khác nhau.
- **FR-3.3**: Đảm bảo tính duy nhất của `Contact.identifier` trong phạm vi từng Workspace.
- **FR-3.4**: Hỗ trợ gộp khách hàng (Merge Contacts).

### 1.4 Conversation & Messaging (Phase 1 Baseline)
- **FR-4.1**: Quản lý phiên hội thoại với các trạng thái `OPEN`, `PENDING`, `RESOLVED`, `SNOOZED`.
- **FR-4.2**: Tự động mở lại hội thoại (`OPEN`) khi khách hàng gửi tin nhắn mới trong hội thoại đã `RESOLVED` hoặc `SNOOZED`.
- **FR-4.3**: Hỗ trợ gửi/nhận tin nhắn đa phương tiện (`TEXT`, `IMAGE`, `VIDEO`, `AUDIO`, `FILE`).
- **FR-4.4**: Hỗ trợ tin nhắn dạng ghi chú nội bộ (`isPrivate = true`) chỉ hiển thị cho Agent.
- **FR-4.5**: Theo dõi trạng thái chuyển phát tin nhắn (`PENDING`, `SENT`, `DELIVERED`, `READ`, `FAILED`).
- **FR-4.6**: Hỗ trợ gán nhãn đa dạng cho hội thoại qua `ConversationLabel`.

### 1.5 Auto-Assignment & Operations (Phase 1 Baseline)
- **FR-5.1**: Tự động phân công hội thoại theo thuật toán Round-Robin cho các Agent đang Online trong Inbox (`isAutoAssignmentEnabled = true`).
- **FR-5.2**: Cho phép phân công thủ công cho Agent hoặc Team.
- **FR-5.3**: Hỗ trợ trả lời nhanh với Canned Responses thông qua tìm kiếm shortcode (`/chao`, `/baogia`...).
- **FR-5.4**: Đánh giá và thực thi quy tắc tự động hóa (`AutomationRule`) khi có sự kiện `MESSAGE_CREATED` hoặc `CONVERSATION_OPENED`.
- **FR-5.5**: Phát tán sự kiện ra hệ thống bên ngoài qua Outbound Webhooks với cơ chế tự động thử lại (Exponential Backoff).

### 1.6 Sales Intelligence & AI Copilot (Phase 2 Active)
- **FR-6.1**: Quản lý vòng đời Lead (`NEW`, `CONTACTED`, `QUALIFIED`, `UNQUALIFIED`) và Opportunity pipeline stages.
- **FR-6.2**: Trích xuất tín hiệu mua hàng và bằng chứng bán hàng (BANT ledger) gắn liền với trích dẫn nguyên văn và `messageId`.
- **FR-6.3**: Động cơ tính điểm Lead Scoring kết hợp Fit + Behavior + Độ suy giảm sau 48h không tương tác (time-decay).
- **FR-6.4**: Copilot Assistant gợi ý hành động tiếp theo tốt nhất (Next Best Action) và tạo nháp phản hồi ngữ cảnh (Contextual Draft Reply) theo thời gian thực.
- **FR-6.5**: Giao diện Copilot Assistant Drawer trực quan trên Next.js Dashboard.

---

## 2. Non-Functional Requirements

- **NFR-1 (Realtime Latency)**: Độ trễ phát tán sự kiện qua WebSocket đến Agent Dashboard dưới **200ms**.
- **NFR-2 (Tenant Isolation)**: Đảm bảo 100% các truy vấn cơ sở dữ liệu và kênh WebSocket đều có bộ lọc `workspaceId`.
- **NFR-3 (Idempotency)**: Đảm bảo không trùng lặp tin nhắn khi webhook được gửi lại nhiều lần.
- **NFR-4 (Security)**: Tuyệt đối không lưu plaintext token/secret, áp dụng HMAC verification và JWT token rotation.
- **NFR-5 (Non-Blocking AI Ingestion)**: Inbound message ingestion phản hồi trong `< 100ms`; toàn bộ quá trình phân tích AI và chấm điểm chạy ngầm qua BullMQ.
