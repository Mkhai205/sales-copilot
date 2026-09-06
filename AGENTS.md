<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

# AGENTS.md

## 1. Project Vision & Scope Phasing

Sales Copilot Platform is an omnichannel customer conversation and engagement platform inspired by Chatwoot, built as a modern modular monolith with **NestJS, Next.js, PostgreSQL (Prisma), Redis, MinIO, and WebSockets**.

### Project Roadmap & Phasing:

```text
                    Sales Copilot Platform
                           │
              ┌────────────┴────────────┐
              │                         │
       Conversation Core          Sales Intelligence          Autonomous Extensions
     (PHASE 1 - COMPLETED)        (PHASE 2 - ACTIVE)            (PHASE 3 - FUTURE)
              │                         │                               │
       ┌──────┴──────┐          ┌───────┴────────┐              ┌───────┴────────┐
       │             │          │                │              │                │
   Channels      Messaging   Lead/Opportunity    AI          Autonomous       Voice/SIP
   Contacts      Inbox       Scoring             Copilot     Sales Agents     CRM Sync
   Conversation  Teams       Buying Signals      Actions     Tool Registry    Advanced BI
   Assignment    Labels      Sales Evidence      LLM Gateway ...              ...
   Webhooks      Automation  ...                 ...
```

- **Phase 1 (COMPLETED & FROZEN BASELINE)**: **Omnichannel Conversation Platform Core**.
  - 100% verified and signed off across all 11 Epics and 33 remediation items (1,277 automated tests passing).
  - Production-ready core: Multi-tenancy, Omnichannel ingestion, Contact identity deduplication, Conversation state machine, Realtime WebSockets, Next.js dashboard.
  - ⛔ **NON-BREAKING INVARIANT**: Phase 1 APIs, schemas, and event contracts are stable and MUST NOT be broken or refactored arbitrarily.
- **Phase 2 (CURRENT ACTIVE SCOPE)**: **Sales Intelligence & AI Copilot**.
  - **Milestone 2A (Foundation)**: Epic 2.1 (Lead & Opportunity Core), Epic 2.3 (Multi-Provider LLM Gateway & Prompt Registry).
  - **Milestone 2B (Intelligence & Scoring)**: Epic 2.2 (Sales Evidence & Activity Timeline), Epic 2.4 (Conversation Intelligence Engine via BullMQ), Epic 2.5 (AI Lead Scoring Engine with Time-Decay).
  - **Milestone 2C (Copilot & UI)**: Epic 2.6 (Sales Copilot Assistant Drawer, Next Best Actions, WebSocket streaming).
  - ⛔ **CRITICAL RULE**: **Do NOT create models, DTOs, tables, or services for Phase 3 (Autonomous Agents, Voice/SIP, CRM Sync) during Phase 2.**
- **Phase 3 (FUTURE EXTENSION - FROZEN)**: Autonomous Sales Agent Execution Engine, Tool Registry & Guardrails, Voice/SIP integration, CRM Sync (HubSpot, Salesforce).

### Primary Documentation References in [`docs/`](./docs/README.md):

- **Phase 1 Baseline & Sign-Off**: [Phase 1 Sign-Off Report](./docs/audit/phase-1-completion-signoff.md) | [Phase 1 Remediation Plan](./docs/audit/10-master-remediation-plan.md)
- **Phase 2 Architecture & Specs**: [Phase 2 Architecture](./docs/architecture/phase-2-sales-intelligence.md) | [Phase 2 Domain Model](./docs/domain/phase-2-domain-model.md) | [Phase 2 Schema RFC](./docs/architecture/phase-2-schema-rfc.prisma) | [Phase 2 API & Events Spec](./docs/api/phase-2-api-spec.md)
- **Phase 2 Backlog & Epics**: [Phase 2 Master Backlog](./docs/backlog/phase-2-backlog.md) | [Epic 2.1](./docs/backlog/epic-2.1.md) | [Epic 2.2](./docs/backlog/epic-2.2.md) | [Epic 2.3](./docs/backlog/epic-2.3.md) | [Epic 2.4](./docs/backlog/epic-2.4.md) | [Epic 2.5](./docs/backlog/epic-2.5.md) | [Epic 2.6](./docs/backlog/epic-2.6.md)
- **Product & Domain Foundation**: [Product Vision](./docs/product/vision.md) | [Scope](./docs/product/scope.md) | [Domain Model](./docs/domain/domain-model.md) | [Business Rules](./docs/domain/business-rules.md)
- **Architecture & Guidelines**: [System Overview](./docs/architecture/system-architecture.md) | [Module Boundaries](./docs/architecture/module-architecture.md) | [Coding Guidelines](./docs/engineering/coding-guidelines.md)

---

## 2. Core Directive: Anti-Over-Engineering & Pragmatism

> **The primary failure mode of AI coding agents is creating excessive boilerplate, speculative abstractions, and bloated layers of indirection.** You MUST adhere to these anti-overengineering principles at all times:

### 2.1. YAGNI (You Aren't Gonna Need It) & No Speculative Generality

- **Write code ONLY for the current, explicit requirement.** Never add parameters, helper methods, hooks, or configuration toggles for hypothetical future use cases.
- Do not create "extensible framework code" when a simple, direct 15-line function solves the task cleanly.

### 2.2. KISS (Keep It Simple, Stupid) & Direct Implementations

- Prefer direct, straightforward code over complex architectural patterns.
- Prefer idiomatic **NestJS Services (`*.service.ts`)** and **Prisma Client queries** directly inside services over multi-layered Clean Architecture boilerplate.

### 2.3. No Single-Implementation Interfaces (Anti-Interface Explosion)

- ❌ **DO NOT CREATE**: `IUserService`, `IWorkspaceRepository`, `IConversationService`, `IAuthService` when only ONE concrete implementation exists.
- In NestJS and TypeScript, `@Injectable()` concrete classes are already first-class injectable dependencies and can be mocked directly in tests with `jest.spyOn()` or custom test providers.
- Interfaces are reserved **ONLY** for polymorphic integration points with multiple implementations (e.g. `ChannelAdapter` implemented by `FacebookAdapter`, `ZaloAdapter`, `TelegramAdapter`).

### 2.4. No DTO & Mapper Pipeline Explosion

- ❌ **DO NOT CHAIN**: `Entity` ➔ `DomainModel` ➔ `ApplicationDTO` ➔ `ControllerPresenter` ➔ `ViewModel` for standard CRUD or business operations.
- ✅ **DO**: Use a single Zod schema for input validation/DTO and return Prisma models or simple typed response objects directly. Let NestJS `TransformInterceptor` handle the response envelope.

### 2.5. Rule of Three for Abstractions

- **Do NOT abstract on first or second use.** Duplicate code 2 times before creating a shared helper or abstraction. Only extract shared utilities or base classes when you have **at least 3 concrete, distinct implementations** with identical logic.

### 2.6. Co-location over Folder Sprawl

- Group related code closely in cohesive feature modules.
- ❌ **AVOID**: Creating 10 deeply nested micro-folders for 1 feature (`domain/entities`, `domain/value-objects`, `domain/events`, `application/commands`, `application/queries`, `application/ports`, `infrastructure/persistence`, etc.).
- ✅ **PREFER**: Cohesive NestJS module structure:
  ```text
  conversations/
  ├── conversations.module.ts
  ├── conversations.controller.ts
  ├── conversations.service.ts
  ├── conversations.dto.ts        # Zod schemas & types
  ├── conversations.listener.ts   # Event listeners (if applicable)
  └── conversations.service.spec.ts
  ```

---

## 3. Technology Stack

- **Backend**: NestJS, TypeScript, Prisma ORM, PostgreSQL, Redis, MinIO (S3-compatible), WebSocket (`@nestjs/platform-socket.io`).
- **Frontend**: Next.js (App Router), React, TypeScript, Tailwind CSS, Shadcn UI / Radix primitives.
- **Monorepo Management**: Nx monorepo (`pnpm nx run-many`, `pnpm nx test`, `pnpm nx lint`).
- **Architecture**: Pragmatic Modular Monolith. Event-driven internally via `EventEmitter2` and Redis Queues (BullMQ).
- **Prohibited**: Do NOT introduce Microservices, Kafka, RabbitMQ, GraphQL, or heavy distributed workflow engines.

---

## 4. Module Boundaries & Communication

### 4.1. Phase 1 Core Modules (Frozen & Stable Baseline)

1. **Identity & Tenancy**: User, Workspace, WorkspaceMember, Team, TeamMember.
2. **Omnichannel**: Channel, ChannelEvent, Inbox, InboxMember, ChannelIdentity, Contact.
3. **Conversation**: Conversation, ConversationLabel, Message, Attachment.
4. **Operations**: Label, CannedResponse, AutomationRule, WebhookSubscription, WebhookDelivery, AuditLog.
5. **Realtime**: WebSocket Gateway & Realtime Event Dispatcher.

### 4.2. Phase 2 Sales Intelligence Modules (Active Development Scope)

6. **LLM Gateway (`LLMGatewayModule`)**:
   - Multi-provider abstraction (`LlmProviderAdapter`: Gemini primary / OpenAI fallback).
   - Token bucket rate limiter, circuit breaker, dynamic prompt template registry.
7. **Sales Intelligence (`SalesIntelligenceModule`)**:
   - `Lead` & `Opportunity` lifecycle management and conversion state machine.
   - `SalesEvidence` ledger (BANT: Budget, Authority, Need, Timeline) and activity timeline.
   - `LeadScore` engine (Fit, Behavior, Time-Decay cron evaluation after 48h).
   - Asynchronous conversation intelligence processor (`sales-intelligence` BullMQ queue).
8. **Sales Copilot (`CopilotModule`)**:
   - Next Best Action (NBA) suggestion engine and contextual draft replies.
   - Realtime WebSocket streaming to Copilot Drawer on the Next.js Dashboard.
   - Suggestion feedback tracking (accepted, edited, rejected).

### 4.3. Inter-Module Rules & AI Performance Standards:

- A module encapsulates its business logic in its NestJS service (`*.service.ts`).
- Modules communicate across boundaries using:
  1. **Public NestJS Services** exported via `exports: [...]` in the module definition.
  2. **Domain/Application Events** via `EventEmitter2` (`@OnEvent('conversation.created')`, `@OnEvent('message.created')`).
  3. **Background Queue Jobs** via BullMQ for heavy/retryable tasks.
- ❌ **DO NOT**: Directly query or mutate another module's internal Prisma models without going through that module's exported service.
- ⚡ **Asynchronous AI Ingestion Directive**: Inbound chat and message delivery MUST NOT block on LLM inference. Ingestion acknowledges in `< 100ms`; AI extraction, signal detection, and scoring recalculation execute asynchronously via BullMQ jobs.
- 🔍 **Traceable AI Evidence Directive**: LLM-extracted buying signals and sales evidence MUST link to verbatim quote snippets and reference valid `messageId` and `conversationId`.

---

## 5. Multi-Tenancy & Data Security (Non-Negotiable)

1. **Mandatory Tenant Scoping (`workspaceId`)**:
   - Every single database query, update, delete, or lookup for workspace resources **MUST include `workspaceId` in the Prisma `where` clause**.
   - Never rely on ID lookup alone (e.g. `prisma.conversation.findUnique({ where: { id } })` ❌) without verifying `workspaceId` (e.g. `prisma.conversation.findFirst({ where: { id, workspaceId } })` ✅).
2. **Channel Credentials Encryption**:
   - `Channel.credentials` in the database stores encrypted credentials at rest using **AES-256-GCM**.
   - Read/write access to credentials must ALWAYS pass through `ChannelCredentialService`.
   - Never log, print, or expose plaintext access tokens, webhook secrets, or API keys in logs or responses.
3. **Webhook Inbound Validation**:
   - All external inbound webhooks (Facebook, Zalo, Telegram, etc.) must verify HMAC signatures/tokens before processing payloads.
4. **Backend Authorization**:
   - Never trust client-side authorization. Validate workspace membership, roles (`ADMIN`, `AGENT`), and inbox access in backend Guards/Services.

---

## 6. Error Handling & Response Standards

Follow the standard NestJS exception paradigm:

1. **Use NestJS Built-in Exceptions**:
   - Throw standard exceptions from `@nestjs/common`: `NotFoundException`, `BadRequestException`, `ForbiddenException`, `UnauthorizedException`, `ConflictException`, `UnprocessableEntityException`.
   - ❌ Do NOT create abstract custom error hierarchies (`DomainError`, `ApplicationError`, `CustomBaseException`).
   - For business error codes, pass a structured object:
     ```typescript
     throw new ConflictException({
       code: 'EMAIL_ALREADY_EXISTS',
       message: 'Email is already in use by another account',
       details: { email },
     });
     ```
2. **Global Exception Filter**:
   - `HttpExceptionFilter` intercepts all exceptions and formats them into a standard response:
     ```json
     {
       "success": false,
       "error": {
         "code": "EMAIL_ALREADY_EXISTS",
         "message": "Email is already in use by another account",
         "details": { "email": "test@example.com" }
       }
     }
     ```
3. **Response Envelope**:
   - Controllers and services return raw data or paginated objects `{ items, meta }`.
   - `TransformInterceptor` wraps successful responses in `{ success: true, data, meta }`.
4. **Validation**:
   - Validate incoming request payloads using Zod pipes (`@ZodBody()`, `@ZodQuery()`, `@ZodParam()`).

---

## 7. External Integrations & Adapters

External third-party providers must be isolated behind adapters so vendor SDKs do not pollute core business logic:

```text
Omnichannel Channels:
ChannelAdapter (interface)
├── FacebookAdapter
├── ZaloAdapter
├── TelegramAdapter
└── EmailAdapter

File Storage:
StorageService (or MinioAdapter)

LLM Providers (Phase 2):
LlmProviderAdapter (interface)
├── GeminiAdapter (primary)
└── OpenAiAdapter (fallback)
```

- When implementing an external integration, encapsulate vendor-specific payloads, webhook formats, SDK calls, and retry logic inside its adapter.
- Internal services only consume normalized data types (e.g. `InboundMessagePayload`, `SendMessageResult`, `LlmCompletionResult`, `LlmStreamChunk`).

---

## 8. Event-Driven Workflows & Realtime

- **In-process events**: Use `EventEmitter2` for asynchronous, non-blocking side effects:
  - `MessageReceived` ➔ trigger auto-assignment, evaluate automation rules, dispatch webhook, broadcast realtime WebSocket event.
- **Background queues**: Use BullMQ (Redis) for retryable or high-latency tasks (e.g., outbound webhook delivery, sending emails, large media processing).
- **WebSocket Gateway**:
  - Broadcast typed events scoped to `workspaceId` and relevant user/inbox rooms.
  - Always enforce authentication and tenant authorization on socket connections.

---

## 9. Frontend Guidelines (Next.js, React & Shadcn UI)

### 9.1. Mandatory Reuse of Pre-Generated Shadcn UI Components

- ⛔ **CRITICAL RULE: DO NOT REINVENT UI PRIMITIVES.** 38+ components have already been initialized in `apps/web/src/components/ui/` (based on `@base-ui/react` and Tailwind CSS v4).
- **ALWAYS** import existing primitives directly from `@/components/ui/<component-name>`:
  - Layout & Containers: `dialog`, `alert-dialog`, `sheet`, `sidebar`, `resizable`, `scroll-area`, `separator`, `table`, `tabs`, `pagination`
  - Form & Inputs: `input`, `textarea`, `select`, `switch`, `toggle`, `toggle-group`, `radio-group`, `input-otp`, `calendar`
  - Feedback & Status: `toast` (`@base-ui/react/toast`), `alert`, `badge`, `skeleton`, `spinner`, `progress`, `tooltip`
  - Navigation & Action: `button`, `dropdown-menu`, `menubar`, `navigation-menu`, `breadcrumb`
  - Data & Messaging: `avatar`, `bubble`, `message`, `message-scroller`
- ❌ **DO NOT**: Write custom modal overlays, custom select dropdowns, custom tooltip logic, or ad-hoc button CSS from scratch.

### 9.2. Server State & Data Fetching

- **TanStack Query Only**: Use `@tanstack/react-query` exclusively for server state caching, mutations, pagination (`useInfiniteQuery`), and optimistic updates.
- **Thin Fetch API Client**: Use native `fetch` encapsulated in `src/lib/api/client.ts` with end-to-end TypeScript types imported directly from `@sales-copilot/shared-contracts`.
- ❌ **DO NOT**: Install Axios, SWR, or create custom HTTP client abstractions.
- **Single Source of Truth**: When receiving WebSocket events (`useRealtimeSync`), update TanStack Query cache directly via `queryClient.setQueryData()` instead of keeping redundant separate React/Zustand states.

### 9.3. Authentication & Route Protection

- **Cookie-Based Auth**: Manage JWT access and refresh tokens strictly via `httpOnly` secure cookies using Next.js Server Actions and Next.js Middleware (`src/middleware.ts`).
- ❌ **DO NOT**: Store JWT access tokens in `localStorage` or plaintext memory globals.
- **Route Groups**: Keep routes clean: `(auth)/login` for public auth and `(dashboard)/[workspaceSlug]/...` for authenticated workspace-scoped pages.

### 9.4. Design System, Theming & Styling

- **CSS Variables & Semantic Tokens**: Always use semantic Tailwind classes matching `globals.css` (`bg-background`, `text-foreground`, `bg-card`, `bg-muted`, `border-border`, `text-primary`, `text-muted-foreground`).
- ❌ **DO NOT**: Hardcode arbitrary hex colors (e.g. `bg-[#1a202c]`) or arbitrary px margins where design tokens exist.
- **Dark Mode Default**: Support Dark Theme by default via `next-themes` (`ThemeProvider` in `app-providers.tsx`).
- **Toast Notifications**: Use `Sonner` via `@/components/ui/sonner` (already configured in `app-providers.tsx` as `<Toaster />`). Use `toast.success()`, `toast.error()`, `toast()` from `sonner` package.

### 9.5. Realtime & Live Interaction (Chatwoot Patterns)

- **Optimistic UI with Deduplication**: Immediate UI rendering on send (`status: 'sending'`), reconciled via server response / WebSocket `message.created` with UUID deduplication.
- **Clipboard Image Paste**: Chat composer must support pasting images directly from clipboard (`onPaste` event ➔ `items[i].getAsFile()`).
- **Audio Chimes**: Use native HTML5 Audio (`new Audio('/sounds/ding.mp3')`) for non-intrusive sound alerts on incoming contact messages.

### 9.6. Performance & Vercel React Best Practices

- **Eliminate Waterfalls**: Use `Promise.all()` for independent fetches (`async-parallel`).
- **Re-render Optimization**: Use functional setState (`setList(prev => ...)`), `useDeferredValue` for fast search filtering, and derive UI state during render rather than syncing in `useEffect`.
- **Tree-Shaking**: Import specific types from `@sales-copilot/shared-contracts`, avoiding unanalyzable wildcard imports (`import * from ...`).

### 9.7. Pre-Implementation Shadcn Component Audit (Mandatory)

- ⛔ **CRITICAL RULE**: Before writing ANY new UI component, you MUST:
  1. **Read the Shadcn skill** (`.agents/skills/shadcn/SKILL.md` + `rules/`) to understand component APIs, composition patterns, and critical rules
  2. **Check `src/components/ui/`** — list all 50 existing components and verify if ANY existing primitive covers your need
  3. **Run `pnpm dlx shadcn@latest search`** to check both installed and registry components
  4. **Run `pnpm dlx shadcn@latest docs <component>`** to get correct API usage before composing
  5. **Only create a new component** if NO Shadcn primitive or composition can cover the need

- **Shadcn Component Selection Reference**:

  | Need                              | Use                                                                                           |
  | --------------------------------- | --------------------------------------------------------------------------------------------- |
  | Chat message threads              | `MessageScroller` + `MessageScrollerItem` + `MessageScrollerButton`                           |
  | Message bubbles                   | `Message` + `Bubble` + `BubbleContent`                                                        |
  | Date separators / system messages | `Marker` (variant `separator`)                                                                |
  | File/Image attachments            | `Attachment` + `AttachmentGroup`                                                              |
  | Form layouts                      | `FieldGroup` + `Field` + `FieldLabel` + `FieldDescription`                                    |
  | Search inputs with icons          | `InputGroup` + `InputGroupInput` + `InputGroupAddon`                                          |
  | Option sets (2–7 choices)         | `ToggleGroup` + `ToggleGroupItem`                                                             |
  | Loading states                    | `Skeleton` (not custom animate-pulse divs)                                                    |
  | Status indicators                 | `Badge` (not custom styled spans)                                                             |
  | Destructive confirmations         | `AlertDialog` (not custom modals)                                                             |
  | Side panels / detail views        | `Sheet`                                                                                       |
  | Resizable layouts                 | `ResizablePanelGroup` + `ResizablePanel` + `ResizableHandle` from `@/components/ui/resizable` |
  | Empty states                      | `Empty` + `EmptyHeader` + `EmptyTitle`                                                        |
  | Dividers                          | `Separator` (not `<hr>` or `border-t` divs)                                                   |

- **Shadcn Critical Rules** (always apply):
  - Forms: `FieldGroup` + `Field`, never raw `div` with `space-y-*`
  - Spacing: `gap-*`, never `space-x-*` or `space-y-*`
  - Equal dimensions: `size-*`, never `w-* h-*`
  - Icons in buttons: `data-icon`, no sizing classes on icons
  - Items inside Groups: `SelectItem` → `SelectGroup`, `CommandItem` → `CommandGroup`, etc.
  - Dialog/Sheet/Drawer always need `Title` (use `sr-only` if visually hidden)
  - Button loading: compose `Spinner` + `data-icon` + `disabled`, no `isPending` prop
  - Validation: `data-invalid` on `Field` + `aria-invalid` on control

---

## 10. Chatwoot Reference Guidelines

Chatwoot is our primary business behavior reference for conversation flows:

1. Review Chatwoot's behavior for conversation lifecycle, contact resolution, inbox routing, and canned responses.
2. Translate the **business intent and rules** into our modern TypeScript/NestJS architecture.
3. ❌ **DO NOT copy Rails/Ruby-isms** (e.g., ActiveSupport concerns, ActiveRecord callbacks, global monkey-patching).
4. In case of conflict:
   `Current Project Requirements > Current Architecture > Explicit ADR > Chatwoot Implementation`

---

## 11. Testing Guidelines

Write pragmatic, high-value tests:

- **Unit & Service Tests**: Test core business rules, status transitions, contact identity deduplication, and assignment logic.
- **Integration Tests**: Test critical end-to-end flows (e.g. Inbound Webhook Ingestion ➔ Identity Resolution ➔ Message Storage ➔ Realtime Event).
- ❌ **AVOID BRITTLE TESTS**: Do not write 200 lines of mock setup for simple 3-line getters or CRUD delegation methods. Focus testing on business logic, edge cases, invariants, and authorization boundaries.

---

## 12. AI Coding Agent Workflow & Definition of Done

When completing any task, follow this systematic workflow:

1. **Understand & Inspect**: Review existing module code, database schemas, and relevant documentation in `docs/`.
2. **Implement Minimal & Coherent Changes**: Write the simplest, most readable solution that completely satisfies the requirements. Avoid over-engineering, unnecessary classes, and redundant layers.
3. **Verify Tenant Isolation & Security**: Ensure every query is tenant-scoped (`workspaceId`) and credentials are encrypted.
4. **Add/Update Tests**: Cover meaningful business logic with clean tests.
5. **Run Validation via Nx**:
   - Run linter: `pnpm nx run <project>:lint` or `pnpm nx affected -t lint`
   - Run tests: `pnpm nx run <project>:test` or `pnpm nx affected -t test`
   - Run build: `pnpm nx run <project>:build`
6. **Definition of Done**:
   - [x] Requirements implemented accurately.
   - [x] Code is simple, readable, and free of unnecessary abstractions (YAGNI & KISS).
   - [x] Multi-tenancy and security standards strictly respected.
   - [x] Tests pass and build succeeds.
   - [x] Documentation updated if API or architecture contracts changed.
