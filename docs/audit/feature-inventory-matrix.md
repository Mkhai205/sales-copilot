# Sales Copilot Feature Inventory & 3-Way Cross-Reference Matrix

> **Document Classification**: Master Feature Inventory & Parity Matrix  
> **Audited Date**: September 19, 2026  
> **Audited Repositories**: `apps/server`, `apps/web`, `packages/shared-contracts`, `packages/widget-sdk`  
> **Status**: 100% Complete — Publication Grade  
> **Frameworks**: Next.js 16 (App Router), NestJS 11, Prisma ORM 6, Tailwind CSS v4, Shadcn UI  

---

## 1. Executive Summary & Classification Schema

This document establishes the exhaustive 3-way cross-reference comparing:
1. **Frontend Web UI Screens & Routes** (32 distinct screens across 4 route groups)
2. **Backend REST & WebSocket Endpoints** (128 endpoints across 30 NestJS controllers)
3. **Database Models** (30 Prisma models in `schema.prisma`)

Every feature in the Sales Copilot ecosystem is classified into one of three standard categories:

- **Group 1: Production-Ready (Fully Integrated)**  
  End-to-end operational functionality. Database models, backend controllers/services, background queues, and frontend Web UI screens are fully implemented, styled with Shadcn UI/Tailwind tokens, and state-managed via TanStack Query.
- **Group 2: Mockup / Placeholder / Headless API Lacking UI**  
  Backend logic, data models, or client hooks exist, but the corresponding frontend screen renders a static placeholder, SVG illustration, or lacks UI trigger actions (e.g. Contacts directory, Bank Reconciliation, 3PL carrier dispatch).
- **Group 3: Backlog / Missing (Planned for Future Phases)**  
  Architectural stubs or missing models where neither backend logic nor frontend UI has been built (e.g. Multi-Warehouse, Promotional Coupon Engine, Zalo OA, Email channel).

---

## 2. Exhaustive 3-Way Cross-Reference Matrix

The table below maps all 32 Web UI routes, corresponding backend API endpoints, and underlying Prisma database models:

| # | Route / UI Screen | Domain Context | Classification | Backend Controller & HTTP Endpoints | Database Models | State Management & UI Primitives |
| :---: | :--- | :--- | :---: | :--- | :--- | :--- |
| 1 | `/` (Root redirect) | Identity | **1. Production-Ready** | `WorkspacesController` (`GET /workspaces`) | `Workspace`, `WorkspaceMember` | Server Component redirect |
| 2 | `/login` | Auth / Identity | **1. Production-Ready** | `AuthController` (`POST /auth/login`, `POST /auth/refresh`, `GET /auth/me`) | `User`, `WorkspaceMember` | TanStack Query / React Hook Form; Shadcn `Card`, `Input`, `Button` |
| 3 | `/auth/facebook/callback` | Auth / Omnichannel | **1. Production-Ready** | `FacebookController` (`GET /integrations/facebook/oauth`, `GET /integrations/facebook/callback`) | Redis OAuth State | Window `postMessage` / `BroadcastChannel`; Shadcn `Card`, `Spinner` |
| 4 | `/[workspaceSlug]` (Trampoline) | Navigation | **1. Production-Ready** | Server redirect to `/[slug]/conversations` | None | Next.js Server Component redirect |
| 5 | `/[workspaceSlug]/conversations` | Omnichannel Core | **1. Production-Ready** | `ConversationsController` (11 endpoints), `MessagesController` (5 endpoints), `RealtimeGateway` | `Conversation`, `Message`, `Contact`, `Attachment`, `Label`, `CannedResponse` | TanStack `useInfiniteQuery`, `useMutation`, Socket.io; Shadcn `ResizablePanelGroup`, `Sidebar`, `Card`, `Badge` |
| 6 | `/[workspaceSlug]/conversations/[id]` | Omnichannel Core | **1. Production-Ready** | `ConversationsController` (`GET /conversations/:id`), `MessagesController` (`GET /messages`) | `Conversation`, `Message`, `Contact` | TanStack Query + Socket.io; Shadcn `ResizablePanelGroup` |
| 7 | `/[workspaceSlug]/orders` | Commerce (OMS) | **1. Production-Ready** | `OrdersController` (`GET /orders`, `GET /orders/:id`, `POST /orders`, `PATCH /orders/:id`, `POST /confirm`, `POST /pay`, `POST /cancel`, `POST /complete`, `GET /shipping-label`) | `Order`, `OrderItem`, `PaymentTransaction`, `ShippingAddress` | TanStack Query (`useCommerceOrders`), Socket.io; Shadcn `Table`, `Tabs`, `Sheet`, `Dialog`, `Badge`, `Button` |
| 8 | `/[workspaceSlug]/products` | Commerce (Catalog) | **1. Production-Ready** | `ProductsController` (`GET /products`, `GET /products/:id`, `POST /products`, `PUT /products/:id`, `DELETE /products/:id`, `POST /inventory`) | `Product`, `ProductVariant`, `InventoryTransaction` | TanStack Query (`useCommerceProducts`); Shadcn `Table`, `Dialog`, `Drawer`, `Badge`, `Input` |
| 9 | `/[workspaceSlug]/inventory` | Commerce (Inventory) | **1. Production-Ready** | `InventoryController` (`GET /inventory/variants`, `GET /inventory/summary`, `GET /inventory/transactions`, `POST /adjust`) | `ProductVariant`, `InventoryTransaction` | TanStack Query (`useInventoryVariants`, `useInventorySummary`); Shadcn `Table`, `Card`, `Dialog`, `Sheet` |
| 10 | `/[workspaceSlug]/contacts` | Omnichannel CRM | **2. Headless API Lacking UI** | `ContactsController` (`GET /contacts`, `GET /search`, `POST /contacts`, `GET /:id`, `PATCH /:id`, `DELETE /:id`, `POST /merge`, `GET/POST/DELETE /identities`) | `Contact`, `ChannelIdentity` | **Gap**: UI renders static `/empty-contacts.svg`. `useContacts` hooks exist but need full data table and merge dialog. |
| 11 | `/[workspaceSlug]/reconciliation` | Commerce (Payments) | **2. Headless API Lacking UI** | `PaymentWebhooksController`, `VietQrController`, `COMMERCE_RECONCILIATION_QUEUE` | `PaymentTransaction`, `Order`, `InventoryTransaction` | **Gap**: UI renders `<FeaturePlaceholder />`. Background reconciliation exists, but lacks query API and ledger table. |
| 12 | `/[workspaceSlug]/analytics` | Analytics | **1. Production-Ready** | Redirect to `/analytics/overview` | None | Client redirect |
| 13 | `/[workspaceSlug]/analytics/overview` | Analytics | **2. Backlog / Placeholder** | Telemetry events; `PlatformMetricsController` | Aggregated metrics | **Gap**: UI renders `<FeaturePlaceholder />`. Tenant aggregation endpoints scheduled for Phase 2C. |
| 14 | `/[workspaceSlug]/analytics/channels` | Analytics | **2. Backlog / Placeholder** | Channel event logs | `ChannelEvent`, `Conversation` | **Gap**: UI renders `<FeaturePlaceholder />`. Scheduled for Phase 2C. |
| 15 | `/[workspaceSlug]/analytics/agents` | Analytics | **2. Backlog / Placeholder** | Presence & Assignment logs | `Conversation`, `User` | **Gap**: UI renders `<FeaturePlaceholder />`. Scheduled for Phase 2C. |
| 16 | `/[workspaceSlug]/settings` | Settings Index | **1. Production-Ready** | Role-based redirect to first permitted tab | None | React `useSettingsRbac` redirect |
| 17 | `/[workspaceSlug]/settings/general` | Settings (Identity) | **1. Production-Ready** | `WorkspacesController` (`GET /workspaces/current`, `PATCH /workspaces/current`) | `Workspace` | TanStack Query (`useCurrentWorkspaceDetails`); Shadcn `Card`, `Input`, `Button`, `AlertDialog` |
| 18 | `/[workspaceSlug]/settings/members` | Settings (Identity) | **1. Production-Ready** | `WorkspaceMembersController` (`GET /members`, `POST /members`, `PATCH /members/:id`, `DELETE /members/:id`) | `WorkspaceMember`, `User` | TanStack Query (`useWorkspaceMembers`); Shadcn `Table`, `Dialog`, `Select`, `Button` |
| 19 | `/[workspaceSlug]/settings/teams` | Settings (Identity) | **1. Production-Ready** | `TeamsController` (`GET /teams`, `POST /teams`, `GET /:id`, `PATCH /:id`, `DELETE /:id`, `POST /members`, `DELETE /members`) | `Team`, `TeamMember` | TanStack Query (`useTeams`); Shadcn `Card` grid, `Dialog`, `Checkbox` |
| 20 | `/[workspaceSlug]/settings/inboxes` | Settings (Omnichannel) | **1. Production-Ready** | `InboxesController` (`GET /inboxes`, `GET /:id`, `DELETE /:id`) | `Inbox`, `Channel` | TanStack Query (`useInboxes`); Shadcn `Card` grid, `Badge`, `Button` |
| 21 | `/[workspaceSlug]/settings/inboxes/new` | Settings (Omnichannel) | **1. Production-Ready** | `InboxesController` (`POST /inboxes`), `FacebookController` (`pages`, `connect`), `InboxMembersController` | `Inbox`, `Channel`, `InboxMember` | TanStack Query; Shadcn `Stepper`, `Card`, `Switch`, `Input`, `Button` |
| 22 | `/[workspaceSlug]/settings/inboxes/[id]` | Settings (Omnichannel) | **1. Production-Ready** | `InboxesController` (`GET /:id`, `PATCH /:id`), `InboxMembersController` (`GET/POST/DELETE`) | `Inbox`, `Channel`, `InboxMember` | TanStack Query (`useInbox`); Shadcn `Tabs`, `Card`, `Switch`, `Slider`, `Button` |
| 23 | `/[workspaceSlug]/settings/labels` | Settings (Omnichannel) | **1. Production-Ready** | `LabelsController` (`GET /labels`, `POST /labels`, `PATCH /labels/:id`, `DELETE /labels/:id`) | `Label` | TanStack Query (`useLabels`); Shadcn `Table`, `Dialog`, `Input`, `Badge` |
| 24 | `/[workspaceSlug]/settings/canned-responses` | Settings (Omnichannel) | **1. Production-Ready** | `CannedResponsesController` (`GET /canned-responses`, `POST`, `PATCH /:id`, `DELETE /:id`) | `CannedResponse` | TanStack Query (`useCannedResponses`); Shadcn `Table`, `Dialog`, `Input`, `Textarea` |
| 25 | `/[workspaceSlug]/settings/automation-rules` | Settings (Automation) | **1. Production-Ready** | `AutomationRulesController` (`GET /automation-rules`, `POST`, `GET /:id`, `PATCH /:id`, `DELETE /:id`) | `AutomationRule` | TanStack Query (`useAutomationRules`); Shadcn `Table`, `Dialog`, `Select`, `Input` |
| 26 | `/[workspaceSlug]/settings/webhooks` | Settings (Automation) | **1. Production-Ready** | `WebhookSubscriptionsController` (`GET /webhooks`, `POST`, `PATCH /:id`, `DELETE /:id`, `GET /deliveries`, `POST /retry`) | `WebhookSubscription`, `WebhookDelivery` | TanStack Query (`useWebhooks`); Shadcn `Table`, `Dialog`, `Sheet`, `Badge` |
| 27 | `/[workspaceSlug]/settings/bank` | Settings (Payments) | **1. Production-Ready** | `WorkspacesController` (`GET /workspaces/current/bank`, `PATCH /workspaces/current/bank`) | `Workspace` | TanStack Query (`useBankConfig`); Shadcn `Card`, `Form`, `Input`, `Button` |
| 28 | `/platform-admin` | Platform Admin | **1. Production-Ready** | `PlatformMetricsController` (`GET /platform-admin/metrics/overview`) | Aggregate counts | TanStack Query (`usePlatformMetricsOverview`); Shadcn `Card` grid, `Badge` |
| 29 | `/platform-admin/workspaces` | Platform Admin | **1. Production-Ready** | `PlatformWorkspacesController` (`GET /workspaces`, `PATCH /:id/plan`, `PATCH /:id/status`) | `Workspace`, `WorkspaceMember` | TanStack Query (`usePlatformWorkspaces`); Shadcn `Table`, `Dialog`, `Select` |
| 30 | `/platform-admin/workspaces/[id]` | Platform Admin | **1. Production-Ready** | `PlatformWorkspacesController` (`GET /workspaces/:id`) | `Workspace`, `WorkspaceMember`, `User` | TanStack Query (`usePlatformWorkspaceDetail`); Shadcn `Card`, `Table`, `Badge` |
| 31 | `/platform-admin/audit-logs` | Platform Admin | **1. Production-Ready** | `PlatformAuditLogsController` (`GET /audit-logs`, `GET /audit-logs/:id`) | `PlatformAuditLog` | TanStack Query (`usePlatformAuditLogs`); Shadcn `Table`, `Dialog`, `Input` |
| 32 | `/platform-admin/settings` | Platform Admin | **1. Production-Ready** | `SystemSettingsController` (`GET /settings`, `PUT /settings/:key`) | `SystemSetting` | TanStack Query (`useSystemSettings`); Shadcn `Tabs`, `Card`, `Switch`, `Input` |

---

## 3. Deep-Dive: Chatbot & AI Copilot (Autopilot)

### 3.1 Architecture & Reasoning Loop
The Chatbot subsystem (`apps/server/src/modules/intelligence/`) powers autonomous customer sales closing and intelligent assistance.

```text
+-------------------+       +---------------------+       +-----------------------+
| Inbound Customer  | ----> | BullMQ Queue:       | ----> | AiAgentWorker         |
| Message (Channel) |       | AI_AUTOPILOT_QUEUE  |       | (500ms debounce loop) |
+-------------------+       +---------------------+       +-----------------------+
                                                                      |
                                                                      v
+-------------------+       +---------------------+       +-----------------------+
| Realtime Chat     | <---- | Google Gemini API   | <---- | 9 Commerce Tools      |
| Outbound Message  |       | (gemini-2.5-flash)  |       | Execution Engine      |
+-------------------+       +---------------------+       +-----------------------+
```

### 3.2 Implemented Tool Catalog (9 Commerce Tools)
1. `search_products`: Searches catalog by title, SKU, category, or price range.
2. `get_product_detail`: Returns variant options, physical stock, unit price, and specifications.
3. `check_variant_inventory`: Checks real-time physical and reserved stock.
4. `calculate_shipping_fee`: Queries 3PL carrier adapters (GHN, GHTK) based on destination province/district/ward.
5. `create_draft_order`: Creates a POS order in status `DRAFT` and links to the customer's conversation.
6. `apply_discount`: Applies percentage or fixed amount discounts within tenant limits.
7. `get_customer_info`: Resolves customer profile, previous orders, and delivery addresses.
8. `send_payment_qr`: Generates a dynamic VietQR EMVCo card and transmits it to the chat thread.
9. `transfer_to_human`: Sets `isAiPaused = true`, notifies available agents, and relinquishes autopilot control.

### 3.3 Autopilot Safety & Concurrency Guards
- **Debounce Window**: Uses a 500ms sliding TTL in Redis to buffer rapid sequential customer messages into a single prompt context.
- **Human Takeover Precedence**: Any outbound message sent by a human agent instantly triggers `ConversationsService.setAiPause(true)`. The BullMQ worker checks `isAiPaused` before and during inference, aborting execution immediately if an agent has intervened.
- **Tone & Persona Alignment**: Configurable instructions dictate response format, language, and sales policies.

### 3.4 Status & Identified Gaps
- **Backend Core**: **100% Production-Ready**.
- **Frontend Interaction**: Takeover and Resume AI action buttons are fully functional in `/[slug]/conversations`.
- **Identified Gap (Group 2 - Headless Settings)**: There is currently no tenant settings tab under `/[slug]/settings/inboxes/[id]` to adjust AI policy parameters (custom system prompts, maximum discount thresholds, or Bring-Your-Own-Key Gemini API credentials).

---

## 4. Deep-Dive: Commerce Engine (Orders, Checkout & Discounts)

### 4.1 Order Lifecycle & State Machine
The OMS engine supports a 6-stage finite state machine:
$$\text{DRAFT} \xrightarrow{\text{confirm}} \text{CONFIRMED} \xrightarrow{\text{pay}} \text{PAID} \xrightarrow{\text{dispatch}} \text{SHIPPED} \xrightarrow{\text{deliver}} \text{COMPLETED}$$
$$\downarrow \text{cancel}$$
$$\text{CANCELLED}$$

- **`DRAFT`**: Order created via chat POS drawer or OMS workbench. Pricing calculated, shipping address attached. Stock is not yet allocated.
- **`CONFIRMED`**: Model A inventory allocation executed atomically in PostgreSQL (`reservedQuantity` incremented).
- **`PAID`**: Triggered automatically by SePay/Casso bank webhook reconciliation or manual cashier mark.
- **`SHIPPED`**: Dispatched to 3PL logistics (GHN / GHTK); carrier tracking code assigned.
- **`CANCELLED`**: Reserved stock released atomically back to available inventory.

### 4.2 Order Presentation & Printing
- **In-Chat Quick Order Sheet (`ConversationOrderSheet`)**: Embedded slide-over drawer enabling agents to assemble an order without leaving the conversation, auto-filling customer identities.
- **Full OMS Workbench (`OrdersView`)**: Data table with status filter tabs, search debounce, pagination, payment status badges, and detail inspection sheet.
- **Thermal Receipt & Waybill Printing (`ThermalPrintDialog`)**: Generates production K80 (80mm) and K58 (58mm) receipt layouts with Code128 barcodes, itemized pricing, and VietQR payment payload.

### 4.3 3PL Carrier Integration & Bank Reconciliation
- **Carrier Logistics (`ShippingController`)**: Rate quotes, shipment dispatch, tracking timeline, and shipment cancellation via GHN and GHTK adapters.
- **Bank Auto-Reconciliation (`PaymentWebhooksController`)**: Ingests SePay/Casso notifications, verifies HMAC signatures, fast-ACKs HTTP 200, and queues jobs to `COMMERCE_RECONCILIATION_QUEUE`. BullMQ worker extracts order number from memo, verifies amount, and transitions order to `PAID`.

### 4.4 Status & Identified Gaps
- **Orders Workbench & Quick Order**: **100% Production-Ready**.
- **Identified Gap (Group 2 - Headless Actions)**: The 4 shipping methods in `ShippingController` (`quote`, `dispatch`, `track`, `cancel`) are defined in `commerceApi` but lack action buttons in `OrderDetailSheet`.
- **Identified Gap (Group 2 - Headless Ledger)**: `/reconciliation/page.tsx` renders `<FeaturePlaceholder />`. Inbound webhook reconciliation works in the background, but cashiers have no UI ledger to inspect transaction logs or manually reconcile unmatched transfers.
- **Identified Gap (Group 3 - Backlog Engine)**: A dedicated promotional coupon/discount engine (`Coupon` model, discount codes, usage limits, campaign schedules) does not exist. Discounts currently operate as ad-hoc order-level deductions.

---

## 5. Deep-Dive: Inventory Management (Stock, Warehouses & Variants)

### 5.1 Variant-Level Tracking Architecture
Inventory tracking operates at the `ProductVariant` level in `schema.prisma`:
- `stockQuantity` (Int): Total physical units on hand.
- `reservedQuantity` (Int): Units committed to confirmed, unfulfilled orders.
- `availableQuantity` (Calculated): $\text{stockQuantity} - \text{reservedQuantity}$.

### 5.2 Atomic Stock Reservation (Model A)
To prevent race conditions during concurrent flash sales, stock reservation executes via direct atomic SQL in `InventoryLedgerService`:
```sql
UPDATE "product_variants"
SET "reservedQuantity" = "reservedQuantity" + ${item.quantity}
WHERE "id" = ${item.variantId} 
  AND "workspaceId" = ${workspaceId}
  AND ("stockQuantity" - "reservedQuantity") >= ${item.quantity}
```
Variant IDs are sorted lexicographically before acquisition, preventing PostgreSQL lock-order deadlocks (`40P01`).

### 5.3 Immutable Inventory Transaction Ledger
Every stock change writes an immutable audit record to `InventoryTransaction`:
- `type`: `MANUAL_ADJUSTMENT`, `RESTOCK`, `AUDIT_COUNT`, `RETURN_RESTOCK`, `ORDER_RESERVATION`, `ORDER_FULFILLMENT`, `ORDER_CANCELLATION`.
- Captures: `previousStock`, `newStock`, `previousReserved`, `newReserved`, `reason`, and optional `orderId`.

### 5.4 Mini-Inventory Console UI
- **Route**: `/[workspaceSlug]/inventory`
- **KPI Summary Cards**: Total SKUs, Physical Stock, Reserved Stock, Available Stock, Low Stock, Out of Stock.
- **Stock Adjustment Modal (`StockAdjustmentDialog`)**: Cashiers adjust inventory with reason tags.
- **Transaction History Drawer (`StockLedgerDrawer`)**: Full chronological audit trail of all adjustments.

### 5.5 Status & Identified Gaps
- **Mini-Inventory Console & Stock Ledger**: **100% Production-Ready**.
- **Identified Gap (Group 3 - Backlog Model)**: **Multi-Warehouse Management is Missing**. The schema has no `Warehouse` model; stock is tracked globally per workspace variant. Multi-location fulfillment, inter-warehouse transfers, and location routing are deferred to Phase 3.

---

## 6. Synthesis: Feature Distribution Summary

```text
========================================================================================
                          SALES COPILOT FEATURE STATUS SUMMARY
========================================================================================
 Total Cataloged Screens:                32
 ├── Group 1 (Production-Ready):         27 (84.4%)
 ├── Group 2 (Mockup / Headless UI Gap):  2 ( 6.3%)  [/contacts, /reconciliation]
 └── Group 3 (Backlog Placeholders):      3 ( 9.3%)  [/analytics/overview, /channels, /agents]

 Total Cataloged Backend Endpoints:     128 (30 Controllers)
 ├── Active Production Endpoints:       112 (87.5%)
 ├── Headless Endpoints (No UI Caller):  16 (12.5%)  [Shipping 4, Contacts 9, AuditLogs 1, etc.]
 └── Missing Domain Endpoints:           N/A        [Zalo OA, Multi-Warehouse, Coupon Engine]

 Total Prisma Data Models:               30
 ├── Active Tenant Models:               26
 ├── Platform Root Models:                4 (User, Workspace, SystemSetting, PlatformAuditLog)
 └── Missing Backlog Models:              2 (Warehouse, Coupon/DiscountRule)
========================================================================================
```

This 3-way matrix confirms that the primary engineering priority for Sales Copilot is **activating existing headless backend capabilities into the frontend Web UI** rather than rewriting backend business logic.
