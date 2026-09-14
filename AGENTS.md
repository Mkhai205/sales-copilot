<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- Prefer running tasks via `nx` (e.g. `pnpm nx run`, `pnpm nx affected`) rather than underlying tools directly.
- Scaffolding & structure: invoke the `nx-generate` skill first.
- Workspace navigation & exploration: invoke the `nx-workspace` skill first.

<!-- nx configuration end-->

# AGENTS.md

## 1. Project Vision & Phasing

Sales Copilot is an omnichannel conversational commerce & AI sales platform for D2C & Retail (NestJS, Next.js App Router, Prisma ORM, PostgreSQL, Redis, MinIO, WebSockets).

- **Phase 1 (FROZEN BASELINE)**: Omnichannel core (Conversations, Inboxes, Channels, Contacts, Identity Resolution).
  - ⛔ **NON-BREAKING INVARIANT**: Phase 1 APIs, schemas, and event contracts are stable and MUST NOT be broken or refactored arbitrarily.
- **Phase 2 (CURRENT ACTIVE SCOPE)**: Conversational Commerce & AI Auto-pilot POS for D2C & Retail:
  - **Milestone 2A (Commerce Core - PRIORITY)**:
    - Built-in In-Chat POS Drawer & Inventory Management (Variants, SKUs, Atomic Stock Reservation).
    - Dynamic VietQR (NAPAS 247) & Instant Bank Webhook Reconciliation (< 1s via SePay/Cassie).
    - ESC/POS K80 Thermal Receipt Printing.
  - **Milestone 2B (AI Automation - SECONDARY)**:
    - AI NER 3-Tier Administrative Address Extraction & 1-Click Order Generation.
    - 24/7 AI Auto-pilot & Guarded Discount Policy Engine (Midnight Checkout).
    - Anti-theft Realtime Comment Masking (< 1s) & Comment-to-Inbox Pipeline.
  - ⛔ **PROHIBITED & DEPRECATED**: Do NOT build B2B CRM, Voice/SIP, or external CRM sync (HubSpot/Salesforce).
- 📖 **Documentation References** (inspect when needed via `view_file`):
  - Hub: [`docs/README.md`](./docs/README.md) | Guidelines: [`docs/engineering/coding-guidelines.md`](./docs/engineering/coding-guidelines.md)
  - In-Chat POS PRD: [`docs/product/in-chat-pos-prd.md`](./docs/product/in-chat-pos-prd.md) | RFC: [`docs/architecture/in-chat-pos-technical-rfc.md`](./docs/architecture/in-chat-pos-technical-rfc.md)
  - Product Vision: [`docs/product/vision.md`](./docs/product/vision.md) | Scope: [`docs/product/scope.md`](./docs/product/scope.md)
  - Backlog: [`docs/backlog/phase-2-backlog.md`](./docs/backlog/phase-2-backlog.md)

---

## 2. Core Directive: Anti-Over-Engineering & Pragmatism

> **The primary failure mode of AI coding agents is creating excessive boilerplate, speculative abstractions, and bloated layers of indirection.**

1. **YAGNI & KISS**: Write code ONLY for explicit current requirements. Prefer direct, idiomatic NestJS Services (`*.service.ts`) with Prisma queries over multi-layered Clean Architecture boilerplate.
2. **No Single-Implementation Interfaces**: ❌ DO NOT create `IUserService`, `IConversationService`, etc. `@Injectable()` classes are already mockable. Interfaces are reserved ONLY for polymorphic integrations (`ChannelAdapter`, `LlmProviderAdapter`).
3. **No DTO & Mapper Pipeline Explosion**: ❌ DO NOT chain `Entity ➔ DomainModel ➔ ApplicationDTO ➔ Presenter ➔ ViewModel`. Use a single Zod schema for input validation/DTO and return Prisma models or typed response objects directly.
4. **Rule of Three**: Duplicate code twice before creating a shared helper. Do not abstract on first or second use.
5. **Co-location over Folder Sprawl**: Keep related code together (`*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.dto.ts`, `*.spec.ts`). Avoid creating deep micro-folders (`entities`, `value-objects`, `commands`, `queries`, `ports`).
6. **Essential Complexity vs. Accidental Boilerplate**:
   - KISS & YAGNI apply to architectural indirection (no speculative abstractions, no bloated folder sprawl, no fake single-implementation interfaces).
   - For non-trivial domain algorithms and industry-standard protocols (e.g., VietQR EMVCo/CRC-16, ESC/POS thermal printing, Redis distributed locks, crypto), **ALWAYS prefer battle-tested, lightweight npm packages over rolling fragile custom implementations**.
   - Any newly proposed dependency MUST be explicitly declared and justified in the implementation plan before installation.

---

## 2.1. Agent Interaction & Planning Protocol (Human-in-the-Loop)

1. **Plan Before Code**: For any non-trivial task, refactoring, or new feature:
   - The agent MUST create or update `implementation_plan.md` first.
   - Detail impacted files, data flow, proposed new dependencies, and potential edge-case risks.
   - STOP and request explicit user review and approval before touching source code.
2. **Verification & Proof**: After execution, the agent MUST run automated verification (`typecheck`, `test`, `lint`) and provide a concise summary in `walkthrough.md`.
3. **No Silent Changes**: Never modify files, database schemas, or packages outside the agreed scope.

---

## 3. Multi-Tenancy & Data Security (Non-Negotiable)

1. **Mandatory Tenant Scoping (`workspaceId`)**:
   - Every database query, update, delete, or lookup for workspace resources **MUST include `workspaceId` in the Prisma `where` clause**.
   - ❌ Never: `prisma.conversation.findUnique({ where: { id } })`
   - ✅ Always: `prisma.conversation.findFirst({ where: { id, workspaceId } })`
2. **Channel Credentials Encryption**:
   - `Channel.credentials` stores encrypted data at rest using **AES-256-GCM**.
   - Read/write access MUST always pass through `ChannelCredentialService`. Never log or expose plaintext credentials/tokens.
3. **Webhook Verification**: All external inbound webhooks must verify HMAC signatures/tokens before processing.
4. **Backend Authorization**: Never trust client-side claims. Enforce workspace membership, roles (`ADMIN`, `AGENT`), and inbox permissions in backend Guards/Services.
5. **Database & Migration Safety (Strict)**:
   - ⛔ **NEVER execute destructive database commands**: Do NOT run `prisma migrate reset`, `prisma db push --force-reset`, or drop columns without explicit user confirmation.
   - Always use safe migrations: `pnpm db:migrate:dev --name <descriptive_name>`.
   - Ensure seed data integrity in `apps/server/prisma/seed.ts` is preserved.

---

## 4. Module Boundaries & AI Performance Standards

1. **Service Encapsulation**: A module exposes business logic via its public NestJS service (`exports: [...]`). Do NOT directly query or mutate another module's internal Prisma models without going through its exported service.
2. **Inter-Module Communication**:
   - In-process: `EventEmitter2` for non-blocking side effects (`@OnEvent(...)`).
   - High-latency / retries: BullMQ (Redis queues) for background jobs (`sales-intelligence`, webhooks, media).
3. **⚡ Asynchronous AI Ingestion Directive**: Inbound chat and message delivery MUST NOT block on LLM inference. Ingestion acknowledges in `< 100ms`; AI address extraction, auto-pilot draft generation, and courier dispatch execute asynchronously via BullMQ.
4. **🛡️ Traceable In-Chat POS & Pricing Directive**: AI Auto-pilot discounts must strictly respect the Workspace `DiscountPolicyEngine` limits; every order creation must atomically reserve stock. Multi-agent collision is strictly prevented via 30s Redis sliding locks.

---

## 5. Error Handling & Response Standards

1. **Built-in NestJS Exceptions**: Use standard exceptions from `@nestjs/common` (`NotFoundException`, `ConflictException`, etc.) with structured objects:
   ```typescript
   throw new ConflictException({
     code: 'EMAIL_ALREADY_EXISTS',
     message: 'Email is already in use by another account',
     details: { email },
   });
   ```
2. **Standard Envelope**: `TransformInterceptor` automatically wraps successful responses in `{ success: true, data, meta }`.
3. **Validation**: Validate request payloads using Zod pipes (`@ZodBody()`, `@ZodQuery()`, `@ZodParam()`).

---

## 6. Frontend Guidelines (Next.js & Shadcn UI)

1. **Mandatory Reuse of Shadcn UI Primitives**:
   - ⛔ **DO NOT REINVENT UI PRIMITIVES**. 50+ components exist in `apps/web/src/components/ui/`.
   - Before creating any UI component, check `src/components/ui/` and consult the `shadcn` skill (`.agents/skills/shadcn/SKILL.md`).
   - Forms: use `FieldGroup` + `Field`. Spacing: `gap-*` (never `space-y-*`). Sizing: `size-*`.
2. **Server State**: Use `@tanstack/react-query` exclusively. Use thin native `fetch` in `src/lib/api/client.ts` with contracts from `@sales-copilot/shared-contracts`. ❌ No Axios/SWR.
3. **Auth**: JWT tokens stored strictly in `httpOnly` secure cookies via Next.js Server Actions & Edge Proxy (`src/proxy.ts`). ❌ No `localStorage`.
4. **Theming**: Use semantic Tailwind classes (`bg-background`, `text-foreground`, `text-primary`, `border-border`). Support dark mode by default. Toast notifications via `sonner` (`toast.success()`, etc.).
5. **Realtime**: Use `queryClient.setQueryData()` in WebSocket listeners (`useRealtimeSync`) for single-source-of-truth state.

---

## 7. Testing & Definition of Done

- **High-Value Tests**: Focus tests on business rules, state machines, tenant isolation, and identity deduplication. Avoid brittle mock boilerplate for simple CRUD getters.
- **Verification CLI Runbook**:
  - **Typecheck (All Projects)**: `pnpm typecheck`
  - **Backend Unit Tests**: `pnpm nx run server:test`
  - **Frontend Unit Tests**: `pnpm nx run web:test`
  - **Linting**: `pnpm lint`
  - **Database Migration (Safe)**: `pnpm db:migrate:dev`
  - **Database Seed**: `pnpm db:seed`
- **Task Definition of Done**:
  1. Planning approval obtained via `implementation_plan.md` before code modification.
  2. Multi-tenancy (`workspaceId`) and security invariants strictly verified.
  3. Code follows anti-overengineering principles (KISS, YAGNI, essential vs. accidental complexity).
  4. Tests pass: `pnpm nx run <project>:test` or `pnpm nx affected -t test`.
  5. Linter & typecheck pass: `pnpm typecheck` and `pnpm lint`.
  6. Documentation updated in `docs/` if architecture or API contracts changed.
  7. Final walkthrough summary provided in `walkthrough.md`.
