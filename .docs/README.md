# Sales Copilot Platform — Documentation Index

Chào mừng bạn đến với hệ thống tài liệu kỹ thuật và thiết kế sản phẩm của **Sales Copilot Platform**.

---

## 🗺️ 1. Bản đồ cấu trúc tài liệu (Documentation Tree)

```text
.docs/
├── README.md                           # Mục lục tổng quan và hướng dẫn tra cứu tài liệu
│
├── product/                            # Tầm nhìn, phạm vi và yêu cầu sản phẩm
│   ├── vision.md                       # Tầm nhìn sản phẩm, triết lý và định hướng cốt lõi (Phasing roadmap)
│   ├── scope.md                        # Phạm vi Phase 1 (Active) & Phase 2 (Deferred), Out of Scope
│   └── requirements.md                 # Đặc tả yêu cầu chi tiết Phase 1 (Multi-tenancy, Omnichannel, Conversation)
│
├── domain/                             # Thiết kế nghiệp vụ theo phương pháp DDD
│   ├── domain-model.md                 # Mô hình Domain (21 models chuẩn hóa cho Conversation Core)
│   └── business-rules.md               # Quy tắc nghiệp vụ, State Machines, Chatwoot Invariants & Guardrails
│
├── architecture/                       # Kiến trúc kỹ thuật và giải pháp hệ thống
│   ├── system-architecture.md          # Kiến trúc tổng thể Modular Monolith, luồng Ingestion dữ liệu
│   ├── module-architecture.md          # Ranh giới các module (Bounded Contexts) và luật phụ thuộc
│   ├── data-architecture.md            # Thiết kế dữ liệu PostgreSQL 16, Redis 7, MinIO S3 & Encryption
│   └── technology-stack.md             # Ngăn xếp công nghệ (NestJS 11, Next.js 16, Prisma 6, BullMQ)
│
├── api/                                # Đặc tả hợp đồng giao tiếp (Contracts)
│   ├── api-contract.md                 # Chuẩn REST API, Header, Envelope, Error Schema và Endpoints
│   └── websocket-contract.md           # Chuẩn WebSocket Realtime, Authentication, Rooms và Event Payloads
│
├── engineering/                        # Quy chuẩn kỹ thuật, kiểm thử và kế hoạch thực thi
│   ├── backlog.md                      # Master Backlog Phase 1 chia theo Sprint / Epic / Task chi tiết
│   ├── coding-guidelines.md            # Quy tắc viết mã, phân lớp Clean Architecture, quy ước đặt tên
│   └── testing-strategy.md             # Chiến lược kiểm thử (Unit, Integration, E2E, Contract)
│
└── references/                         # Nguồn tham khảo nghiệp vụ
    └── chatwoot/
        ├── README.md                   # Hướng dẫn tra cứu logic nghiệp vụ từ mã nguồn Chatwoot
        └── source/                     # Kho mã nguồn Chatwoot gốc (Rails + Vue/React + Swagger)
```

---

## 📌 2. Phân kỳ lộ trình (Project Phasing & Scope Guardrail)

```text
                    Sales Copilot Platform
                           │
              ┌────────────┴────────────┐
              │                         │
       Conversation Core          Sales Intelligence
       (PHASE 1 - ACTIVE)        (PHASE 2 - FUTURE)
              │                         │
       ┌──────┴──────┐          ┌───────┴────────┐
       │             │          │                │
   Channels      Messaging   Lead/Opportunity    AI
   Contacts      Inbox       Scoring             Copilot
   Conversation  Teams       Buying Signals      Actions
   Assignment    Labels      Sales Evidence      ...
   Webhooks      Automation
```

### Phase 1: Omnichannel Conversation Platform Core (CURRENT ACTIVE SCOPE)
- Tập trung xây dựng nền tảng hội thoại đa kênh ổn định, bảo mật và hỗ trợ realtime lấy cảm hứng từ Chatwoot.
- Database gồm đúng **21 models cốt lõi**, 1:1 Inbox-Channel binding, 3NF ChannelIdentity, AES-256-GCM encrypted credentials, và phân quyền Multi-tenant.

### Phase 2: Sales Intelligence & AI Copilot (FUTURE EXTENSION)
- Triển khai sau khi Conversation Core hoàn thiện: Lead lifecycle, AI lead scoring, buying signals extraction, sales evidence, copilot decisions & tool execution engine.
- **Tuyệt đối không đưa Lead/AI models vào mã nguồn và database trong Phase 1.**

---

## 🔍 3. Nguồn tham khảo Chatwoot Source (`references/chatwoot/source`)

Thư mục [`.docs/references/chatwoot/source/`](file:///d:/workspace/Sales%20Copilot/.docs/references/chatwoot/source) lưu trữ mã nguồn Chatwoot gốc.
- **Mục đích**: Tra cứu business rules thực tế (Webhook verification, contact resolution, conversation status transitions, assignment logic).
- **Nguyên tắc**: Tham khảo hành vi nghiệp vụ (Business Behavior), **không sao chép kiến trúc Rails/ActiveRecord sang NestJS/TypeScript**.
