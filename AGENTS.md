<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- Prefer running tasks via `nx` (e.g. `pnpm nx run`, `pnpm nx affected`) rather than underlying tools directly.
- Scaffolding & structure: invoke the `nx-generate` skill first.
- Workspace navigation & exploration: invoke the `nx-workspace` skill first.

<!-- nx configuration end-->

# AGENTS.md

## 1. Project Vision & Phasing

Sales Copilot is an omnichannel customer conversation & sales engagement platform (NestJS, Next.js App Router, Prisma ORM, PostgreSQL, Redis, MinIO, WebSockets).

- **Phase 1 (FROZEN BASELINE)**: Omnichannel core (Conversations, Inboxes, Channels, Contacts, Identity Resolution).
  - ⛔ **NON-BREAKING INVARIANT**: Phase 1 APIs, schemas, and event contracts are stable and MUST NOT be broken or refactored arbitrarily.
- **Phase 2 (CURRENT ACTIVE SCOPE)**: Sales Intelligence & AI Copilot (Leads, Opportunities, Evidence ledger, AI Lead Scoring with time-decay, Copilot Assistant Drawer).
  - ⛔ **PROHIBITED**: Do NOT create models, tables, DTOs, or services for Phase 3 (Autonomous Sales Agents, Voice/SIP, external CRM sync).
- 📖 **Documentation References** (inspect when needed via `view_file`):
  - Hub: [`docs/README.md`](./docs/README.md) | Guidelines: [`docs/engineering/coding-guidelines.md`](./docs/engineering/coding-guidelines.md)
  - Architecture: [`docs/architecture/phase-2-sales-intelligence.md`](./docs/architecture/phase-2-sales-intelligence.md) | [`docs/architecture/system-architecture.md`](./docs/architecture/system-architecture.md)
  - Domain & Schema: [`docs/domain/phase-2-domain-model.md`](./docs/domain/phase-2-domain-model.md) | [`docs/architecture/phase-2-schema-rfc.prisma`](./docs/architecture/phase-2-schema-rfc.prisma)
  - Backlog & Epics: [`docs/backlog/phase-2-backlog.md`](./docs/backlog/phase-2-backlog.md) | [`docs/backlog/`](./docs/backlog/)

---

## 2. Core Directive: Anti-Over-Engineering & Pragmatism

> **The primary failure mode of AI coding agents is creating excessive boilerplate, speculative abstractions, and bloated layers of indirection.**

1. **YAGNI & KISS**: Write code ONLY for explicit current requirements. Prefer direct, idiomatic NestJS Services (`*.service.ts`) with Prisma queries over multi-layered Clean Architecture boilerplate.
2. **No Single-Implementation Interfaces**: ❌ DO NOT create `IUserService`, `IConversationService`, etc. `@Injectable()` classes are already mockable. Interfaces are reserved ONLY for polymorphic integrations (`ChannelAdapter`, `LlmProviderAdapter`).
3. **No DTO & Mapper Pipeline Explosion**: ❌ DO NOT chain `Entity ➔ DomainModel ➔ ApplicationDTO ➔ Presenter ➔ ViewModel`. Use a single Zod schema for input validation/DTO and return Prisma models or typed response objects directly.
4. **Rule of Three**: Duplicate code twice before creating a shared helper. Do not abstract on first or second use.
5. **Co-location over Folder Sprawl**: Keep related code together (`*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.dto.ts`, `*.spec.ts`). Avoid creating deep micro-folders (`entities`, `value-objects`, `commands`, `queries`, `ports`).

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

---

## 4. Module Boundaries & AI Performance Standards

1. **Service Encapsulation**: A module exposes business logic via its public NestJS service (`exports: [...]`). Do NOT directly query or mutate another module's internal Prisma models without going through its exported service.
2. **Inter-Module Communication**:
   - In-process: `EventEmitter2` for non-blocking side effects (`@OnEvent(...)`).
   - High-latency / retries: BullMQ (Redis queues) for background jobs (`sales-intelligence`, webhooks, media).
3. **⚡ Asynchronous AI Ingestion Directive**: Inbound chat and message delivery MUST NOT block on LLM inference. Ingestion acknowledges in `< 100ms`; AI extraction, signal detection, and scoring execute asynchronously via BullMQ.
4. **🔍 Traceable AI Evidence Directive**: LLM-extracted buying signals and evidence MUST link to verbatim quote snippets and reference valid `messageId` and `conversationId`.

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
3. **Auth**: JWT tokens stored strictly in `httpOnly` secure cookies via Next.js Server Actions & Middleware (`src/middleware.ts`). ❌ No `localStorage`.
4. **Theming**: Use semantic Tailwind classes (`bg-background`, `text-foreground`, `text-primary`, `border-border`). Support dark mode by default. Toast notifications via `sonner` (`toast.success()`, etc.).
5. **Realtime**: Use `queryClient.setQueryData()` in WebSocket listeners (`useRealtimeSync`) for single-source-of-truth state.

---

## 7. Testing & Definition of Done

- **High-Value Tests**: Focus tests on business rules, state machines, tenant isolation, and identity deduplication. Avoid brittle mock boilerplate for simple CRUD getters.
- **Task Definition of Done**:
  1. Multi-tenancy (`workspaceId`) and security invariants verified.
  2. Code follows anti-overengineering principles (KISS, YAGNI, no unnecessary layers).
  3. Tests pass: `pnpm nx run <project>:test` or `pnpm nx affected -t test`.
  4. Linter & build pass: `pnpm nx run <project>:lint` and `pnpm nx run <project>:build`.
  5. Documentation updated in `docs/` if architecture or API contracts changed.
