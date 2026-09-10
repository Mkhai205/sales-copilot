# System Architecture & Technology Stack

## 1. System Philosophy & Objectives

Sales Copilot Platform is built as a **high-performance, event-driven modular monolith** designed to provide an enterprise-grade omnichannel conversation and sales engagement backbone.

The design philosophy adheres to:
1. **Conversation-First**: Realtime interaction and reliable messaging ingestion are the primary product drivers.
2. **Strict Multi-Tenancy**: Logical isolation per `Workspace` across all operational queries and websocket broadcasts.
3. **Parity with Chatwoot Business Logic**: Adopting proven conversation management patterns while translating them cleanly to modern TypeScript / NestJS / Next.js conventions without Rails legacy debt.
4. **Resilience & Idempotency**: Distributed webhooks, concurrent message processing, and retries are resilient against duplicates and transient failures.
5. **Pragmatic Modular Monolith (Anti-Overengineering)**: Direct, cohesive NestJS Services and Prisma Client queries. No premature microservices, no single-implementation interface bloat.

---

## 2. High-Level System Architecture

```text
┌────────────────────────────────────────────────────────┐
│               Frontend: Next.js 16 (App Router)        │
│          React 19, TypeScript, Tailwind CSS v4, Base UI│
└───────────────────────────┬────────────────────────────┘
                            │ REST API / WebSocket (Socket.io)
┌───────────────────────────▼────────────────────────────┐
│               Backend: NestJS 11 (Modular Monolith)    │
│       Controllers ──► Application Services (Prisma)    │
└─────────┬─────────────────┬──────────────────┬─────────┘
          │                 │                  │
          ▼                 ▼                  ▼
┌──────────────────┐┌───────────────┐┌──────────────────┐
│  PostgreSQL 16   ││    Redis 7    ││     MinIO S3     │
│   (Prisma ORM)   ││ (Pub/Sub + Q) ││ (Object Storage) │
└──────────────────┘└───────────────┘└──────────────────┘
```

---

## 3. Technology Stack

| Layer | Technology | Version / Spec | Role & Purpose |
| :--- | :--- | :--- | :--- |
| **Backend Framework** | NestJS | 11.2+ | Modular Monolith REST API, WebSocket Engine & BullMQ Workers |
| **Language** | TypeScript | 5.8+ | Strict type safety across the entire monorepo |
| **ORM / Data Access** | Prisma ORM | 7.9+ (`@prisma/adapter-pg`) | Type-safe database client with PostgreSQL connection pooling |
| **Relational Database** | PostgreSQL | 16+ | ACID transactional database, source of truth with tenant indexes |
| **In-Memory & Cache** | Redis | 7.2+ | WebSocket Pub/Sub clustering, distributed locks, presence tracking |
| **Background Queues** | BullMQ | Latest | Async ingestion, webhook retry engine, AI extraction queue |
| **Object Storage** | MinIO S3 | S3 API | Attachment storage (images, video, voice notes, documents) |
| **Frontend Framework** | Next.js | 16+ (App Router, Turbopack) | Agent dashboard, conversation views, admin settings |
| **UI System** | Tailwind CSS & Base UI | Tailwind v4, Radix/Base UI | High-performance styling and pre-built Shadcn primitives |
| **Monorepo Tooling** | Nx | 23+ | Monorepo workspace orchestration and caching |

---

## 4. Backend Application Architecture (`apps/server`)

```text
apps/server/
├── prisma/                                  # Database Schema & CLI Lifecycle
│   ├── schema.prisma                        # PostgreSQL Data Model (Prisma 7)
│   ├── migrations/                          # SQL Migration History
│   └── seed.ts                              # Baseline Seed Script
│
├── prisma.config.ts                         # Prisma 7 Configuration
│
└── src/
    ├── main.ts                              # NestJS Bootstrap & Swagger (/docs)
    ├── app.module.ts                        # Root Application Module
    │
    ├── common/                              # Framework Primitives & Cross-Cutting Concerns
    │   ├── decorators/                      # @CurrentUser(), @CurrentWorkspace()
    │   ├── guards/                          # AuthGuard, WorkspaceGuard, RolesGuard
    │   ├── filters/                         # HttpExceptionFilter (RFC 7807 compliant envelope)
    │   ├── interceptors/                    # TransformInterceptor, LoggingInterceptor
    │   └── pipes/                           # ZodValidationPipe
    │
    ├── infrastructure/                      # Shared Persistence & External Adapters
    │   ├── database/                        # PrismaService (pg.Pool driver adapter)
    │   ├── redis/                           # Redis Client & Distributed Locks
    │   ├── queue/                           # BullMQ Queue Workers & Job Processors
    │   └── storage/                         # MinIO S3 Object Storage Service
    │
    ├── modules/                             # Cohesive Feature Modules
    │   ├── auth/                            # Login, Register, JWT, Refresh Token
    │   ├── workspaces/                      # Multi-tenant Workspaces & Memberships
    │   ├── users/                           # User profile & Platform Roles
    │   ├── teams/                           # Team assignment & Team Members
    │   ├── inboxes/                         # Inbox management & Inbox Members
    │   ├── contacts/                        # Contacts & Channel Identities resolution
    │   ├── conversations/                   # Conversation lifecycle, status & priorities
    │   ├── messages/                        # Inbound/Outbound Messages & Attachments
    │   ├── labels/                          # Conversation Labels & Tags
    │   ├── canned-responses/                # Quick reply canned responses (/shortCode)
    │   ├── automation-rules/                # Event-driven rule evaluation & auto-assign
    │   ├── webhooks/                        # Outbound Webhook Subscriptions & Retries
    │   ├── realtime/                        # WebSocket Gateway & Realtime Event Dispatcher
    │   ├── llm-gateway/                     # Multi-provider LLM integration (Gemini, OpenAI, Anthropic, DeepSeek)
    │   └── pos/                             # Built-in In-Chat POS & Mini Inventory Subsystem
    │       ├── catalog/                     # Products, Variants, SKUs
    │       ├── orders/                      # POS Orders, State Machine, Atomic Stock Reservation
    │       ├── vietqr/                      # Dynamic VietQR Generator (NAPAS 247)
    │       ├── reconciliation/              # Instant Bank Webhook Reconciliation (<1s)
    │       ├── shipping/                    # 3PL Carriers (GHN, GHTK) & Thermal Waybills
    │       └── listeners/                   # POS Event Listeners & WebSocket Dispatch
    │
    └── integrations/                        # Omnichannel Ingestion Adapters
        ├── web-chat/                        # Live Web Chat Widget Ingestion
        ├── facebook/                        # Facebook Messenger Webhook & Send API
        ├── zalo/                            # Zalo OA Webhook & Send API
        ├── telegram/                        # Telegram Bot Webhook & Send API
        └── email/                           # Inbound/Outbound Email Adapter
```

---

## 5. End-to-End Inbound Ingestion Pipeline

```text
[External Customer]
      │ (Sends message via Web Chat / FB Messenger / Zalo / Telegram)
      ▼
[Webhook Endpoint / Controller] (/api/v1/channels/:id/webhook)
      │
      ├── 1. Signature Verification (HMAC-SHA256)
      │
      ├── 2. Ingestion Deduplication (ChannelEvent @@unique([channelId, externalEventId]))
      │
      ├── 3. Ingestion Queue (BullMQ Async Processor: acknowledge < 100ms)
            │
            ├── 4. Contact & ChannelIdentity Resolution
            │     - Find/create ChannelIdentity by (channelId, externalContactId)
            │     - Associate/resolve Contact
            │
            ├── 5. Conversation Resolution
            │     - Find existing OPEN/SNOOZED conversation or create new
            │     - If SNOOZED/RESOLVED + customer replies ──► Re-open to OPEN
            │
            ├── 6. Message Persistence & Delivery Tracking
            │     - Insert Message (senderType: CONTACT, deliveryStatus: DELIVERED)
            │     - Save any Attachments (MinIO S3)
            │
            ├── 7. Auto-Assignment Trigger (Round-Robin online agents if unassigned)
            │
            ├── 8. Automation Rules Evaluation (Condition matching & Action execution)
            │
            ├── 9. Outbound Webhook Subscriptions Dispatch
            │
            ├── 10. Realtime Event Broadcast (WebSocket room: `workspace_${workspaceId}`)
            │
            └── 11. (Phase 2) Async AI Ingestion: AI NER 3-tier address & order draft extraction via BullMQ
```

---

## 6. Multi-Tenancy Architecture

All operational entities belong to a single tenant identified by `Workspace.id`.

### Multi-Tenancy Rules:
1. **Global Platform Roles vs Tenant Roles**:
   - `User.role`: `SUPER_ADMIN` (Platform level) vs `USER` (Standard platform user).
   - `WorkspaceMember.role`: `OWNER`, `ADMIN`, `AGENT`, `VIEWER` (Role within the specific workspace).
2. **Tenant Scoping (Mandatory)**:
   - Every read, update, delete, or lookup for workspace resources MUST filter by `workspaceId` in the Prisma query.
   - Enforced by NestJS Guards (`WorkspaceGuard`) and Service layer logic.
3. **Globally Unique Vanity Slugs**:
   - `Workspace.slug` is globally unique for vanity URL access (e.g. `app.salescopilot.io/w/acme-corp`).
