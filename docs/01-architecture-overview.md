# 01. Architecture Overview

## 1. System Philosophy & Objectives

Sales Copilot Platform is built as a **high-performance, event-driven modular monolith** designed to provide an enterprise-grade omnichannel conversation backbone.

The design philosophy adheres to:
1. **Conversation-First**: Realtime interaction and reliable messaging ingestion are the primary product drivers.
2. **Strict Multi-Tenancy**: Logical isolation per `Workspace` across all operational queries and websocket broadcasts.
3. **Parity with Chatwoot Business Logic**: Adopting proven conversation management patterns while translating them cleanly to modern TypeScript / NestJS / Next.js conventions without Rails legacy debt.
4. **Resilience & Idempotency**: Distributed webhooks, concurrent message processing, and retries are resilient against duplicates and transient failures.

---

## 2. Technology Stack

```text
┌────────────────────────────────────────────────────────┐
│               Frontend: Next.js 16 (App Router)        │
│          React 19, TypeScript, Tailwind CSS, Base UI   │
└───────────────────────────┬────────────────────────────┘
                            │ REST / WebSocket (Socket.io)
┌───────────────────────────▼────────────────────────────┐
│               Backend: NestJS 11 (Modular Monolith)    │
│  Controllers ──► Application Use Cases ──► Repositories │
└─────────┬─────────────────┬──────────────────┬─────────┘
          │                 │                  │
          ▼                 ▼                  ▼
┌──────────────────┐┌───────────────┐┌──────────────────┐
│  PostgreSQL 16   ││    Redis 7    ││     MinIO S3     │
│   (Prisma ORM)   ││ (Pub/Sub + Q) ││ (Object Storage) │
└──────────────────┘└───────────────┘└──────────────────┘
```

- **Backend**: NestJS 11 (Express platform), TypeScript 6+, Prisma ORM 7 (7.9.1) with `@prisma/adapter-pg` driver adapter.
- **Frontend**: Next.js 16 with Turbopack, React 19, Tailwind CSS v4, Lucide icons.
- **Transactional Database**: PostgreSQL 16 (Source of truth, indexed tenant isolation, ACID transactions with Ambient Transaction Manager).
- **In-Memory & Cache Engine**: Redis 7 (WebSocket Pub/Sub adapter, distributed locks, presence tracking, BullMQ background queues).
- **Object Storage**: MinIO S3 (Attachments, avatars, voice notes, media files).
- **Monorepo Management**: Nx monorepo:
  - `apps/server`: Unified NestJS backend application (REST API, WebSocket Gateway, Queue Workers, CLI/Prisma).
  - `apps/web`: Next.js 16 Web application.
  - `packages/shared-contracts`: Isomorphic ESM domain-oriented types, Zod validation schemas, API DTOs, domain enums, error hierarchy, and transaction abstractions.

---

### Backend Unified Application Architecture (`apps/server`)

```text
apps/server/
├── prisma/                                  # 🛠️ Database Schema & CLI Lifecycle
│   ├── schema.prisma                        # PostgreSQL Data Model (Prisma 7)
│   ├── migrations/                          # SQL Migration History
│   └── seed.ts                              # Baseline Seed Script (Admin, Workspace, Team, Inbox, Canned, etc.)
│
├── prisma.config.ts                         # Prisma 7 Central Configuration
│
└── src/
    ├── main.ts                              # NestJS Bootstrap & Swagger (/docs)
    ├── app.module.ts                        # Root Application Module (Global ConfigModule & DatabaseModule)
    │
    ├── common/                              # Framework Primitives & Cross-Cutting Concerns
    │   ├── decorators/                      # @CurrentUser(), @CurrentWorkspace()
    │   ├── guards/                          # AuthGuard, WorkspaceGuard, RolesGuard
    │   ├── filters/                         # GlobalExceptionFilter (RFC 7807 compliant error format)
    │   ├── interceptors/                    # LoggingInterceptor, TransformInterceptor
    │   ├── pipes/                           # ZodValidationPipe
    │   └── utils/
    │
    ├── infrastructure/                      # Shared Persistence & External Adapters
    │   ├── database/                        # PrismaService (Retry + Pool), pg.Pool, Ambient TransactionManager
    │   │   └── generated/                   # Prisma 7 generated client (Local & Encapsulated)
    │   ├── redis/                           # Redis Client & Distributed Caching
    │   ├── queue/                           # BullMQ Queue Workers & Job Processors
    │   └── storage/                         # MinIO S3 Object Storage Service
    │
    ├── modules/                             # Core Business Modules (Phase 1 Conversation Core)
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
    │   └── realtime/                        # WebSocket Gateway & Realtime Event Dispatcher
    │
    └── integrations/                        # Omnichannel Ingestion Adapters
        ├── web-chat/                        # Live Web Chat Widget Ingestion
        ├── facebook/                        # Facebook Messenger Webhook & Send API
        ├── zalo/                            # Zalo OA Webhook & Send API
        ├── telegram/                        # Telegram Bot Webhook & Send API
        └── email/                           # Inbound/Outbound Email Adapter
```

---

## 3. End-to-End Ingestion Flow

```text
[External Customer]
      │ (Sends message via Web Chat / FB / Zalo / Telegram)
      ▼
[Webhook Endpoint / API Gateway] (/api/v1/channels/:id/webhook)
      │
      ├── 1. Signature Verification (HMAC-SHA256)
      │
      ├── 2. Ingestion Deduplication (ChannelEvent @@unique([channelId, externalEventId]))
      │
      ├── 3. Ingestion Queue (BullMQ / Async Processor)
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
            │     - Save any Attachments
            │
            ├── 7. Auto-Assignment Trigger (Round-Robin online agents if unassigned)
            │
            ├── 8. Automation Rules Evaluation (Condition matching & Action execution)
            │
            ├── 9. Outbound Webhook Subscriptions Dispatch
            │
            └── 10. Realtime Event Broadcast (WebSocket room: `workspace_${workspaceId}`)
```

---

## 4. Multi-Tenancy Architecture

All operational entities belong to a single tenant identified by `Workspace.id`.

### Multi-Tenancy Rules:
1. **Global SuperAdmin vs Tenant Membership**:
   - `User.role`: `SUPER_ADMIN` (Platform level) vs `USER` (Standard platform user).
   - `WorkspaceMember.role`: `OWNER`, `ADMIN`, `AGENT`, `VIEWER` (Role within the specific workspace).
2. **Tenant Scoping**:
   - Every read and write query MUST filter by `workspaceId` (enforced via NestJS Interceptors, Guards, and Repository layer).
3. **Workspace Unique Slugs**:
   - `Workspace.slug` is globally unique for vanity URL access (e.g. `app.salescopilot.io/w/acme-corp`).
