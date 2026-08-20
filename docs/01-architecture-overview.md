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

- **Backend**: NestJS 11 (Express platform), TypeScript 5.8+, Prisma ORM 6.
- **Frontend**: Next.js 16 with Turbopack, React 19, Tailwind CSS v4, Lucide icons.
- **Transactional Database**: PostgreSQL 16 (Source of truth, indexed tenant isolation, ACID transactions).
- **In-Memory & Cache Engine**: Redis 7 (WebSocket Pub/Sub adapter, distributed locks, presence tracking, BullMQ background queues).
- **Object Storage**: MinIO S3 (Attachments, avatars, voice notes, media files).
- **Monorepo Management**: Nx monorepo (`apps/api`, `apps/web`, `packages/database`, `packages/contracts`, `packages/shared`, `packages/ai`).

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
