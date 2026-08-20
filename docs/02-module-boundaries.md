# 02. Module Boundaries & Bounded Contexts

## 1. Domain Organization (Phase 1)

Phase 1 is split into 5 cohesive bounded contexts:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   Sales Copilot Core (Phase 1)                         │
├──────────────────┬──────────────────┬──────────────────┬───────────────┤
│  1. Identity &   │ 2. Omnichannel   │ 3. Conversation  │ 4. Operations │
│     Tenancy      │    & Ingestion   │    & Messaging   │    & Webhooks │
├──────────────────┼──────────────────┼──────────────────┼───────────────┤
│ • User           │ • Channel        │ • Conversation   │ • Label       │
│ • Workspace      │ • ChannelEvent   │ • ConvLabel      │ • CannedResp  │
│ • WorkspaceMember│ • Inbox          │ • Message        │ • Automation  │
│ • Team           │ • InboxMember    │ • Attachment     │ • WebhookSub  │
│ • TeamMember     │ • Contact        │                  │ • WebhookDel  │
│                  │ • ChannelIdentity│                  │ • AuditLog    │
├──────────────────┴──────────────────┴──────────────────┴───────────────┤
│                  5. Realtime & WebSocket Gateway                       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Context Responsibilities

### 1. Identity & Multi-Tenancy
- **Models**: `User`, `Workspace`, `WorkspaceMember`, `Team`, `TeamMember`.
- **Responsibilities**:
  - Authentication (JWT, Argon2 hashing, refresh token rotation).
  - Workspace onboarding & tenant switching.
  - Team grouping and agent team membership.
  - Role-Based Access Control (RBAC).

### 2. Omnichannel & Ingestion
- **Models**: `Channel`, `ChannelEvent`, `Inbox`, `InboxMember`, `Contact`, `ChannelIdentity`.
- **Responsibilities**:
  - Channel configurations & encrypted credential storage.
  - 1:1 binding between Inbox and Channel.
  - Inbox agent access control (`InboxMember`).
  - Webhook ingestion & deduplication (`ChannelEvent`).
  - Cross-channel contact identity stitching (`ChannelIdentity`).

### 3. Conversation & Messaging
- **Models**: `Conversation`, `ConversationLabel`, `Message`, `Attachment`.
- **Responsibilities**:
  - Conversation lifecycle & status transitions (`OPEN`, `PENDING`, `RESOLVED`, `SNOOZED`).
  - Message threading, chronological sequencing, and deduplication (`externalId`).
  - Polymorphic sender enforcement (`CONTACT`, `USER`, `SYSTEM`).
  - Multipart and media attachment handling with S3 storage paths.
  - Conversation tagging and labeling via `ConversationLabel` M:N junction.

### 4. Operations & Automation
- **Models**: `Label`, `CannedResponse`, `AutomationRule`, `WebhookSubscription`, `WebhookDelivery`, `AuditLog`.
- **Responsibilities**:
  - Canned response snippet management and shortcode search.
  - Workspace labels management.
  - Event-driven automation rule evaluation (Triggers, Conditions, Actions).
  - Outbound webhook delivery, signature generation, exponential backoff retries.
  - Operational and security audit logging.

### 5. Realtime
- **Components**: WebSocket Gateway, Redis Pub/Sub Adapter, Room Manager.
- **Responsibilities**:
  - WebSocket connection authentication via handshake token.
  - Tenant room management (`workspace_{id}`) and conversation room management (`conversation_{id}`).
  - Low-latency event broadcasting for live UI updates.

---

## 3. Dependency Direction Rules

```text
Presentation Layer (Controllers, Gateways)
       │
       ▼
Application Service Layer (Business Orchestration & Use Cases)
       │
       ▼
Persistence Repository Layer (Data Access & Queries via PrismaService)
       │
       ▼
Infrastructure (PostgreSQL, Redis, MinIO S3, External Adapters)
```

### Module Internal File Pattern:
To keep development fast, clean, and maintainable without over-engineering (no 4-layer boilerplate per module), each feature module follows a flat, standardized NestJS structure:

```text
modules/conversations/
├── dto/
│   ├── create-conversation.dto.ts
│   ├── update-conversation.dto.ts
│   └── list-conversations.dto.ts
├── conversations.controller.ts     # HTTP request handling & route definition
├── conversations.service.ts        # Business logic, state transitions, event emission
├── conversations.repository.ts     # Data access layer (injects PrismaService / getClient())
└── conversations.module.ts         # NestJS Module declaration
```

### Strict Architectural Guardrails:
1. **No Direct Database Access in Controllers**: Controllers must delegate to Services.
2. **No Cross-Module Database Mutations**: A module must not directly write to another module's Prisma models; it must publish a Domain/BullMQ Event or call the respective Public Service.
3. **No Provider SDKs in Core Business Logic**: External provider SDKs (Meta Graph API, Zalo SDK, Telegram Bot API) must reside exclusively inside `integrations/`.
4. **Isomorphic Contracts**: All Request/Response validation DTOs and WebSocket Event shapes are sourced from `@sales-copilot/contracts` (pure Zod/TS) to ensure type consistency across Backend and Frontend.
