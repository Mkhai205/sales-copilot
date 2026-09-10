# Master Roadmap & Execution Dependency Graph (DAG)

## 1. Roadmap Architecture & Phasing

Sales Copilot Platform được phân chia rõ ràng thành 3 Phase chiến lược:

```text
PHASE 1: CONVERSATION PLATFORM CORE (ACTIVE SCOPE)
   │
   ▼ stable events & data foundation
PHASE 2: SALES INTELLIGENCE (FUTURE SCOPE)
   │
   ▼ controlled tools & guardrails
PHASE 3: AUTONOMOUS & ENTERPRISE EXTENSIONS (FUTURE SCOPE)
```

---

## 🗺️ 2. Phase 1 — Master Epic Index

Toàn bộ các Epic của **Phase 1: Conversation Platform Core** được quản lý theo thứ tự thực thi chuẩn (Execution Dependency DAG):

| Epic | Tên Epic | Phạm vi kỹ thuật & Mục tiêu | Epic File | Trạng thái |
| :--- | :--- | :--- | :--- | :---: |
| **Epic 1.0** | **Foundation & Database Baseline** | Monorepo Nx, Docker dev environment, Prisma 21 models & Seed baseline | [📄 `epic-1.0-foundation.md`](./epic-1.0-foundation.md) | ✅ **Done** |
| **Epic 1.1** | **Identity & Multi-Tenancy** | Authentication (Argon2, JWT), Multi-Tenant Workspace & RBAC, Team management | [📄 `epic-1.1-identity-tenancy.md`](./epic-1.1-identity-tenancy.md) | ✅ **Done** |
| **Epic 1.2** | **Contact Management** | Contact CRUD, search, custom attributes, email normalization, domain events | [📄 `epic-1.2-contact-management.md`](./epic-1.2-contact-management.md) | ✅ **Done** |
| **Epic 1.3** | **Channel Platform Foundation** | `ChannelAdapter` abstraction, AES-256 credentials encryption, Inbox & Channel 1:1, InboxMember, Inbound Webhook Pipeline, `ChannelEvent` idempotency, BullMQ queues | [📄 `epic-1.3-channel-platform.md`](./epic-1.3-channel-platform.md) | ✅ **Done** |
| **Epic 1.4** | **Contact Identity Resolution & Merge** | `ChannelIdentity` 3NF, Contact Identification priority chain, `ContactResolutionService`, Atomic Contact Merge Engine | [📄 `epic-1.4-contact-identity.md`](./epic-1.4-contact-identity.md) | ✅ **Done** |
| **Epic 1.5** | **Conversation & Messaging Core** | Label management, Conversation state machine (`OPEN`→`PENDING`→`RESOLVED`→`SNOOZED`), Conversation labels, Message threading, MinIO Attachments | [📄 `epic-1.5-conversation-messaging.md`](./epic-1.5-conversation-messaging.md) | ✅ **Done** |
| **Epic 1.6** | **Channel Integrations** | Web Chat Widget, Facebook Messenger, Telegram Bot | [📄 `epic-1.6-channel-integrations.md`](./epic-1.6-channel-integrations.md) | ✅ **Done** |
| **Epic 1.7** | **Realtime Engine & Presence** | Domain Event Bus, NestJS WebSocket Gateway (Socket.io), Redis Pub/Sub adapter, Online Presence tracking, Realtime Event Dispatcher | [📄 `epic-1.7-realtime-engine.md`](./epic-1.7-realtime-engine.md) | ✅ **Done** |
| **Epic 1.8** | **Assignment, Labels & Canned Responses** | Round-Robin auto-assignment, Manual assignment, Canned Responses shortcode search, Audit Logging | [📄 `epic-1.8-assignment-operations.md`](./epic-1.8-assignment-operations.md) | ✅ **Done** |
| **Epic 1.9** | **Automation Rules & Outbound Webhooks** | Automation Rules Engine (trigger-condition-action DSL), Rule Evaluator & Executor, Outbound Webhook Subscriptions, Webhook Delivery & Retry | [📄 `epic-1.9-automation-webhooks.md`](./epic-1.9-automation-webhooks.md) | ✅ **Done** |
| **Epic 1.10** | **Frontend Dashboard (Next.js)** | Next.js 16 App Shell, 3-column Realtime Conversation view, Live chat composer, Workspace administration settings | [📄 `epic-1.10-frontend-dashboard.md`](./epic-1.10-frontend-dashboard.md) | ✅ **Done** |
| **Epic 1.11** | **Integration & Reliability** | Vertical Slice E2E tests, Healthchecks, Structured JSON Logging, Security Hardening | [📄 `epic-1.11-integration-reliability.md`](./epic-1.11-integration-reliability.md) | ✅ **Done** |

---

## ⛓️ 3. Execution Dependency Graph (DAG)

Quy trình triển khai tuân thủ nghiêm ngặt đồ thị phụ thuộc (DAG):

```text
[Epic 1.0: Foundation & Database] ✅
             │
             ▼
[Epic 1.1: Identity & Multi-Tenancy] ✅
             │
             ▼
[Epic 1.2: Contact Management] ✅
             │
             ▼
[Epic 1.3: Channel Platform Foundation] ✅
             │
             ▼
[Epic 1.4: Contact Identity Resolution & Merge] ✅
             │
             ▼
[Epic 1.5: Conversation & Messaging Core] ✅
             │
             ├────────────────────────────────────────┐
             ▼                                        ▼
[Epic 1.6: Channel Integrations] ✅          [Epic 1.7: Realtime Engine & Presence] ✅
             │                                        │
             └──────────────────┬─────────────────────┘
                                ▼
               [Epic 1.8: Assignment, Labels & Canned Responses] ✅
                                │
                                ▼
               [Epic 1.9: Automation Rules & Outbound Webhooks] ✅
                                │
                                ▼
               [Epic 1.10: Frontend Dashboard (Next.js)] ✅
                                │
                                ▼
               [Epic 1.11: Integration & Reliability] ✅
```

---

## 📌 4. Phân kỳ Phase 2 (Active Scope)

### Phase 2: Conversational Commerce & In-Chat POS (Master Backlog: [📄 `phase-2-backlog.md`](./phase-2-backlog.md))
- **Milestone M1: Core Catalog & Atomic Stock Reservation** (Products, Variants, SKUs, Inventory Locking)
- **Milestone M2: Dynamic VietQR & Instant Webhook Reconciliation** (EMVCo VietQR, Casso/SePay Webhook < 1s)
- **Milestone M3: AI 3-Tier Address Extraction & 1-Click Order Draft** (NER Province/District/Ward resolution)
- **Milestone M4: 24/7 AI Auto-pilot & Guarded Discount Policy Engine** (Midnight auto-checkout, max discount limits)
- **Milestone M5: Anti-theft Realtime Comment Masking** (Facebook comment phone/address masking < 1s)

### ⛔ Prohibited & Deprecated
- External B2B CRM Sync (HubSpot, Salesforce, Pipedrive)
- B2B CRM Pipelines, Deal Stages & B2B Scoring
- Voice / VoIP / SIP integrations

### Deferred Channels (Post-Phase 1)
- **Zalo OA Channel** — `ZaloAdapter` implementation
- **Email Channel** — `EmailAdapter` implementation (IMAP/SMTP or inbound email webhook)
