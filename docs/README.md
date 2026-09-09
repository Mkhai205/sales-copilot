# Sales Copilot Platform — System Documentation Hub

Chào mừng bạn đến với trung tâm tài liệu kỹ thuật, kiến trúc và thiết kế hệ thống của **Sales Copilot Platform**.

---

## 📌 1. Lộ trình phân kỳ & Phạm vi (Project Phasing & Scope Guardrail)

Sales Copilot Platform được thiết kế và thực thi theo lộ trình phân kỳ 3 giai đoạn nghiêm ngặt:

```text
                    Sales Copilot Platform
                           │
              ┌────────────┴────────────┐
              │                         │
       Conversation Core          Sales Intelligence          Autonomous Extensions
     (PHASE 1 - COMPLETED)        (PHASE 2 - ACTIVE)            (PHASE 3 - FUTURE)
              │                         │                               │
       ┌──────┴──────┐          ┌───────┴────────┐              ┌───────┴────────┐
       │             │          │                │              │                │
   Channels      Messaging   Lead/Opportunity    AI          Autonomous       Voice/SIP
   Contacts      Inbox       Scoring             Copilot     Sales Agents     CRM Sync
   Conversation  Teams       Buying Signals      Actions     Tool Registry    Advanced BI
   Assignment    Labels      Sales Evidence      LLM Gateway ...              ...
   Webhooks      Automation  ...                 ...
```

### 🟢 Phase 1: Omnichannel Conversation Platform Core (COMPLETED BASELINE)
- **Trạng thái**: **100% Hoàn thành & Nghiệm thu** ([Biên bản nghiệm thu](./audit/phase-1-completion-signoff.md) — 1.277 automated tests passing).
- **Phạm vi**: Multi-tenancy, Omnichannel Ingestion, 3NF Contact & Channel Identity resolution, Vòng đời Conversation & Message đa hình, Auto-assignment Round-Robin, Canned Responses, Automation Rules, Outbound Webhooks, Realtime WebSocket (Socket.io + Redis Pub/Sub), và Next.js Dashboard.
- ⛔ **QUY TẮC BẤT BIẾN**: Phase 1 APIs, schemas và contracts đã ổn định, **tuyệt đối không refactor làm vỡ Phase 1 baseline**.

### 🟡 Phase 2: Sales Intelligence & AI Copilot (CURRENT ACTIVE SCOPE)
- **Trạng thái**: **Đang triển khai tích cực** ([Master Backlog](./backlog/phase-2-backlog.md)).
- **Phạm vi**:
  - **Milestone 2A (Foundation)**: Epic 2.1 (Lead & Opportunity Core), Epic 2.3 (Multi-Provider LLM Gateway & Prompt Registry).
  - **Milestone 2B (Intelligence & Scoring)**: Epic 2.2 (Sales Evidence & Activity Timeline), Epic 2.4 (Conversation Intelligence Engine via BullMQ), Epic 2.5 (AI Lead Scoring Engine with Time-Decay).
  - **Milestone 2C (Copilot & UI)**: Epic 2.6 (Sales Copilot Assistant Drawer, Next Best Actions, WebSocket streaming).
- ⛔ **QUY TẮC BẢO VỆ**: Tuyệt đối không tạo models, tables, DTOs, hoặc services cho Phase 3 khi đang làm Phase 2.

### ❄️ Phase 3: Autonomous Sales Extensions (FUTURE EXTENSIONS - FROZEN)
- **Trạng thái**: **Đóng băng quy hoạch**.
- **Phạm vi**: Autonomous Sales Agent Execution Loop, Tool Registry & Guardrails, Tích hợp đàm thoại Voice/SIP (WebRTC), và Đồng bộ CRM 2 chiều (HubSpot, Salesforce).

---

## 🗺️ 2. Danh mục tài liệu kỹ thuật (Documentation Sitemap)

### 📐 Kiến trúc hệ thống (`architecture/`)
| Tài liệu | Mô tả chi tiết |
| :--- | :--- |
| **[System Architecture](./architecture/system-architecture.md)** | Tổng quan kiến trúc Pragmatic Modular Monolith, Technology Stack (NestJS, Next.js, Prisma, Redis, MinIO), Ingestion Pipeline và Multi-Tenancy. |
| **[Module Architecture](./architecture/module-architecture.md)** | Ranh giới Bounded Contexts, quyền sở hữu model, chuẩn co-location và quy tắc giao tiếp liên module. |
| **[Channel Adapters](./architecture/channel-adapters.md)** | Kiến trúc adapter kênh (Web Chat, Facebook Messenger, Zalo OA, Telegram), chuẩn hóa webhook và mã hóa AES-256-GCM credentials. |
| **[Operations & Security](./architecture/operations-and-security.md)** | Động cơ Automation Rules, Outbound Webhooks với BullMQ retry, RBAC Matrix và Audit Logging. |
| **[Data Architecture](./architecture/data-architecture.md)** | Thiết kế lưu trữ PostgreSQL 16, Redis 7 (Cache + Locks + Pub/Sub), MinIO S3. |
| **[Phase 2 Architecture](./architecture/phase-2-sales-intelligence.md)** | Kiến trúc chi tiết lớp Sales Intelligence: LLM Gateway, Conversation Intelligence, AI Lead Scoring và Copilot Assistant. |
| **[Phase 2 Schema RFC](./architecture/phase-2-schema-rfc.prisma)** | Đặc tả Prisma Schema mở rộng cho Phase 2 (Leads, Opportunities, SalesEvidence, LeadScores). |

---

### 🏛️ Domain Model & Quy tắc nghiệp vụ (`domain/`)
| Tài liệu | Mô tả chi tiết |
| :--- | :--- |
| **[Domain Model](./domain/domain-model.md)** | Ubiquitous Language và cấu trúc Aggregate 21 models của Phase 1. |
| **[Business Rules & State Machine](./domain/business-rules.md)** | Quy tắc nghiệp vụ, Invariants, State Machine hội thoại (`OPEN`, `PENDING`, `RESOLVED`, `SNOOZED`) và thuật toán Round-Robin. |
| **[Phase 2 Domain Model](./domain/phase-2-domain-model.md)** | Domain model cho Lead, Opportunity, Sales Evidence (BANT), Lead Scoring với 48h Time-Decay. |

---

### 📦 Product & Yêu cầu sản phẩm (`product/`)
| Tài liệu | Mô tả chi tiết |
| :--- | :--- |
| **[Product Vision](./product/vision.md)** | Tầm nhìn sản phẩm Conversation-First, triết lý thiết kế và lộ trình 3 giai đoạn. |
| **[Product Scope](./product/scope.md)** | Phạm vi chi tiết Phase 1 (Baseline), Phase 2 (Active), và Phase 3 (Future). |
| **[Product Requirements](./product/requirements.md)** | Đặc tả toàn bộ yêu cầu chức năng (FR) và phi chức năng (NFR, Ingestion non-blocking < 100ms). |

---

### 🔌 API & Realtime Contracts (`api/`)
| Tài liệu | Mô tả chi tiết |
| :--- | :--- |
| **[REST API Contract](./api/api-contract.md)** | Chuẩn REST API, Header `X-Workspace-Id`, Response Envelope `{ success, data, meta }`, Error codes và danh sách Endpoints. |
| **[WebSocket Contract](./api/websocket-contract.md)** | Chuẩn Socket.io Realtime, cấu trúc Room (`workspace_*`, `conversation_*`, `user_*`), Typed Event Payloads và Internal Domain Events. |
| **[Phase 2 API Spec](./api/phase-2-api-spec.md)** | Toàn bộ API Contracts và DTOs cho Leads, Opportunities, Sales Evidence, Copilot Assistant Drawer. |

---

### 📋 Backlog & Kế hoạch thực thi (`backlog/`)
| Tài liệu | Mô tả chi tiết |
| :--- | :--- |
| **[Phase 2 Master Backlog](./backlog/phase-2-backlog.md)** | Backlog hoạt động chính: Epics 2.1 đến 2.6 cho Sales Intelligence. |
| **[Epic 2.1](./backlog/epic-2.1.md) — [Epic 2.6](./backlog/epic-2.6.md)** | Đặc tả chi tiết từng Epic Phase 2 (Lead/Opp, Timeline, LLM Gateway, Intelligence Engine, Scoring, Copilot UI). |
| **[Phase 1 Master Backlog](./backlog/backlog.md)** | Kế hoạch lịch sử 12 Epics Phase 1 (`epic-1.0` đến `epic-1.11`) đã hoàn thành. |

---

### 🛠️ Kỹ thuật & Kiểm thử (`engineering/` & `guides/`)
| Tài liệu | Mô tả chi tiết |
| :--- | :--- |
| **[Coding Guidelines](./engineering/coding-guidelines.md)** | Tiêu chuẩn viết code Pragmatic Modular Monolith, YAGNI, KISS, quy tắc co-location, Zod pipes và cấm abstraction thừa. |
| **[Testing Strategy](./engineering/testing-strategy.md)** | Chiến lược kiểm thử tự động: Unit Tests, Integration Tests, E2E Vertical Slices. |
| **[Local Testing Guide](./guides/local-testing-guide.md)** | Hướng dẫn chạy môi trường dev và kiểm thử cục bộ với Docker Compose. |
| **[Manual Testing & Features Guide](./test/manual-testing-guide.md)** | Hướng dẫn manual test chi tiết 8 kịch bản thực tế, tổng hợp tính năng, use cases và bug radar. |

---

### 🔍 Nghiệm thu & Tham khảo (`audit/` & `references/`)
| Tài liệu | Mô tả chi tiết |
| :--- | :--- |
| **[Phase 1 Sign-Off Report](./audit/phase-1-completion-signoff.md)** | Báo cáo chứng nhận nghiệm thu chính thức Phase 1 (1.277 tests pass, 0 lỗi TypeScript/Lint). |
| **[Master Remediation Plan](./audit/10-master-remediation-plan.md)** | Danh mục 33 hạng mục cải tiến và hardening đã thực hiện cho Phase 1. |
| **[Chatwoot Reference Guide](./references/chatwoot/README.md)** | Bản đồ đối soát nghiệp vụ hội thoại với mã nguồn Chatwoot chính thức trên GitHub. |
