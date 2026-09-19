# Sales Copilot Phased Implementation Roadmap (2026)

> **Document Classification**: Master Engineering Implementation Plan & Task Backlog  
> **Audited Date**: September 19, 2026  
> **Target Monorepo**: Sales Copilot (`apps/server`, `apps/web`, `packages/shared-contracts`, `packages/widget-sdk`)  
> **Status**: 100% Complete — Publication Grade  
> **Execution Model**: Phased Parallel Delivery (Phase 1 $\rightarrow$ Phase 2 $\rightarrow$ Phase 3)  
> **Baseline Governance Rules**: `AGENTS.md` (KISS/YAGNI, Strict Multi-Tenancy, TanStack Query, Shadcn UI)  

---

## 1. Roadmap Overview & Phasing Strategy

The Sales Copilot engineering roadmap is structured into three chronological, objective-driven phases. Every task is assigned a globally unique identifier, priority rating, complexity estimation, explicit dependencies to maximize parallel engineering execution, and independently verifiable acceptance criteria.

```text
========================================================================================
                          SALES COPILOT 3-PHASE ROADMAP OVERVIEW
========================================================================================
 PHASE 1: STABILIZATION & SECURITY (Weeks 1 - 2)
  ├── Objective: Eradicate cross-tenant leaks, enforce strict multi-tenancy at database
  │              schema level, eliminate memory leaks, and prune dead code/dependencies.
  └── 10 Tasks: TASK-SEC-01 through 06, TASK-CLEAN-01 through 04 (All P0/P1 blockers)

 PHASE 2: CORE FEATURE COMPLETION (Weeks 3 - 5)
  ├── Objective: Bridge all headless backend APIs into production Web UI screens,
  │              activating Contacts CRM, 3PL Shipping actions, Bank Reconciliation
  │              ledger, AI Policy customization, and Tenant Analytics.
  └── 7 Tasks: TASK-FEAT-01 through 07 (P1/P2 core commercial workbench enhancements)

 PHASE 3: OPTIMIZATION & EXPANSION (Weeks 6 - 9)
  ├── Objective: Extend the platform into enterprise-tier multi-warehouse logistics,
  │              promotional coupon campaign rules, Zalo OA / Email channels, and new carriers.
  └── 5 Tasks: TASK-EXP-01 through 05 (P2/P3 expansion epics)
========================================================================================
```

### Priority Definitions
- **`P0` (Blocker / Critical Security)**: Critical vulnerability or data isolation flaw; must be resolved before production release.
- **`P1` (High Priority / Core Delivery)**: Major functionality gap, headless feature without UI, or high-risk defect.
- **`P2` (Medium Priority / Polish)**: Standard feature enhancement, tenant settings, or secondary workflows.
- **`P3` (Low Priority / Expansion)**: Future enterprise capability or nice-to-have integration.

### Complexity Estimates
- **`Small`**: 1 to 2 developer days; localized within 1–3 files.
- **`Medium`**: 3 to 5 developer days; cross-layer changes (Controller, Service, UI components).
- **`Large`**: 1 to 2 developer weeks; database migrations, multiple services, state machines, background workers.

---

## 2. Dependency Graph & Parallel Execution Model

The diagram below maps task dependencies, allowing multiple engineering subagents or developers to work simultaneously without blocking each other:

```text
+---------------------------------------------------------------------------------------+
| PHASE 1: SECURITY & CLEANUP (CAN RUN IMMEDIATELY IN PARALLEL)                         |
|                                                                                       |
| [TASK-SEC-01] WebChat Leak Fix --------+                                              |
| [TASK-SEC-02] WebChat Controller Fix --+                                              |
| [TASK-SEC-05] Shipping Compound Key ---+                                              |
| [TASK-SEC-06] Facebook Collision Guard +                                              |
| [TASK-CLEAN-01] LinkPreview LRU Cache -+                                              |
| [TASK-CLEAN-02] Delete Dead Contact ---+                                              |
| [TASK-CLEAN-03] Prune Unused Deps ------> [TASK-CLEAN-04] Prune 13 Shadcn Components  |
|                                                                                       |
| [TASK-SEC-03] Add Schema Compound Keys -> [TASK-SEC-04] Refactor 54 Service Mutations |
+---------------------------------------------------------------------------------------+
                                            |
                                            v (Task-SEC-03/04 Complete)
+---------------------------------------------------------------------------------------+
| PHASE 2: CORE FEATURE COMPLETION (CAN RUN IN PARALLEL)                                |
|                                                                                       |
| [TASK-FEAT-01] Contacts CRM Table ------> [TASK-FEAT-02] Contact Merge & Identities   |
| [TASK-FEAT-03] 3PL Logistics UI Actions                                               |
| [TASK-FEAT-04] Bank Reconciliation Ledger Screen & Query API                          |
| [TASK-FEAT-05] Tenant Audit Logs Screen                                               |
| [TASK-FEAT-06] AI Copilot Policy & BYOK Settings                                      |
| [TASK-FEAT-07] Tenant Analytics Dashboards (Phase 2C)                                 |
+---------------------------------------------------------------------------------------+
                                            |
                                            v
+---------------------------------------------------------------------------------------+
| PHASE 3: EXPANSION & ADVANCED ENGINES                                                 |
|                                                                                       |
| [TASK-EXP-01] Multi-Warehouse Stock Routing Engine                                    |
| [TASK-EXP-02] Promotional Coupon & Campaign Rules Engine                              |
| [TASK-EXP-03] Zalo OA Channel Ingestion & Chatwoot Parity                             |
| [TASK-EXP-04] Inbound / Outbound Email Ticketing Subsystem                            |
| [TASK-EXP-05] ViettelPost & Ahamove Carrier Adapters                                  |
+---------------------------------------------------------------------------------------+
```

---

## 3. Phase 1: Stabilization & Security

### `TASK-SEC-01`: Eliminate Cross-Tenant Channel Scan in WebChat Gateway
- **Priority**: `P0` (Blocker)
- **Complexity**: `Small`
- **Dependencies**: None
- **Affected Files**: `apps/server/src/modules/omnichannel/integrations/web-chat/web-chat.gateway.ts` (lines 548–568)
- **Problem & Risk**:
  During visitor WebSocket connection handshakes, if `providerAccountId` is not matched, the gateway executes `client.channel.findMany({ where: { channelType: ChannelType.WEB_CHAT } })` across all workspaces in the database. It then iterates over every tenant channel, decrypts credentials in process memory, and compares tokens. This is a severe data isolation violation and DoS vector.
- **Proposed Solution**:
  1. Remove the fallback loop completely.
  2. Require that every WebChat channel stores its `widgetToken` in `providerAccountId`.
  3. Execute single indexed query: `client.channel.findFirst({ where: { channelType: ChannelType.WEB_CHAT, providerAccountId: widgetToken }, include: { inbox: true } })`.
- **Acceptance Criteria**:
  - [ ] Zero un-scoped `channel.findMany` calls exist in `web-chat.gateway.ts`.
  - [ ] Connecting with an invalid `widgetToken` immediately returns unauthorized without loading other channels.
  - [ ] Existing valid web chat widget connections continue to establish real-time sessions successfully.
  - [ ] Server unit tests in `web-chat.gateway.spec.ts` pass cleanly.

---

### `TASK-SEC-02`: Eliminate Un-Scoped Fallback Query in WebChat Controller
- **Priority**: `P0` (Blocker)
- **Complexity**: `Small`
- **Dependencies**: None
- **Affected Files**: `apps/server/src/modules/omnichannel/integrations/web-chat/web-chat.controller.ts` (lines 324–340)
- **Problem & Risk**:
  Similar to `TASK-SEC-01`, `web-chat.controller.ts` contains a fallback query loading up to 50 channels across all tenants where `providerAccountId: null` to decrypt credentials in RAM.
- **Proposed Solution**:
  1. Remove the legacy fallback `findMany` call.
  2. Enforce `providerAccountId` non-null validation during web chat channel creation.
- **Acceptance Criteria**:
  - [ ] Line 324 `client.channel.findMany` removed from `web-chat.controller.ts`.
  - [ ] Widget configuration endpoint `GET /widget/config` resolves strictly via indexed `providerAccountId`.
  - [ ] All unit tests in `web-chat.controller.spec.ts` pass.

---

### `TASK-SEC-03`: Add Compound Unique Constraints to 10 Non-Commerce Prisma Models
- **Priority**: `P0` (Blocker)
- **Complexity**: `Medium`
- **Dependencies**: None
- **Affected Files**: `apps/server/prisma/schema.prisma`
- **Problem & Risk**:
  Prisma requires fields in `.update({ where })` and `.delete({ where })` to be unique. Because `schema.prisma` defines `@@unique([workspaceId, id])` only on Commerce models (`Order`, `Product`, etc.), developers could not pass `where: { workspaceId_id: { workspaceId, id } }` on non-commerce models, resulting in 54 mutations omitting `workspaceId`.
- **Proposed Solution**:
  Add `@@unique([workspaceId, id])` to the following 10 models in `apps/server/prisma/schema.prisma`:
  1. `Conversation`
  2. `Message`
  3. `Contact`
  4. `ChannelIdentity`
  5. `Inbox`
  6. `Channel`
  7. `Team`
  8. `Label`
  9. `CannedResponse`
  10. `AutomationRule`
  11. `WebhookSubscription`
- **Acceptance Criteria**:
  - [ ] `schema.prisma` contains `@@unique([workspaceId, id])` for all 10 specified models.
  - [ ] `pnpm nx run server:prisma-generate` (or `npx prisma generate`) completes with 0 errors.
  - [ ] Generated Prisma Client types expose `workspaceId_id` compound input filters for all 10 models.

---

### `TASK-SEC-04`: Refactor 54 Non-Commerce Service Mutations to Compound Unique Keys
- **Priority**: `P0` (Blocker)
- **Complexity**: `Large`
- **Dependencies**: `TASK-SEC-03`
- **Affected Files**:
  - `apps/server/src/modules/omnichannel/conversations/conversations.service.ts`
  - `apps/server/src/modules/omnichannel/messages/messages.service.ts`
  - `apps/server/src/modules/omnichannel/contacts/contacts.service.ts`
  - `apps/server/src/modules/omnichannel/inboxes/inboxes.service.ts`
  - `apps/server/src/modules/omnichannel/labels/labels.service.ts`
  - `apps/server/src/modules/identity/teams/teams.service.ts`
  - `apps/server/src/modules/omnichannel/canned-responses/canned-responses.service.ts`
  - `apps/server/src/modules/automation/automation-rules/automation-rules.service.ts`
  - `apps/server/src/modules/automation/webhooks/webhook-subscriptions.service.ts`
- **Problem & Risk**:
  54 mutation operations perform `update({ where: { id }, data })` or `delete({ where: { id } })`. This creates a TOCTOU race condition and violates `AGENTS.md` Directive 3.
- **Proposed Solution**:
  Refactor all 54 cataloged lines to use:
  ```ts
  await client.<model>.update({
    where: { workspaceId_id: { workspaceId, id } },
    data: { ... },
  });
  ```
- **Acceptance Criteria**:
  - [ ] All 54 lines cataloged in Section 3.4 of the Audit Report are refactored to compound unique keys.
  - [ ] Zero instances of `model.update({ where: { id } })` remain for organization resources in omnichannel/identity/automation modules.
  - [ ] All 1,023 backend unit tests pass without regression (`pnpm nx test server`).

---

### `TASK-SEC-05`: Refactor Commerce ShippingService Mutations to Use Existing Compound Keys
- **Priority**: `P1` (High)
- **Complexity**: `Small`
- **Dependencies**: None
- **Affected Files**: `apps/server/src/modules/commerce/shipping/shipping.service.ts` (lines 225, 255)
- **Problem & Risk**:
  `shipping.service.ts` mutates `shippingAddress` and `order` by bare `{ id }` even though `Order` and `ShippingAddress` already have `@@unique([workspaceId, id])` defined in `schema.prisma`.
- **Proposed Solution**:
  Replace `{ where: { id: order.shippingAddress.id } }` and `{ where: { id: order.id } }` with `{ where: { workspaceId_id: { workspaceId: order.workspaceId, id: ... } } }`.
- **Acceptance Criteria**:
  - [ ] Lines 225 and 255 in `shipping.service.ts` use `workspaceId_id`.
  - [ ] Unit tests in `shipping.service.spec.ts` pass.

---

### `TASK-SEC-06`: Prevent Facebook Page ID Cross-Tenant Ingestion Collision
- **Priority**: `P1` (High)
- **Complexity**: `Small`
- **Dependencies**: None
- **Affected Files**:
  - `apps/server/src/modules/omnichannel/integrations/facebook/facebook.service.ts`
  - `apps/server/src/modules/omnichannel/integrations/facebook/facebook.controller.ts`
- **Problem & Risk**:
  Inbound webhook lookup in `facebook.controller.ts:455` searches by `channelType: FACEBOOK_MESSENGER, providerAccountId: pageId`. Because `providerAccountId` is unique only per workspace, binding the same Facebook Page to multiple workspaces results in undefined routing.
- **Proposed Solution**:
  In `facebook.service.ts:connectPage`, add an uniqueness check across all active channels: reject connection if the Facebook Page ID is already connected to an active channel in another workspace.
- **Acceptance Criteria**:
  - [ ] Connecting an already-connected Facebook Page to a different workspace throws `ConflictException("This Facebook Page is already connected to another organization.")`.
  - [ ] Inbound webhooks deterministically resolve to the single authorized workspace.

---

### `TASK-CLEAN-01`: Fix Unbounded In-Memory Leak in `LinkPreviewService`
- **Priority**: `P1` (High)
- **Complexity**: `Small`
- **Dependencies**: None
- **Affected Files**: `apps/server/src/modules/omnichannel/conversations/link-preview.service.ts`
- **Problem & Risk**:
  `LinkPreviewService` stores preview metadata in an unbounded `Map<string, ...>`. Entries have an expiration timestamp, but there is no max size, no LRU eviction, and no periodic cleanup timer. High message volume will cause Node.js heap exhaustion and OOM crashes.
- **Proposed Solution**:
  Replace `new Map()` with an `lru-cache` instance capped at 1,000 items with a 24-hour TTL, or delegate to Redis via `SET ... EX 86400`.
- **Acceptance Criteria**:
  - [ ] `LinkPreviewService` cache is strictly bounded (max 1,000 entries).
  - [ ] Expired entries are automatically evicted from memory.
  - [ ] Unit tests confirm link preview retrieval, caching, and cache eviction under limit.

---

### `TASK-CLEAN-02`: Delete Dead Code `transferIdentities()` in `ContactsService`
- **Priority**: `P1` (High)
- **Complexity**: `Small`
- **Dependencies**: None
- **Affected Files**: `apps/server/src/modules/omnichannel/contacts/contacts.service.ts` (lines 846–865)
- **Problem & Risk**:
  `transferIdentities()` is an uncalled dead method that performs an un-scoped `updateMany` across tenants (FINDING-SEC-03).
- **Proposed Solution**:
  Remove `transferIdentities()` from `contacts.service.ts`.
- **Acceptance Criteria**:
  - [ ] Method `transferIdentities` is deleted.
  - [ ] TypeScript typecheck passes with 0 errors.

---

### `TASK-CLEAN-03`: Prune Unused Runtime Dependencies from `apps/web/package.json`
- **Priority**: `P2` (Medium)
- **Complexity**: `Small`
- **Dependencies**: None
- **Affected Files**: `apps/web/package.json`
- **Problem & Risk**:
  `shadcn` CLI is erroneously listed in runtime `dependencies`. `vaul`, `react-day-picker`, and `@base-ui/react` are only consumed by unused primitives.
- **Proposed Solution**:
  Remove `shadcn`, `vaul`, `react-day-picker`, and `@base-ui/react` from `apps/web/package.json`.
- **Acceptance Criteria**:
  - [ ] Packages removed from `apps/web/package.json`.
  - [ ] `pnpm install` succeeds cleanly.

---

### `TASK-CLEAN-04`: Prune 13 Unused Shadcn UI Primitives
- **Priority**: `P2` (Medium)
- **Complexity**: `Small`
- **Dependencies**: `TASK-CLEAN-03`
- **Affected Files**: `apps/web/src/components/ui/`
- **Problem & Risk**:
  13 pre-generated UI primitives are never imported anywhere in `apps/web/src`, causing dead code bloat.
- **Proposed Solution**:
  Delete the following unused files:
  `accordion.tsx`, `calendar.tsx`, `combobox.tsx`, `context-menu.tsx`, `drawer.tsx`, `item.tsx`, `menubar.tsx`, `navigation-menu.tsx`, `pagination.tsx`, `questionnaire.tsx`, `radio-group.tsx`, `slider.tsx`, `toggle-group.tsx`.
- **Acceptance Criteria**:
  - [ ] The 13 unreferenced files are deleted.
  - [ ] `pnpm --filter @sales-copilot/web exec tsc --noEmit` exits with code 0.
  - [ ] All 26 web test suites pass (`pnpm nx test web`).

---

## 4. Phase 2: Core Feature Completion

### `TASK-FEAT-01`: Implement Contacts CRM Management Workbench
- **Priority**: `P1` (High)
- **Complexity**: `Medium`
- **Dependencies**: None (Can run in parallel with Phase 1)
- **Affected Files**:
  - `apps/web/src/app/(workspace)/[workspaceSlug]/contacts/page.tsx`
  - `apps/web/src/features/contacts/components/contacts-table.tsx`
  - `apps/web/src/features/contacts/components/create-contact-dialog.tsx`
  - `apps/web/src/features/contacts/components/contact-detail-sheet.tsx`
- **Problem & Current State**:
  `ContactsController` has 10 production endpoints and `useContacts` hooks exist, but `contacts/page.tsx` renders only `/empty-contacts.svg`.
- **Proposed Solution**:
  1. Build `ContactsTable` component with search debounce, tag/channel filters, and pagination.
  2. Implement `CreateContactDialog` for manual customer creation.
  3. Implement `ContactDetailSheet` displaying customer details, associated conversation history, and past order transactions.
- **Acceptance Criteria**:
  - [ ] `/contacts` route displays active customer records fetched via `useContacts()`.
  - [ ] Search input queries backend `GET /contacts/search` across name, phone, and email.
  - [ ] Clicking a contact row opens `ContactDetailSheet`.
  - [ ] "Add Contact" button creates a new record via `POST /contacts` and invalidates query cache.

---

### `TASK-FEAT-02`: Implement Atomic Contact Merge & Identity Linking UI
- **Priority**: `P1` (High)
- **Complexity**: `Medium`
- **Dependencies**: `TASK-FEAT-01`
- **Affected Files**:
  - `apps/web/src/features/contacts/components/contact-merge-dialog.tsx`
  - `apps/web/src/features/contacts/components/contact-identities-card.tsx`
- **Problem & Current State**:
  Backend `POST /contacts/merge` and identity link/unlink endpoints are fully functional, but no frontend UI exists to resolve duplicate customers.
- **Proposed Solution**:
  1. Create `ContactMergeDialog` allowing agents to select a secondary contact, preview merged fields, and execute atomic deduplication.
  2. Create `ContactIdentitiesCard` in `ContactDetailSheet` to view and link/unlink external identities (Facebook PSID, Telegram Chat ID, Web visitor session).
- **Acceptance Criteria**:
  - [ ] Merge dialog displays field-by-field diff (name, phone, attributes).
  - [ ] Executing merge reassigns conversations and orders to the primary contact and soft-deletes the mergee.
  - [ ] Toast notification confirms merge completion and table re-fetches.

---

### `TASK-FEAT-03`: Connect 3PL Shipping Carrier Actions & Tracking Modal in OMS Workbench
- **Priority**: `P1` (High)
- **Complexity**: `Medium`
- **Dependencies**: None
- **Affected Files**:
  - `apps/web/src/features/commerce/components/order-detail-sheet.tsx`
  - `apps/web/src/features/commerce/components/carrier-dispatch-dialog.tsx`
  - `apps/web/src/features/commerce/components/carrier-tracking-modal.tsx`
- **Problem & Current State**:
  `ShippingController` has 4 production endpoints (quote, dispatch, track, cancel via GHN/GHTK) and methods exist in `commerceApi`, but `OrderDetailSheet` has no UI triggers for dispatching or tracking.
- **Proposed Solution**:
  1. In `OrderDetailSheet`, add "Dispatch Shipment" button for `CONFIRMED` or `PAID` orders.
  2. Implement `CarrierDispatchDialog`: selects carrier (GHN / GHTK), fetches dynamic quotes, calculates COD amount, and dispatches shipment.
  3. Implement `CarrierTrackingModal`: displays carrier tracking code and chronological milestone timeline fetched from `GET /shipping/orders/:orderId/track`.
  4. Add "Cancel Shipment" action for in-transit orders.
- **Acceptance Criteria**:
  - [ ] Order detail sheet displays carrier status badge and tracking number when dispatched.
  - [ ] "Dispatch" button invokes `commerceApi.dispatchOrder` and transitions order status to `SHIPPED`.
  - [ ] "Track" button renders visual delivery timeline with timestamps.
  - [ ] Thermal print dialog includes carrier tracking barcode.

---

### `TASK-FEAT-04`: Implement Bank Reconciliation Ledger Screen & Query API
- **Priority**: `P1` (High)
- **Complexity**: `Medium`
- **Dependencies**: None
- **Affected Files**:
  - `apps/server/src/modules/commerce/reconciliation/reconciliation.controller.ts` (New)
  - `apps/web/src/app/(workspace)/[workspaceSlug]/reconciliation/page.tsx`
  - `apps/web/src/features/commerce/components/reconciliation-ledger-table.tsx`
  - `apps/web/src/features/commerce/components/manual-match-dialog.tsx`
- **Problem & Current State**:
  `PaymentWebhooksController` ingests bank transfers and BullMQ reconciles orders, but there is no query endpoint and `/reconciliation/page.tsx` renders `<FeaturePlaceholder />`.
- **Proposed Solution**:
  1. Create `ReconciliationController` with `GET /reconciliation/transactions`: lists `PaymentTransaction` records with status filter (`RECONCILED`, `PENDING_MATCH`, `FAILED`), pagination, and date range.
  2. Create `POST /reconciliation/transactions/:id/manual-match`: allows cashier to link an un-matched bank transfer to an order.
  3. Replace `/reconciliation/page.tsx` placeholder with `ReconciliationLedgerTable` showing bank transaction code, memo, amount, matched order, and match status.
- **Acceptance Criteria**:
  - [ ] `/reconciliation` displays live bank transfers with match status badges.
  - [ ] Inbound SePay/Casso transactions appear in the ledger in real time via Socket.io.
  - [ ] Cashier can manually match unmatched transactions to a specific order ID.

---

### `TASK-FEAT-05`: Implement Tenant Workspace Audit Logs Screen
- **Priority**: `P2` (Medium)
- **Complexity**: `Small`
- **Dependencies**: None
- **Affected Files**:
  - `apps/web/src/app/(workspace)/[workspaceSlug]/settings/audit-logs/page.tsx` (New)
  - `apps/web/src/features/identity/components/tenant-audit-logs-table.tsx`
  - `apps/web/src/features/identity/settings-nav-items.ts`
- **Problem & Current State**:
  Backend `AuditLogsController` has `GET /audit-logs` (requires `OWNER`/`ADMIN`), but no tenant settings UI screen exists.
- **Proposed Solution**:
  1. Create `app/(workspace)/[workspaceSlug]/settings/audit-logs/page.tsx`.
  2. Build `TenantAuditLogsTable` displaying actor, action, resource type, timestamp, and metadata diff modal.
  3. Add "Nhật ký hoạt động" navigation item to settings sidebar.
- **Acceptance Criteria**:
  - [ ] Tenant owners/admins can navigate to `/settings/audit-logs`.
  - [ ] Table lists all audit events for the current workspace.
  - [ ] Non-admin agents receive 403 Forbidden access denial.

---

### `TASK-FEAT-06`: Implement AI Copilot Policy & BYOK Settings UI
- **Priority**: `P2` (Medium)
- **Complexity**: `Medium`
- **Dependencies**: None
- **Affected Files**:
  - `apps/web/src/features/omnichannel/components/tab-ai-settings.tsx`
  - `apps/server/src/modules/intelligence/ai-agent.service.ts`
- **Problem & Current State**:
  The AI Autopilot engine runs with global defaults; tenant administrators have no UI to customize sales tone, set maximum automated discount percentage limits, or supply their own Google Gemini API key (BYOK).
- **Proposed Solution**:
  1. Expand `tab-ai-settings.tsx` in Inbox Settings with controls for:
     - Autopilot Mode toggle (Assistive Suggestion vs Full Autopilot).
     - Custom System Instructions / Brand Tone textarea.
     - Max Automated Discount % slider (0% to 20%).
     - Custom Gemini API Key input (encrypted in database).
  2. Connect form to `PATCH /inboxes/:id` settings JSON.
- **Acceptance Criteria**:
  - [ ] Administrators can update AI prompt instructions and discount limit per inbox.
  - [ ] `AiAgentWorker` adheres to the inbox's custom prompt and discount cap during tool execution.

---

### `TASK-FEAT-07`: Implement Tenant Analytics Dashboards (Phase 2C)
- **Priority**: `P2` (Medium)
- **Complexity**: `Large`
- **Dependencies**: None
- **Affected Files**:
  - `apps/server/src/modules/commerce/analytics/tenant-analytics.controller.ts` (New)
  - `apps/web/src/app/(workspace)/[workspaceSlug]/analytics/overview/page.tsx`
  - `apps/web/src/app/(workspace)/[workspaceSlug]/analytics/channels/page.tsx`
  - `apps/web/src/app/(workspace)/[workspaceSlug]/analytics/agents/page.tsx`
- **Problem & Current State**:
  All three analytics routes render `<FeaturePlaceholder />`.
- **Proposed Solution**:
  1. Build backend aggregation service querying GMV, conversion rates, channel attribution, and agent response times.
  2. Implement Overview dashboard with KPI cards and revenue trends.
  3. Implement Channel Attribution dashboard comparing Facebook, Web Chat, and Telegram.
  4. Implement Agent Productivity leaderboard.
- **Acceptance Criteria**:
  - [ ] Overview screen renders live GMV, order volume, and average order value (AOV).
  - [ ] Channel analytics graphs order volume and message count per channel.
  - [ ] Agent leaderboard displays response times and closed conversations.

---

## 5. Phase 3: Optimization & Expansion

### `TASK-EXP-01`: Multi-Warehouse Inventory & Stock Allocation Engine
- **Priority**: `P3` (Expansion)
- **Complexity**: `Large`
- **Dependencies**: `TASK-SEC-03`
- **Affected Files**:
  - `apps/server/prisma/schema.prisma`
  - `apps/server/src/modules/commerce/inventory/`
  - `apps/web/src/features/commerce/`
- **Description**:
  Introduce `Warehouse` and `WarehouseStock` models in `schema.prisma`. Support multi-location inventory tracking, warehouse transfer orders, and location-based fulfillment routing.
- **Acceptance Criteria**:
  - [ ] Schema includes `Warehouse` and `WarehouseStock` with `@@unique([workspaceId, id])`.
  - [ ] Inventory adjustments and order reservations specify source warehouse.
  - [ ] Web UI allows switching warehouse views.

---

### `TASK-EXP-02`: Promotional Coupons & Campaign Discount Rules Engine
- **Priority**: `P3` (Expansion)
- **Complexity**: `Large`
- **Dependencies**: `TASK-SEC-03`
- **Affected Files**:
  - `apps/server/prisma/schema.prisma`
  - `apps/server/src/modules/commerce/discounts/` (New)
  - `apps/web/src/features/commerce/`
- **Description**:
  Implement dedicated `Coupon` and `PromotionRule` models supporting coupon codes, minimum order value constraints, usage limits, percentage/fixed discounts, and scheduled marketing campaigns.
- **Acceptance Criteria**:
  - [ ] Cashiers and AI Autopilot can validate and apply voucher codes (`DISCOUNT20`).
  - [ ] Coupons enforce expiration date and per-customer usage limits.

---

### `TASK-EXP-03`: Official Zalo OA Channel Ingestion & Chatwoot Parity
- **Priority**: `P3` (Expansion)
- **Complexity**: `Large`
- **Dependencies**: `TASK-SEC-03`
- **Affected Files**: `apps/server/src/modules/omnichannel/integrations/zalo/`
- **Description**:
  Implement Zalo Official Account OpenAPI v3 webhook ingress, OAuth token refresh lifecycle, interactive message templates, and customer profile synchronization.
- **Acceptance Criteria**:
  - [ ] Inbound Zalo OA user messages route into unified conversation inbox.
  - [ ] Agents can reply with text, images, and quick-order cards.

---

### `TASK-EXP-04`: Inbound & Outbound Email Ticketing Subsystem
- **Priority**: `P3` (Expansion)
- **Complexity**: `Large`
- **Dependencies**: `TASK-SEC-03`
- **Affected Files**: `apps/server/src/modules/omnichannel/integrations/email/`
- **Description**:
  Implement inbound email forwarding ingestion (SendGrid/Mailgun webhook parsing) and outbound SMTP reply delivery with threaded subject headers (`Re: [Ticket #ID]`).
- **Acceptance Criteria**:
  - [ ] Customer emails create conversations; agent replies are sent via SMTP.

---

### `TASK-EXP-05`: ViettelPost & Ahamove Logistics Adapters
- **Priority**: `P3` (Expansion)
- **Complexity**: `Medium`
- **Dependencies**: `TASK-FEAT-03`
- **Affected Files**: `apps/server/src/modules/commerce/shipping/adapters/`
- **Description**:
  Implement ViettelPost nationwide shipping and Ahamove on-demand instant delivery adapters.
- **Acceptance Criteria**:
  - [ ] Rate quotes and dispatch requests execute successfully against carrier sandbox endpoints.

---

## 6. Master Roadmap Summary Matrix

| Task ID | Task Title | Phase | Priority | Complexity | Lead Subsystem | Dependencies | Target Timeline |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- | :---: |
| `TASK-SEC-01` | Fix WebChat Gateway Cross-Tenant Channel Scan | 1 | `P0` | `Small` | Omnichannel / WebChat | None | Day 1 |
| `TASK-SEC-02` | Fix WebChat Controller Fallback Scan | 1 | `P0` | `Small` | Omnichannel / WebChat | None | Day 1 |
| `TASK-SEC-03` | Add Compound Keys to 10 Models in Schema | 1 | `P0` | `Medium` | Prisma ORM / Database | None | Day 2 |
| `TASK-SEC-04` | Refactor 54 Service Mutations to Compound Key | 1 | `P0` | `Large` | Backend Monolith | `TASK-SEC-03` | Days 3–5 |
| `TASK-SEC-05` | Fix ShippingService Commerce Mutations | 1 | `P1` | `Small` | Commerce / Shipping | None | Day 2 |
| `TASK-SEC-06` | Guard Facebook Page ID Cross-Tenant Ingestion | 1 | `P1` | `Small` | Integrations / Facebook | None | Day 3 |
| `TASK-CLEAN-01` | Fix Unbounded Memory Leak in LinkPreview | 1 | `P1` | `Small` | Omnichannel / Cache | None | Day 2 |
| `TASK-CLEAN-02` | Delete Dead Method `transferIdentities()` | 1 | `P1` | `Small` | Omnichannel / Contacts | None | Day 1 |
| `TASK-CLEAN-03` | Prune Unused Runtime Dependencies in Web | 1 | `P2` | `Small` | Web Package Config | None | Day 2 |
| `TASK-CLEAN-04` | Prune 13 Unused Shadcn UI Primitives | 1 | `P2` | `Small` | Web UI Components | `TASK-CLEAN-03` | Day 3 |
| `TASK-FEAT-01` | Implement Contacts CRM Table Screen | 2 | `P1` | `Medium` | Web UI / Contacts | None | Week 3 |
| `TASK-FEAT-02` | Implement Contact Merge & Identity Linking UI | 2 | `P1` | `Medium` | Web UI / Contacts | `TASK-FEAT-01` | Week 3 |
| `TASK-FEAT-03` | Connect 3PL Shipping Actions in OMS Workbench | 2 | `P1` | `Medium` | Web UI / Commerce | None | Week 4 |
| `TASK-FEAT-04` | Build Bank Reconciliation Ledger Screen & API | 2 | `P1` | `Medium` | Commerce / Payments | None | Week 4 |
| `TASK-FEAT-05` | Build Tenant Workspace Audit Logs Screen | 2 | `P2` | `Small` | Web UI / Identity | None | Week 4 |
| `TASK-FEAT-06` | Build AI Copilot Policy & BYOK Settings UI | 2 | `P2` | `Medium` | Intelligence / UI | None | Week 5 |
| `TASK-FEAT-07` | Implement Tenant Analytics Dashboards (2C) | 2 | `P2` | `Large` | Analytics / UI | None | Week 5 |
| `TASK-EXP-01` | Multi-Warehouse Stock & Transfer Routing | 3 | `P3` | `Large` | Commerce / Inventory | `TASK-SEC-03` | Weeks 6–7 |
| `TASK-EXP-02` | Promotional Coupons & Campaign Rules Engine | 3 | `P3` | `Large` | Commerce / Discounts | `TASK-SEC-03` | Weeks 7–8 |
| `TASK-EXP-03` | Official Zalo OA Channel Ingestion | 3 | `P3` | `Large` | Integrations / Zalo | `TASK-SEC-03` | Week 8 |
| `TASK-EXP-04` | Inbound / Outbound Email Ticketing | 3 | `P3` | `Large` | Integrations / Email | `TASK-SEC-03` | Week 9 |
| `TASK-EXP-05` | ViettelPost & Ahamove Logistics Adapters | 3 | `P3` | `Medium` | Commerce / Shipping | `TASK-FEAT-03` | Week 9 |

---

> **Plan Sign-off**: This phased roadmap provides an actionable, verified, and complete engineering plan to eliminate vulnerabilities, complete all core commercial workflows, and scale Sales Copilot to an enterprise-grade omnichannel platform.
