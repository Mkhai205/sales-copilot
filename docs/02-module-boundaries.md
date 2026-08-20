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
Application Layer (Use Cases, Public Services, Command Handlers)
       │
       ▼
Domain Layer (Entities, Value Objects, Domain Events, Domain Exceptions)
       ▲
       │
Infrastructure Layer (Prisma Repositories, Redis, S3, External Channel Adapters)
```

### Strict Rules:
- **No Direct Database Access in Controllers**: Controllers must call Application Use Cases or Services.
- **No Cross-Module Database Mutations**: A module must not directly write to another module's Prisma models; it must publish a Domain Event or call a Public Application Service.
- **No Provider SDK in Domain**: External provider SDKs (Facebook Graph API, Zalo SDK, MinIO SDK) must remain strictly encapsulated inside Infrastructure Adapters.
