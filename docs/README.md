# Sales Copilot Platform — System Documentation (Phase 1)

Welcome to the technical documentation for **Sales Copilot Platform**.

This documentation establishes the architectural standard, domain boundaries, data models, state machines, and operational guidelines for **Phase 1: Omnichannel Conversation Platform Core**.

---

## 🗺️ Documentation Sitemap

| Document | Description |
| :--- | :--- |
| **[01. Architecture Overview](./01-architecture-overview.md)** | High-level system design, multi-tenancy, tech stack, and primary data flow. |
| **[02. Module Boundaries](./02-module-boundaries.md)** | Bounded contexts, module ownership, dependency direction, and service interfaces. |
| **[03. Channel Adapters Guide](./03-channel-adapters.md)** | Inbound webhook pipeline, idempotency (`ChannelEvent`), AES-256 credentials encryption, adapter specifications. |
| **[04. Conversation State Machine](./04-conversation-state-machine.md)** | Lifecycle transitions (`OPEN`, `PENDING`, `RESOLVED`, `SNOOZED`), Round-Robin assignment, Contact resolution. |
| **[05. Realtime & Event Dispatcher](./05-realtime-and-events.md)** | NestJS WebSocket Gateway, Redis Pub/Sub room management, and typed event schemas. |
| **[06. Operations & Security](./06-operations-and-security.md)** | Automation rule engine, Canned responses, Outbound webhook delivery & retry engine, RBAC & security matrix. |
| **[07. API & Contracts Specification](./07-api-and-contracts.md)** | REST endpoints, DTO contracts, Zod schemas, error handling, and pagination. |

---

## 📌 Phasing & Scope Guardrail

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

### Phase 1: Active Core
- **Objective**: Build a robust, scalable multi-tenant Omnichannel Conversation Platform inspired by Chatwoot using **NestJS 11 + Next.js 16 + PostgreSQL 16 (Prisma 7) + Redis 7 + MinIO S3**.
- **Active Entities**: 21 normalized models covering Multi-tenancy, Omnichannel Inbox & Channels (1:1), Contacts & Channel Identities, Conversations & Messages, Attachments, Conversation Labels, Canned Responses, Automation Rules, Outbound Webhooks, Teams, and Audit Logs.

### Phase 2: Future Extension (Deferred)
- **Scope**: Lead/Opportunity lifecycle, AI-driven Lead scoring, buying signals extraction, sales evidence, copilot decisions, and tool execution engine.
- **Rule**: No models, services, DTOs, or database columns for Phase 2 are permitted in Phase 1 code.
