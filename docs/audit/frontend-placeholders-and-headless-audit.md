# Frontend Placeholders & Headless Features Audit Matrix

> **Document Status**: Complete & Authoritative  
> **Target Scope**: Sales Copilot Frontend (`apps/web`) vs Backend Bounded Contexts (`apps/server`)  
> **Milestone Alignment**: Milestone 1 (Omnichannel Baseline) & Milestone 2A/2B (Conversational Commerce, Mini-Inventory, VietQR, AI Ingestion)  
> **Generated**: September 2026

---

## 1. Executive Summary

During the architectural refactoring of `apps/web` (aligning the frontend structure with backend bounded contexts `identity`, `omnichannel`, `automation`, `contacts`, and `commerce`), an audit of the application surface was conducted to catalog:
1. **Frontend Route Placeholders**: Routes utilizing `<FeaturePlaceholder />` or static illustration placeholders.
2. **The `contacts/page.tsx` Gap**: Discrepancies between the static `/contacts` page and the full-featured backend `ContactsController`.
3. **Milestone 2A/2B Headless Features**: Robust backend endpoints and background workers implemented in `apps/server` that currently operate without dedicated frontend views.

---

## 2. Feature Matrix: Frontend Placeholders

The table below catalogs all 7 active routes utilizing `<FeaturePlaceholder />` in `apps/web/src/app/(workspace)/[workspaceSlug]/`:

| Route Path | Page Title | Current UI Implementation | Backend Capability Exists? | Target Milestone | Primary Backend Controllers & Services |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/[workspaceSlug]/orders` | Orders & Fulfillment | `<FeaturePlaceholder icon={ShoppingCart} ... />` | ✅ **Complete & Tested** | Milestone 2A | `OrdersController`, `OrdersService`, `ShippingController` |
| `/[workspaceSlug]/products` | Product Catalog | `<FeaturePlaceholder icon={Package} ... />` | ✅ **Complete & Tested** | Milestone 2A | `ProductsController`, `ProductsService` |
| `/[workspaceSlug]/inventory` | Mini-Inventory | `<FeaturePlaceholder icon={Boxes} ... />` | ✅ **Complete & Tested** | Milestone 2A | `ProductsController` (adjustInventory), `InventoryService` |
| `/[workspaceSlug]/reconciliation` | Bank Reconciliation | `<FeaturePlaceholder icon={ReceiptText} ... />` | ✅ **Complete & Tested** (Backend & BullMQ) | Milestone 2A | `PaymentWebhooksController`, `VietQrController`, `reconciliationQueue` |
| `/[workspaceSlug]/analytics/overview` | Analytics Overview | `<FeaturePlaceholder icon={BarChart3} ... />` | ⚠️ **Partial** (Aggregates available via Prisma / Events) | Milestone 2C | Platform Metrics & Omnichannel Event logs |
| `/[workspaceSlug]/analytics/channels` | Channel Performance | `<FeaturePlaceholder icon={Radio} ... />` | ⚠️ **Partial** (Channel & Message telemetry) | Milestone 2C | Omnichannel Message & Channel metrics |
| `/[workspaceSlug]/analytics/agents` | Agent Productivity | `<FeaturePlaceholder icon={Users} ... />` | ⚠️ **Partial** (Conversation assignment logs) | Milestone 2C | Conversation assignment & audit logs |

---

### Detailed Placeholder Profiles

#### 1. Orders & Fulfillment (`/[workspaceSlug]/orders`)
- **Location**: `apps/web/src/app/(workspace)/[workspaceSlug]/orders/page.tsx`
- **Description**: Displays placeholder message *"Manage omnichannel orders, tracking, fulfillment status, and customer purchase history in one unified view."* with badges for *In-Chat Orders*, *Status Tracking*, and *Thermal Print*.
- **Current State**: Quick-order creation is embedded inside `features/conversations/composer/quick-order-sheet.tsx`, but no dedicated workspace-level orders table, filter list, or order detail page exists.
- **Backend Readiness**: Fully backed by `OrdersController` (`GET /orders`, `GET /orders/:id`, `GET /orders/:id/shipping-label`, `POST /orders`, `PATCH /orders/:id`, `POST /orders/:id/confirm`, `POST /orders/:id/pay`, `POST /orders/:id/cancel`).

#### 2. Product Catalog (`/[workspaceSlug]/products`)
- **Location**: `apps/web/src/app/(workspace)/[workspaceSlug]/products/page.tsx`
- **Description**: Displays placeholder message *"Browse, create, and manage your multi-channel product catalog with variants, SKUs, and pricing tiers."*
- **Current State**: Products and variants are queried via `useCommerceCatalog` in `features/commerce/hooks/use-commerce-catalog.ts` only for in-chat selection. There is no product management view to create, update, or archive products.
- **Backend Readiness**: Fully backed by `ProductsController` (`GET /products`, `GET /products/:id`, `POST /products`, `PUT /products/:id`, `DELETE /products/:id`).

#### 3. Mini-Inventory (`/[workspaceSlug]/inventory`)
- **Location**: `apps/web/src/app/(workspace)/[workspaceSlug]/inventory/page.tsx`
- **Description**: Displays placeholder message *"Track real-time stock levels, manage low-stock thresholds, and review inventory adjustment audit trails."*
- **Current State**: Pure placeholder. No UI exists for viewing current stock, available stock, reserved stock, or posting manual adjustments.
- **Backend Readiness**: Fully backed by `POST /products/:id/variants/:variantId/inventory` (supporting reasons: `MANUAL_ADJUSTMENT`, `RESTOCK`, `AUDIT_COUNT`, `RETURN_RESTOCK`) with audit trail logging.

#### 4. Bank Reconciliation (`/[workspaceSlug]/reconciliation`)
- **Location**: `apps/web/src/app/(workspace)/[workspaceSlug]/reconciliation/page.tsx`
- **Description**: Displays placeholder message *"Real-time SePay & Casso bank webhook reconciliation, automated order payment matching, and dispute resolution."*
- **Current State**: Pure placeholder. Orders get marked paid via background webhooks or manual pay button, but there is no ledger interface to inspect unmatched transactions, payment logs, or match discrepancies.
- **Backend Readiness**: Fully backed by `PaymentWebhooksController` (`POST /webhooks/payments/:gateway`), `VietQrController`, and BullMQ worker queue `POS_RECONCILIATION_QUEUE`.

#### 5, 6, 7. Analytics (`overview`, `channels`, `agents`)
- **Locations**:
  - `apps/web/src/app/(workspace)/[workspaceSlug]/analytics/overview/page.tsx`
  - `apps/web/src/app/(workspace)/[workspaceSlug]/analytics/channels/page.tsx`
  - `apps/web/src/app/(workspace)/[workspaceSlug]/analytics/agents/page.tsx`
- **Description**: Placeholder dashboards for workspace conversational commerce analytics, channel metrics, and agent response productivity.
- **Backend Readiness**: Currently platform metrics exist (`PlatformMetricsController`), but tenant-level aggregated reporting is scheduled for Phase 2C.

---

## 3. In-Depth Analysis: `contacts/page.tsx` vs Backend `ContactsController`

### Current Frontend State
`apps/web/src/app/(workspace)/[workspaceSlug]/contacts/page.tsx` consists entirely of a static illustration placeholder:
```tsx
import Image from 'next/image';

export default function ContactsPage() {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 flex items-center justify-center">
        <Image
          src="/empty-contacts.svg"
          alt="Contacts & Identities"
          width={220}
          height={160}
          priority
          className="max-h-44 w-auto object-contain drop-shadow-xs"
        />
      </div>
      <h2 className="text-xl font-semibold tracking-tight">Contacts & Identities</h2>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm">
        Manage resolved contacts, cross-channel identities, and customer profiles across all your inboxes.
      </p>
    </div>
  );
}
```

### Contrast: Backend `ContactsController` Capabilities
The backend `ContactsController` (`apps/server/src/modules/omnichannel/contacts/contacts.controller.ts`) is a production-ready, tenant-isolated REST API providing 10 robust endpoints:

1. **`GET /contacts`**: Paginated listing with search query, tag filtering, email/phone matching, and sorting (`limit`, `cursor`, `orderBy`, `orderDirection`).
2. **`GET /contacts/search`**: Sub-100ms multi-field search across customer name, phone number, email address, and external channel identifiers.
3. **`POST /contacts`**: Full contact creation supporting name, phone, email, avatarUrl, tags array, and arbitrary JSON `customAttributes`.
4. **`GET /contacts/:id`**: Single contact retrieval including embedded channel identities and conversation count.
5. **`PATCH /contacts/:id`**: Partial contact update supporting profile attributes and custom metadata.
6. **`DELETE /contacts/:id`**: Soft/hard contact deletion with cascade protection.
7. **`POST /contacts/merge`**: **Atomic contact merge**; merges `mergeeContactId` into `baseContactId`, migrates all linked channel identities, moves conversations, updates order associations, and records the merging agent ID (`performedByUserId`).
8. **`GET /contacts/:contactId/identities`**: Lists all omnichannel identities linked to the contact (Facebook PSID, Zalo User ID, Email, Phone).
9. **`POST /contacts/:contactId/identities`**: Links a new channel identity to an existing contact profile.
10. **`DELETE /contacts/:contactId/identities/:id`**: Unlinks a channel identity from a contact profile.

### Frontend Gap Analysis & Opportunities
- **Where Contact Data is Used Today**:
  Contact data is currently only consumed within `features/conversations/detail-panel.tsx` via `ContactInfo` and `ContactIdentities` for the *contact of the currently selected conversation*.
- **Missing Interfaces in `apps/web`**:
  1. **Workspace Contacts Table**: No data table with pagination, column sorting, tag badges, and search bar.
  2. **Contact Creation Dialog**: No standalone "Add Customer" modal.
  3. **Identity Link/Unlink Action**: In the detail panel, identities are read-only; no UI exists to trigger `POST /contacts/:id/identities` or `DELETE /contacts/:id/identities/:id`.
  4. **Contact Deduplication & Merge Dialog**: No UI exists for agent/admin users to select two duplicate contacts and execute `POST /contacts/merge`.

---

## 4. Headless Backend Endpoints in Milestone 2A

The following backend services and endpoints are implemented, tested, and operational in `apps/server`, but lack dedicated frontend screens:

### A. Order Management & Fulfillment (OMS)
| Endpoint | Method | Backend Service | Description | Frontend Status |
| :--- | :--- | :--- | :--- | :--- |
| `/orders/:id/confirm` | `POST` | `OrdersService.confirmOrder` | Executes Model A atomic stock reservation across all order items | Invoked only via quick-order action sheet in chat |
| `/orders/:id/pay` | `POST` | `OrdersService.payOrder` | Records manual payment (Cash, POS terminal) and transitions status to PAID | Invoked only via detail panel action button |
| `/orders/:id/cancel` | `POST` | `OrdersService.cancelOrder` | Releases reserved inventory back to available stock | Invoked only via detail panel action button |
| `/orders/:id/shipping-label` | `GET` | `OrdersService.getShippingLabelData` | Returns structured printable data for 80mm/100mm ESC/POS thermal printers | **Headless**: No UI print trigger or thermal preview |

### B. Product & Inventory Management
| Endpoint | Method | Backend Service | Description | Frontend Status |
| :--- | :--- | :--- | :--- | :--- |
| `/products` | `POST` | `ProductsService.createProduct` | Creates product with nested variants, SKUs, and pricing | **Headless**: No product creation screen |
| `/products/:id` | `PUT` | `ProductsService.updateProduct` | Updates product details, variant titles, barcode, and prices | **Headless**: No product edit screen |
| `/products/:id` | `DELETE` | `ProductsService.deleteProduct` | Soft-deletes product and its variants | **Headless**: No product deletion UI |
| `/products/:id/variants/:variantId/inventory` | `POST` | `ProductsService.adjustInventory` | Atomically adjusts inventory with transaction log (`AUDIT_COUNT`, `RESTOCK`) | **Headless**: No stock adjustment UI |

### C. 3PL Shipping & Logistics Integration
| Endpoint | Method | Backend Service | Description | Frontend Status |
| :--- | :--- | :--- | :--- | :--- |
| `/shipping/quote` | `POST` | `ShippingService.calculateFee` | Live rate quote from carrier (GHTK, GHN, ViettelPost) based on weight & district | Partially wired into quick-order address step |
| `/shipping/orders/:orderId/dispatch` | `POST` | `ShippingService.dispatchOrder` | Dispatches order, generates carrier tracking code & creates shipment | **Headless**: No dedicated dispatch action screen |
| `/shipping/orders/:orderId/track` | `GET` | `ShippingService.trackOrder` | Returns real-time milestone tracking history from carrier | **Headless**: No tracking timeline view |
| `/shipping/orders/:orderId/cancel` | `POST` | `ShippingService.cancelOrderShipment` | Cancels shipment with carrier before pickup | **Headless**: No shipment cancel action |

### D. Payments & Automated Reconciliation
| Endpoint / Worker | Type | Handler | Description | Frontend Status |
| :--- | :--- | :--- | :--- | :--- |
| `/workspaces/:workspaceId/orders/:id/vietqr` | `POST` | `VietQrController` | Generates EMVCo dynamic VietQR (NAPAS 247) and auto-posts card into conversation | Fully operational in chat; headless for stand-alone invoices |
| `/workspaces/:workspaceId/webhooks/payments/:gateway` | `POST` | `PaymentWebhooksController` | Ingestion endpoint for Casso & SePay webhooks with fast-ACK (< 50ms) | **Headless**: Webhook configuration relies on direct endpoint setup |
| `POS_RECONCILIATION_QUEUE` | BullMQ Worker | `PaymentReconciliationProcessor` | Deduplicates via Redis (`gateway:txId`), matches order memo, verifies amount, transitions order to PAID, and broadcasts WebSocket event | **Headless**: Operates purely in background; no ledger UI |

### E. Collaborative Cart & Order Editing Concurrency
| Service / Mechanism | Technology | Description | Frontend Status |
| :--- | :--- | :--- | :--- |
| `CommercePresenceService` | Redis 30s Sliding Lock (`acquireLock`, `releaseLock`, `renewHeartbeat`) | Prevents multiple agents from editing or updating the same draft order simultaneously | Service ready in backend; needs WebSocket heartbeat integration in web composer |

### F. AI Address & Order Extraction (Milestone 2B)
| Service / Pipeline | Implementation | Description | Frontend Status |
| :--- | :--- | :--- | :--- |
| `OrderExtractorService` | Regex + Heuristics + LLM Fallback | Deterministic phone extraction, carrier detection, 3-tier address parsing (`streetAddress`, `ward`, `district`, `province`), and emits `DomainEvent.POS_DRAFT_SUGGESTED` | Backend listener & BullMQ processor ready; frontend receives draft suggestions via chat sheet |

---

## 5. Implementation Recommendations

To close the loop between backend capability and frontend user experience, the following progression is recommended:

1. **Phase 2A.1 — Contacts Page Activation**:
   - Replace `/contacts/page.tsx` static illustration with a full-fledged `ContactsTable` leveraging `@/features/contacts`.
   - Add search input, tag filter dropdown, and a "New Contact" modal.
   - Introduce a "Merge Contact" confirmation sheet for administrative users.
2. **Phase 2A.2 — Standalone Orders & Fulfillment View**:
   - Transform `/orders/page.tsx` into an orders workbench with status tabs (`ALL`, `DRAFT`, `CONFIRMED`, `PAID`, `SHIPPED`, `CANCELLED`).
   - Add thermal print button invoking `/orders/:id/shipping-label`.
   - Add carrier dispatch modal using `POST /shipping/orders/:orderId/dispatch`.
3. **Phase 2A.3 — Product & Mini-Inventory Console**:
   - Transform `/products/page.tsx` and `/inventory/page.tsx` into catalog and stock control tables.
   - Implement "Adjust Stock" drawer calling `/products/:id/variants/:variantId/inventory`.
4. **Phase 2A.4 — Bank Reconciliation Dashboard**:
   - Transform `/reconciliation/page.tsx` into a real-time transaction ledger with status tags (`MATCHED`, `PENDING_MANUAL_REVIEW`, `IGNORED`).
