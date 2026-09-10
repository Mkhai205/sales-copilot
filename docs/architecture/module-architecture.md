# Module Architecture & Bounded Contexts

## 1. Domain Organization & Bounded Contexts

Sales Copilot is organized into high-cohesion, loosely coupled feature modules within a Pragmatic Modular Monolith.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   Sales Copilot Platform Monolith                      │
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
├────────────────────────────────────────────────────────────────────────┤
│                  6. In-Chat POS & Commerce (Phase 2 Active)            │
│ • Product        │ • ProductVariant │ • Order          │ • InventoryTx │
└──────────────────┴──────────────────┴──────────────────┴───────────────┘
```

---

## 2. Context Responsibilities & Owned Models

| Module | Bounded Context | Owned Models | Public Service Exports |
| :--- | :--- | :--- | :--- |
| **`identity`** / **`workspaces`** / **`users`** | Identity & Tenancy | `User`, `Workspace`, `WorkspaceMember`, `Team`, `TeamMember` | `AuthService`, `WorkspacesService`, `UsersService`, `TeamsService` |
| **`omnichannel`** / **`inboxes`** / **`contacts`** | Omnichannel & Ingestion | `Channel`, `ChannelEvent`, `Inbox`, `InboxMember`, `Contact`, `ChannelIdentity` | `InboxesService`, `ContactsService`, `ChannelCredentialService` |
| **`conversations`** / **`messages`** | Conversation & Messaging | `Conversation`, `ConversationLabel`, `Message`, `Attachment` | `ConversationsService`, `MessagesService`, `AutoAssignmentService` |
| **`operations`** / **`webhooks`** / **`automation-rules`** | Operations & Automation | `Label`, `CannedResponse`, `AutomationRule`, `WebhookSubscription`, `WebhookDelivery`, `AuditLog` | `LabelsService`, `CannedResponsesService`, `AutomationRulesService`, `WebhooksService` |
| **`realtime`** | Realtime Gateway | None (In-memory + Redis Pub/Sub) | `RealtimeGateway`, `RealtimeService` |
| **`pos`** (Phase 2) | In-Chat POS & Commerce | `Product`, `ProductVariant`, `Order`, `OrderItem`, `PaymentTransaction`, `InventoryTransaction` | `ProductsService`, `OrdersService`, `VietQrService`, `PaymentReconciliationService`, `ShippingService` |

---

## 3. Co-location & Standard Feature Module Structure

To keep development fast, clean, and maintainable without over-engineering (no 10-folder Clean Architecture sprawl), each feature module follows a cohesive NestJS structure:

```text
modules/conversations/
├── conversations.module.ts         # NestJS Module declaration & provider wiring
├── conversations.controller.ts     # HTTP request handling & route definitions
├── conversations.service.ts        # Business logic, state transitions, Prisma queries
├── conversations.dto.ts            # Zod schemas & TypeScript types (from shared-contracts)
├── conversations.listener.ts       # Event listeners (@OnEvent('...')) if applicable
└── conversations.service.spec.ts   # Pragmatic unit/integration tests
```

---

## 4. Inter-Module Communication Rules

Modules interact across boundaries using 3 strict mechanisms:

1. **Public NestJS Services**:
   - A module encapsulates its business logic in its service (`*.service.ts`) and exports it via `exports: [...]` in its `*.module.ts`.
   - Other modules import that module and inject the service.
2. **In-Process Domain Events (`EventEmitter2`)**:
   - For decoupled, non-blocking side effects: `@OnEvent('conversation.created')`, `@OnEvent('message.received')`.
3. **Background Job Queues (BullMQ)**:
   - For high-latency or retry-sensitive tasks (AI inference, outbound webhooks, email delivery).

### ⛔ Strict Architectural Guardrails:
1. **No Cross-Module Database Mutations**: A module MUST NOT directly write to or update another module's Prisma models; it must call the target module's public service or emit a domain event.
2. **No Direct Database Access in Controllers**: Controllers handle HTTP validation, parse user context (`@CurrentUser()`, `@CurrentWorkspace()`), and delegate to services.
3. **No Provider SDKs in Core Business Logic**: External provider SDKs (Meta Graph API, Zalo SDK, Telegram Bot API) reside exclusively inside `integrations/` behind adapters.
4. **Isomorphic Contracts**: Validation DTOs and WebSocket Event shapes are sourced from `@sales-copilot/shared-contracts` for end-to-end type consistency.
