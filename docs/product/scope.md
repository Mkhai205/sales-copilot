# Sales Copilot Platform — Product Scope

## 1. Scope Phasing & Objectives

Sales Copilot Platform được phân kỳ chiến lược tập trung vào **Thương Mại Hội Thoại D2C (Conversational Commerce)**:

```text
Phase 1: Omnichannel Conversation Platform Core (COMPLETED BASELINE)
  ├── Multi-Tenancy (Workspace, User, Roles)
  ├── Omnichannel Ingestion (Channels, Inboxes 1:1, ChannelEvents)
  ├── Contact & Identity (Contacts, ChannelIdentities 3NF)
  ├── Conversation & Messaging (Conversations, Messages, Attachments, Labels)
  ├── Operations (Canned Responses, Automation Rules, Webhooks, Audit Logs)
  └── Realtime Engine (WebSocket Gateway, Redis Pub/Sub)

Phase 2: Conversational Commerce & AI Auto-pilot POS (CURRENT ACTIVE SCOPE)
  ├── Built-in In-Chat POS & Inventory (Products, Variants, Atomic Stock Reserve)
  ├── Dynamic VietQR (NAPAS 247) & Instant Bank Webhook Reconciliation (< 1s)
  ├── AI NER 3-Tier Administrative Address Extraction & 1-Click Order Generation
  ├── 24/7 Autonomous AI Auto-pilot & Guarded Discount Policy Engine
  ├── Anti-theft Realtime Comment Masking (< 1s) & Comment-to-Inbox Pipeline
  └── Browser-based Thermal Printing (K80/K58 via @media print)

Phase 3: Autonomous Scale & Advanced Operations (FUTURE SCOPE - FROZEN)
  ├── Autonomous Sales Agent Execution Loop
  ├── Voice / SIP Integration (WebRTC)
  └── Advanced Two-way E-commerce Marketplace Sync (Shopee, TikTok Shop APIs)
```

---

## 2. Phase 1 Scope (Completed Baseline)

- **Multi-Tenancy**: Logical isolation per `Workspace`. Workspace roles (`OWNER`, `ADMIN`, `AGENT`, `VIEWER`).
- **Omnichannel Ingestion**: 1:1 Inbox-to-Channel binding (Web Chat, Facebook Messenger, Zalo OA, Telegram, Email). HMAC verification, AES-256-GCM credential encryption.
- **Contact & Identity Resolution**: Single contact per workspace, multiple channel identities, contact merge support.
- **Conversation & Messaging Core**: Lifecycle states (`OPEN`, `PENDING`, `RESOLVED`, `SNOOZED`), polymorphic message senders (`CONTACT`, `USER`, `SYSTEM`), MinIO S3 attachments, conversation labels.
- **Operations & Realtime**: Canned responses, automation rules engine, outbound webhooks with BullMQ retries, Socket.io realtime clustering.

---

## 3. Phase 2 Scope (Current Active Scope — D2C Conversational Commerce)

- **Built-in In-Chat POS & Inventory Management**: Quản lý biến thể (Size/Màu), SKU, tồn kho khả dụng (`Available = Physical - Reserved`). Tra cứu tồn kho `< 50ms`. Lên đơn trực tiếp qua phím tắt `F4`.
- **Dynamic VietQR & Instant Webhook Bank Reconciliation**: Tự động sinh mã VietQR theo chuẩn NAPAS 247 có logo, số tiền chính xác và memo `DH{code}`. Webhook gạch nợ tự động trong `< 1s` sang `PAID`, triệt tiêu bill giả.
- **AI NER 3-Tier Address Extraction**: Trích xuất SĐT, Tên, Badge nhà mạng và chuẩn hóa địa chỉ 3 cấp (Tỉnh-Huyện-Xã) từ tin nhắn văn bản không cấu trúc, điền đơn trong 1 cú click.
- **24/7 Autonomous AI Auto-pilot**: Tự vấn size, tư vấn mẫu, đàm phán giảm giá/freeship theo hạn mức an toàn của `DiscountPolicyEngine` và tự động chốt đơn lúc 02:00 sáng.
- **Anti-theft Comment Auto-masking**: Tự động ẩn bình luận chứa SĐT `< 1s` chống đối thủ quét cướp khách và tự động gửi tin nhắn riêng (Private Message) kéo khách vào inbox.
- **Browser-based Thermal Printing**: In phiếu gửi K80 (80mm) và K58 (58mm) trực tiếp trên trình duyệt qua `@media print`, không độ trễ hộp thoại in.
- **Agent Collision Prevention**: Khóa hội thoại Redis Distributed Sliding Lock 30 giây khi có nhân viên mở form đơn hàng.

---

## 4. Explicitly Out of Scope & Deprecated for Phase 2

Các thành phần sau **không thuộc phạm vi Phase 2 (đã lưu trữ an toàn tại branch `archive/phase-2-b2b-leads`)**:
- ⛔ **B2B Enterprise CRM & Deal Pipelines**: Phễu bán hàng B2B phức tạp, các giai đoạn đàm phán hợp đồng doanh nghiệp (`PROPOSAL`, `NEGOTIATION`), Win/Loss tracking.
- ⛔ **BANT Sales Evidence Scoring**: Phân tích ma trận thẩm quyền ngân sách BANT, bảng điểm doanh nghiệp theo thời gian.
- ⛔ **External CRM Sync**: Đồng bộ 2 chiều với HubSpot, Salesforce.
- ⛔ **Voice / SIP Integration**: Tích hợp tổng đài thoại WebRTC.
