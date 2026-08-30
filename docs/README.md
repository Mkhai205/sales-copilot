# Sales Copilot Platform — System Documentation Hub

Chào mừng bạn đến với trung tâm tài liệu kỹ thuật, kiến trúc và thiết kế hệ thống của **Sales Copilot Platform**.

Hệ thống tài liệu này định nghĩa toàn bộ tiêu chuẩn kiến trúc, ranh giới domain, mô hình dữ liệu, state machines, contracts và kế hoạch thực thi cho **Phase 1: Omnichannel Conversation Platform Core**.

---

## 📌 1. Lộ trình phân kỳ & Phạm vi (Project Phasing & Scope Guardrail)

Sales Copilot Platform được thiết kế và thực thi theo lộ trình phân kỳ nghiêm ngặt 2 giai đoạn:

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

### 🟢 Phase 1: Omnichannel Conversation Platform Core (CURRENT ACTIVE SCOPE)
- **Mục tiêu**: Xây dựng nền tảng hội thoại đa kênh ổn định, bảo mật và hỗ trợ realtime lấy cảm hứng từ Chatwoot, viết bằng **NestJS 11 + Next.js 16 + PostgreSQL 16 (Prisma 7) + Redis 7 + MinIO S3**.
- **Thực thể cốt lõi**: Chuẩn hóa 21 models cho Multi-tenancy, Inbox & Channels (ràng buộc 1:1), Contacts & Channel Identities (chuẩn 3NF), Conversations & Messages (đa hình sender, private notes), Attachments, Conversation Labels, Canned Responses, Automation Rules, Outbound Webhooks, Teams, và Audit Logs.

### ❄️ Phase 2: Sales Intelligence & AI Copilot (FUTURE EXTENSION - FROZEN)
- **Mục tiêu**: Vòng đời Lead/Opportunity, AI Lead scoring, trích xuất tín hiệu mua hàng (buying signals), bằng chứng bán hàng (sales evidence), copilot decision engine & tool execution.
- ⛔ **QUY TẮC CỐT LÕI**: **Tuyệt đối không tạo models, services, DTOs, tables, hoặc columns cho Phase 2 trong mã nguồn Phase 1.**

---

## 🗺️ 2. Danh mục tài liệu kỹ thuật (Documentation Sitemap)

### 🚀 2.1. Hướng dẫn kiến trúc cốt lõi (Core Architecture Guides)

Bộ tài liệu tổng hợp nhanh 7 phần cốt lõi của hệ thống tại thư mục gốc `docs/`:

| Tài liệu | Mô tả chi tiết |
| :--- | :--- |
| **[01. Architecture Overview](./01-architecture-overview.md)** | Tổng quan kiến trúc Modular Monolith, triết lý thiết kế, multi-tenancy, và luồng dữ liệu chính. |
| **[02. Module Boundaries](./02-module-boundaries.md)** | Bounded Contexts, quyền sở hữu của từng module, chiều phụ thuộc và chuẩn giao tiếp liên module. |
| **[03. Channel Adapters Guide](./03-channel-adapters.md)** | Pipeline tiếp nhận webhook, chống trùng lặp (`ChannelEvent`), mã hóa AES-256-GCM credentials, và adapter specs (Facebook, Telegram, WebChat). |
| **[04. Conversation State Machine](./04-conversation-state-machine.md)** | Vòng đời hội thoại (`OPEN`, `PENDING`, `RESOLVED`, `SNOOZED`), Round-Robin auto-assignment, và đối soát Contact. |
| **[05. Realtime & Event Dispatcher](./05-realtime-and-events.md)** | WebSocket Gateway (Socket.io), Redis Pub/Sub room architecture, và typed domain event schemas. |
| **[06. Operations & Security](./06-operations-and-security.md)** | Động cơ Automation Rules (DSL), Canned Responses, Outbound Webhook Delivery & Retry engine qua BullMQ, RBAC & Security Matrix. |
| **[07. API & Contracts Specification](./07-api-and-contracts.md)** | REST Endpoints, DTO Contracts, Zod Validation Schemas, chuẩn Response Envelope và xử lý lỗi. |

---

### 🎯 2.2. Chi tiết theo từng mảng nghiệp vụ & kỹ thuật

#### 📦 Product & Yêu cầu sản phẩm (`product/`)
- **[Product Vision](./product/vision.md)**: Tầm nhìn sản phẩm, triết lý thiết kế và lộ trình phân kỳ (Phasing Roadmap).
- **[Product Scope](./product/scope.md)**: Phạm vi chi tiết Phase 1 (Active), Phase 2 (Deferred), và các tính năng Out of Scope.
- **[Functional Requirements](./product/requirements.md)**: Đặc tả toàn bộ yêu cầu chức năng (FR) cho Multi-tenancy, Omnichannel Inbox, Conversation & Operations.

#### 🏛️ Domain Model & Quy tắc nghiệp vụ (`domain/`)
- **[Domain Model](./domain/domain-model.md)**: Thiết kế 21 domain models chuẩn hóa (Prisma 7), quan hệ dữ liệu và ràng buộc toàn vẹn.
- **[Business Rules](./domain/business-rules.md)**: Quy tắc nghiệp vụ, ma trận chuyển đổi trạng thái State Machine, và các Invariants học từ Chatwoot.

#### 📐 Kiến trúc giải pháp (`architecture/`)
- **[System Architecture](./architecture/system-architecture.md)**: Sơ đồ kiến trúc tổng thể, luồng Ingestion dữ liệu và phân tách hạ tầng.
- **[Module Architecture](./architecture/module-architecture.md)**: Ranh giới các module (Bounded Contexts), quy tắc gọi chéo và xử lý bất đồng bộ.
- **[Data Architecture](./architecture/data-architecture.md)**: Thiết kế lưu trữ PostgreSQL 16, Redis 7 (Cache + Locks + Pub/Sub), MinIO S3 và mã hóa AES-256-GCM.
- **[Technology Stack](./architecture/technology-stack.md)**: Chi tiết ngăn xếp công nghệ: NestJS 11, Next.js 16, Prisma 7, BullMQ, Tailwind CSS v4.

#### 🔌 Contracts & Giao tiếp (`api/`)
- **[REST API Contract](./api/api-contract.md)**: Chuẩn REST API, Header `X-Workspace-Id`, Response Envelope, Error Format và danh sách Endpoints.
- **[WebSocket Contract](./api/websocket-contract.md)**: Chuẩn WebSocket Realtime, Authentication handshake, cấu trúc Room và typed Event Payloads.

#### 📋 Master Backlog & Kế hoạch thực thi (`backlog/`)
- **[Master Backlog](./backlog/backlog.md)**: Danh sách tổng hợp toàn bộ 12 Epics (`EPIC-1.0` đến `EPIC-1.11`) của Phase 1.
- **Chi tiết từng Epic**:
  - [Epic 1.0: Foundation & Database Baseline](./backlog/epic-1.0-foundation.md)
  - [Epic 1.1: Identity & Multi-Tenancy](./backlog/epic-1.1-identity-tenancy.md)
  - [Epic 1.2: Contact Management](./backlog/epic-1.2-contact-management.md)
  - [Epic 1.3: Channel Platform Foundation](./backlog/epic-1.3-channel-platform.md)
  - [Epic 1.4: Contact Identity Resolution & Merge](./backlog/epic-1.4-contact-identity.md)
  - [Epic 1.5: Conversation & Messaging Core](./backlog/epic-1.5-conversation-messaging.md)
  - [Epic 1.6: Channel Integrations](./backlog/epic-1.6-channel-integrations.md) ([Task Breakdown](./backlog/epic-1.6-task-breakdown.md))
  - [Epic 1.7: Realtime Engine & Presence](./backlog/epic-1.7-realtime-engine.md) ([Task Breakdown](./backlog/epic-1.7-task-breakdown.md))
  - [Epic 1.8: Assignment, Labels & Canned Responses](./backlog/epic-1.8-assignment-operations.md)
  - [Epic 1.9: Automation Rules & Outbound Webhooks](./backlog/epic-1.9-automation-webhooks.md)
  - [Epic 1.10: Frontend Dashboard](./backlog/epic-1.10-frontend-dashboard.md) ([Task Breakdown](./backlog/epic-1.10-task-breakdown.md))
  - [Epic 1.11: Integration & Reliability](./backlog/epic-1.11-integration-reliability.md)

#### 🛠️ Kỹ thuật & Kiểm thử (`engineering/`)
- **[Coding Guidelines](./engineering/coding-guidelines.md)**: Quy chuẩn viết code Clean Architecture, quy tắc chống Over-Engineering, quy ước đặt tên và linting.
- **[Testing Strategy](./engineering/testing-strategy.md)**: Chiến lược kiểm thử tự động (Unit Tests, Service Integration Tests, E2E Vertical Slices).

#### 🔍 Báo cáo Audit & Khắc phục Backend (`audit/`)
- **[Backend Audit Plan](./audit/backend-audit-plan.md)**: Kế hoạch rà soát toàn diện 10 giai đoạn cho backend server.
- **Báo cáo chi tiết từng phần**:
  - [01. Requirement Traceability Report](./audit/01-requirement-traceability-report.md)
  - [02. Architecture & Boundaries Report](./audit/02-architecture-and-boundaries-report.md)
  - [03. Domain & Business Logic Report](./audit/03-domain-and-business-logic-report.md)
  - [04. Database & Persistence Report](./audit/04-database-and-persistence-report.md)
  - [05. API & Contracts Report](./audit/05-api-and-contracts-report.md)
  - [06. Security, Auth & Multi-Tenancy Report](./audit/06-security-auth-and-multi-tenancy-report.md)
  - [07. Realtime WebSocket & Queue Report](./audit/07-realtime-websocket-and-queue-report.md)
  - [08. Error Handling & Observability Report](./audit/08-error-handling-logging-and-observability-report.md)
  - [09. Test Coverage & Quality Report](./audit/09-test-coverage-and-quality-report.md)
  - [10. Master Remediation Plan](./audit/10-master-remediation-plan.md)

#### 📚 Nguồn tham chiếu nghiệp vụ Chatwoot (`references/chatwoot/`)
- **[Chatwoot Reference Guide](./references/chatwoot/README.md)**: Hướng dẫn tra cứu logic nghiệp vụ thực tế từ mã nguồn Chatwoot gốc.
- **[Chatwoot Source Code](./references/chatwoot/source)**: Thư mục chứa toàn bộ mã nguồn Chatwoot đối chiếu (Ruby on Rails + Vue/React).

---

## 🌳 3. Bản đồ cây cấu trúc thư mục (Documentation Tree)

```text
docs/
├── README.md                           # Trung tâm điều hướng và mục lục tổng quan
├── 01-architecture-overview.md         # Tổng quan kiến trúc hệ thống
├── 02-module-boundaries.md             # Ranh giới các module và luồng tương tác
├── 03-channel-adapters.md              # Hướng dẫn Channel Adapters & Webhook Pipeline
├── 04-conversation-state-machine.md    # State Machine & Auto-Assignment
├── 05-realtime-and-events.md           # WebSocket Gateway & Realtime Engine
├── 06-operations-and-security.md       # Automation Rules, Webhooks & Security
├── 07-api-and-contracts.md             # Đặc tả REST API & Response Envelope
│
├── product/                            # Tầm nhìn & Đặc tả yêu cầu
│   ├── vision.md                       # Tầm nhìn sản phẩm & phân kỳ
│   ├── scope.md                        # Phạm vi chi tiết Phase 1 & Phase 2
│   └── requirements.md                 # Yêu cầu chức năng chi tiết
│
├── domain/                             # Thiết kế Domain Nghiệp vụ
│   ├── domain-model.md                 # 21 Domain Models chuẩn hóa (Prisma 7)
│   └── business-rules.md               # Quy tắc nghiệp vụ & State Machines
│
├── architecture/                       # Kiến trúc kỹ thuật chuyên sâu
│   ├── system-architecture.md          # Kiến trúc tổng thể Modular Monolith
│   ├── module-architecture.md          # Ranh giới Bounded Contexts
│   ├── data-architecture.md            # Thiết kế dữ liệu PostgreSQL, Redis, MinIO
│   └── technology-stack.md             # Chi tiết Technology Stack
│
├── api/                                # Hợp đồng giao tiếp (Contracts)
│   ├── api-contract.md                 # Chuẩn REST API & Endpoints
│   └── websocket-contract.md           # Chuẩn WebSocket & Event Schemas
│
├── backlog/                            # Kế hoạch thực thi & Epics
│   ├── backlog.md                      # Master Backlog Phase 1
│   ├── epic-1.0-foundation.md          # Epic 1.0: Foundation & DB Baseline
│   ├── epic-1.1-identity-tenancy.md    # Epic 1.1: Identity & Multi-Tenancy
│   ├── epic-1.2-contact-management.md  # Epic 1.2: Contact Management
│   ├── epic-1.3-channel-platform.md    # Epic 1.3: Channel Platform
│   ├── epic-1.4-contact-identity.md    # Epic 1.4: Contact Identity Resolution
│   ├── epic-1.5-conversation-messaging.md # Epic 1.5: Conversation & Messaging
│   ├── epic-1.6-channel-integrations.md   # Epic 1.6: Channel Integrations
│   ├── epic-1.6-task-breakdown.md         # Task breakdown chi tiết Epic 1.6
│   ├── epic-1.7-realtime-engine.md        # Epic 1.7: Realtime & Presence
│   ├── epic-1.7-task-breakdown.md         # Task breakdown chi tiết Epic 1.7
│   ├── epic-1.8-assignment-operations.md  # Epic 1.8: Assignment, Labels, Canned
│   ├── epic-1.9-automation-webhooks.md    # Epic 1.9: Automation & Outbound Webhooks
│   ├── epic-1.10-frontend-dashboard.md    # Epic 1.10: Frontend Dashboard
│   ├── epic-1.10-task-breakdown.md        # Task breakdown chi tiết Epic 1.10
│   └── epic-1.11-integration-reliability.md # Epic 1.11: E2E & Reliability
│
├── engineering/                        # Quy chuẩn kỹ thuật & Kiểm thử
│   ├── coding-guidelines.md            # Quy tắc viết code & Anti-Overengineering
│   └── testing-strategy.md             # Chiến lược kiểm thử tự động
│
├── audit/                              # Kế hoạch & Báo cáo Audit Backend
│   ├── backend-audit-plan.md           # Kế hoạch Audit 10 giai đoạn
│   └── 01-10-*.md                      # 10 Báo cáo kết quả audit & Kế hoạch khắc phục
│
└── references/                         # Nguồn tham chiếu nghiệp vụ
    └── chatwoot/
        ├── README.md                   # Hướng dẫn tra cứu logic từ Chatwoot
        └── source/                     # Kho mã nguồn Chatwoot gốc
```

---

## ⚡ 4. Nguyên tắc cốt lõi khi phát triển (Core Directives)

Mọi kỹ sư và AI Coding Agent khi tham gia phát triển dự án phải tuân thủ nghiêm ngặt các nguyên tắc trong [AGENTS.md](../AGENTS.md):

1. **Anti-Over-Engineering (KISS & YAGNI)**:
   - Viết mã trực tiếp, dễ đọc, chỉ phục vụ yêu cầu hiện tại.
   - ❌ **Không tạo single-implementation interfaces** (`IUserService`, `IConversationRepository`) khi chỉ có 1 class triển khai.
   - ❌ **Không tạo chuỗi DTO/Mapper 5 tầng** (`Entity -> DomainModel -> ApplicationDTO -> Presenter -> ViewModel`). Dùng Zod schema xác thực đầu vào và trả trực tiếp Prisma model / typed object.
2. **Tenant Isolation Bắt buộc (`workspaceId`)**:
   - Mọi truy vấn đọc, sửa, xóa dữ liệu trong database **bắt buộc phải có `workspaceId` trong mệnh đề `where` của Prisma**.
   - Không tin tưởng ID truyền từ client khi chưa xác thực quyền trong Workspace tương ứng.
3. **Bảo mật thông tin xác thực Kênh (AES-256-GCM)**:
   - Trường `Channel.credentials` phải luôn được mã hóa tại tầng lưu trữ thông qua `ChannelCredentialService`.
   - Tuyệt đối không log, in hoặc trả về plaintext access tokens hay webhook secrets trong response/log.
4. **Học nghiệp vụ từ Chatwoot — Không sao chép kiến trúc Rails**:
   - Tham khảo hành vi nghiệp vụ (cách giải quyết deduplication, webhook HMAC, auto-assignment, state machine).
   - Chuyển đổi thành kiến trúc NestJS / TypeScript chuẩn hóa, không mang các khái niệm ActiveSupport / Concerns sang Node.js.
