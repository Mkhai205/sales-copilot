# In-Chat POS & Order Closing Automation: Technical Architecture RFC & Prisma Schema Specification

**Document Title**: Technical Architecture Request for Comments (RFC) & Data Model Specification  
**Subsystem**: In-Chat POS & Order Closing Automation (Phân hệ POS & Tự Động Hóa Chốt Đơn Trong Chat)  
**System**: Sales Copilot Omnichannel Platform  
**Target Runtime**: NestJS 10+, PostgreSQL 16, Prisma ORM 7+, Redis 7, BullMQ 5+, Socket.io, Zod  
**Compliance Standards**: `AGENTS.md` (Strict Multi-Tenancy Scoping, Anti-Over-Engineering, Non-Breaking Phase 1 & 2 Baseline, Asynchronous AI Ingestion, Sub-50ms Catalog Lookup, Sub-100ms Order Generation)  
**Target File**: `docs/architecture/in-chat-pos-technical-rfc.md`  
**Status**: DRAFT / PUBLICATION-READY RFC  
**Version**: 1.0.0  
**Date**: 2026-09-08  

---

## 1. Executive Summary & Architectural Invariants

### 1.1. Context & Business Imperative
In Vietnamese conversational commerce (via Facebook Messenger, Zalo OA, Web Chat, and Telegram), customer checkout is intensely conversational. As established in the Pancake.vn field audit, sales representatives lose 1.5 to 3 minutes per order when forced to switch away from chat threads to separate ERP or warehouse software. Furthermore, manual entry of Vietnamese administrative addresses results in return rates of 15-25%, multi-agent collision (two agents creating duplicate orders for the same customer) damages trust, and manual verification of bank transfer SMS notifications stalls packaging pipelines.

The **In-Chat POS & Order Closing Automation** subsystem embeds complete point-of-sale capabilities, real-time inventory locking, dynamic VietQR generation, bank webhook reconciliation, and thermal label generation directly into the Sales Copilot agent interface via a dedicated Right Drawer and DetailPanel POS Tab.

```
┌───────────────────────────────────┬───────────────────────────────────┬───────────────────────────────┐
│           SALES COPILOT           │     D2C CONVERSATIONAL COMMERCE   │       IN-CHAT POS SUBSYSTEM   │
│             PLATFORM              │      (PHASE 2 FOCUSED SCOPE)      │     (BUILT-IN MINI INVENTORY) │
├───────────────────────────────────┼───────────────────────────────────┼───────────────────────────────┤
│    PHASE 1: CONVERSATION CORE     │   PHASE 2: D2C AI COMMERCE        │    IN-CHAT POS SUBSYSTEM      │
│     (Omnichannel Baseline)        │     (Revenue & AI Auto-pilot)     │     (Closing & Fulfillment)   │
├───────────────────────────────────┼───────────────────────────────────┼───────────────────────────────┤
│ • Inbound Webhook Ingestion       │ • Multi-Provider LLM Gateway      │ • Fast Catalog Search (<50ms) │
│ • Contact & Identity Resolution   │ • AI NER 3-Tier Address Parser    │ • Atomic Stock Lock (Anti-OOS)│
│ • Unified Threading & Messages    │ • 24/7 AI Auto-pilot Checkout     │ • Dynamic VietQR (NAPAS 247)  │
│ • Inbox RBAC & Presence Routing   │ • Anti-theft Comment Masking      │ • Auto Webhook Reconciliation │
│ • Realtime Socket.io Fanout       │ • Discount Policy Engine          │ • 58mm/80mm Thermal Waybills  │
└───────────────────────────────────┴───────────────────────────────────┴───────────────────────────────┘
```

---

### 1.2. Non-Negotiable Architectural Invariants

In strict compliance with `AGENTS.md`, the In-Chat POS subsystem adheres to five non-negotiable architectural invariants:

1. **Mandatory Multi-Tenant Scoping (`workspaceId`)**:
   - Every single database table introduced (`Product`, `ProductVariant`, `Order`, `OrderItem`, `ShippingAddress`, `PaymentTransaction`, `InventoryTransaction`) **MUST** include `workspaceId` as a foreign key with cascade deletion (`onDelete: Cascade`).
   - Every database query, update, delete, or lookup **MUST** include `workspaceId` in the Prisma `where` clause.
   - All compound unique constraints and indexes **MUST** begin with `workspaceId` (e.g., `@@unique([workspaceId, id])`, `@@unique([workspaceId, sku])`, `@@unique([workspaceId, orderNumber])`, `@@index([workspaceId, status])`).
   - ❌ Cross-tenant queries are strictly prohibited: `prisma.order.findUnique({ where: { id } })`.
   - ✅ Always tenant-scoped: `prisma.order.findFirst({ where: { id, workspaceId } })` or compound unique `prisma.order.update({ where: { workspaceId_id: { workspaceId, id } } })`.

2. **Phase 1 Non-Breaking Guarantee**:
   - Zero destructive alterations to Phase 1 tables (`conversations`, `messages`, `contacts`, `channels`, `inboxes`).
   - Clean, non-blocking foreign key relations:
     - `Order.conversationId -> Conversation.id` (onDelete: SetNull)
     - `Order.contactId -> Contact.id` (onDelete: Restrict)
     - `Order.createdById -> User.id` (onDelete: SetNull)
   - Phase 1 APIs, schemas, and event contracts remain 100% stable.

3. **Anti-Over-Engineering (KISS / YAGNI Directives)**:
   - Idiomatic NestJS Services (`ProductService`, `OrderService`, `VietQrService`, `PaymentReconciliationService`) directly executing typed Prisma queries within `$transaction`.
   - ❌ No single-implementation interfaces (`IOrderService`, `IProductService`). Interfaces are strictly reserved for polymorphic external providers (`ShippingCarrierAdapter`, `PaymentGatewayAdapter`).
   - ❌ No layered mapper explosions (`Entity -> DomainModel -> ApplicationDTO -> Presenter -> ViewModel`). Request validation is handled by a single Zod schema pipe (`@ZodBody()`, `@ZodQuery()`), returning Prisma models or typed response DTOs directly.

4. **Asynchronous Non-Blocking Execution & High Performance**:
   - Inbound chat message ingestion acknowledges in `< 100ms`. AI-based customer extraction, telco tagging, and draft proposal generation execute strictly out-of-band via BullMQ (`pos-order-automation`).
   - Inbound payment webhooks acknowledge in `< 50ms`. Bank memo matching, distributed order locking, and inventory commitment execute out-of-band via BullMQ (`pos-reconciliation`).
   - Catalog and variant lookups inside the POS Drawer operate at `< 50ms` (in-memory client caching + indexed compound queries). Order creation executes in `< 100ms`.

5. **Atomic Inventory Ledger & Anti-Overselling Concurrency**:
   - Two-tier concurrency control (Model A: Available = Physical - Reserved). Row-level exclusion and atomic conditional reservation (`stock_quantity - reserved_quantity >= requestedQuantity`) inside `prisma.$transaction` prevent overselling.
   - Deterministic line-item sorting by `variantId` ascending prior to row-level locking eliminates circular wait deadlocks (`40P01`).
   - Every inventory alteration is permanently recorded in an append-only `InventoryTransaction` ledger with full mathematical traceability and authentic live balance logging.

---

## 2. Complete Prisma Schema RFC

Below is the definitive, 100% syntactically valid Prisma Schema specification designed to be integrated into `apps/server/prisma/schema.prisma`.

### 2.1. New Enums

```prisma
// =============================================================================
// ENUMS: IN-CHAT POS & ORDER CLOSING AUTOMATION
// =============================================================================

enum OrderStatus {
  DRAFT       // Order draft created by Agent or AI extractor (no stock reserved)
  CONFIRMED   // Order verified; stock atomically reserved; waiting for payment
  PAID        // Payment received and verified; stock committed
  SHIPPING    // Handed over to logistics carrier; tracking code assigned
  COMPLETED   // Delivered successfully to customer; transaction finalized
  CANCELLED   // Order cancelled; any reserved stock released back to inventory
}

enum PaymentStatus {
  UNPAID
  PARTIALLY_PAID
  PAID
  REFUNDED
}

enum FulfillmentStatus {
  UNFULFILLED
  PROCESSING
  SHIPPED
  DELIVERED
  RETURNED
  CANCELLED
}

enum DiscountType {
  PERCENTAGE
  FIXED_AMOUNT
}

enum PaymentMethod {
  VIETQR
  BANK_TRANSFER
  COD
  CASH
  CREDIT_CARD
  OTHER
}

enum PaymentGateway {
  SEPAY
  CASSO
  MANUAL
  VNPAY
  MOMO
}

enum PaymentTransactionStatus {
  PENDING
  SUCCESS
  FAILED
  EXPIRED
  CANCELLED
}

enum CarrierProvider {
  GHTK
  GHN
  VIETTEL_POST
  AHAMOVE
  CUSTOM
}

enum CarrierNetwork {
  VIETTEL
  VINAPHONE
  MOBIFONE
  VIETNAMOBILE
  GMOBILE
  ITEL
  WINTEL
  OTHER
}

enum InventoryTransactionType {
  STOCK_IN            // Manual warehouse restock
  STOCK_OUT           // Manual inventory write-off or loss
  RESERVATION         // Reserved when Order transitions to CONFIRMED
  RELEASE_RESERVATION // Released when Order transitions to CANCELLED
  COMMIT_SALE         // Committed when Order transitions to PAID / SHIPPING
  RETURN_RESTOCK      // Customer return added back to stock
  INVENTORY_AUDIT     // Physical stock count reconciliation adjustment
}
```

---

### 2.2. New Domain Models

```prisma
// =============================================================================
// MODELS: IN-CHAT POS & COMMERCE
// =============================================================================

model Product {
  id             String           @id @default(uuid())
  workspaceId    String
  name           String
  slug           String
  description    String?          @db.Text
  category       String?
  basePrice      Decimal          @db.Decimal(15, 2)
  costPrice      Decimal          @default(0) @db.Decimal(15, 2)
  sku            String
  barcode        String?
  imageUrl       String?
  images         Json             @default("[]")
  isActive       Boolean          @default(true)
  trackInventory Boolean          @default(true)
  metadata       Json             @default("{}")
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  workspace      Workspace        @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  variants       ProductVariant[]
  orderItems     OrderItem[]

  @@unique([workspaceId, id])
  @@unique([workspaceId, sku])
  @@unique([workspaceId, slug])
  @@index([workspaceId, isActive])
  @@index([workspaceId, barcode])
  @@index([workspaceId, name])
  @@index([workspaceId, category])
  @@map("products")
}

model ProductVariant {
  id                    String                 @id @default(uuid())
  workspaceId           String
  productId             String
  name                  String                 // e.g., "Size XL / Xanh Navy"
  sku                   String
  barcode               String?
  price                 Decimal                @db.Decimal(15, 2)
  costPrice             Decimal                @default(0) @db.Decimal(15, 2)
  stockQuantity         Int                    @default(0) // Physical available on-hand stock
  reservedQuantity      Int                    @default(0) // Reserved for CONFIRMED orders
  imageUrl              String?
  attributes            Json                   @default("{}") // e.g., {"size": "XL", "color": "Navy"}
  isActive              Boolean                @default(true)
  createdAt             DateTime               @default(now())
  updatedAt             DateTime               @updatedAt

  workspace             Workspace              @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  product               Product                @relation(fields: [productId], references: [id], onDelete: Cascade)
  orderItems            OrderItem[]
  inventoryTransactions InventoryTransaction[]

  @@unique([workspaceId, id])
  @@unique([workspaceId, sku])
  @@index([workspaceId, productId])
  @@index([workspaceId, barcode])
  @@index([workspaceId, isActive])
  @@map("product_variants")
}

model Order {
  id                    String                 @id @default(uuid())
  displayId             Int                    @default(autoincrement())
  orderNumber           String                 // e.g., "ORD-20260908-1004"
  workspaceId           String
  conversationId        String?
  contactId             String
  createdById           String?
  
  status                OrderStatus            @default(DRAFT)
  paymentStatus         PaymentStatus          @default(UNPAID)
  fulfillmentStatus     FulfillmentStatus      @default(UNFULFILLED)
  
  subtotal              Decimal                @db.Decimal(15, 2)
  discountAmount        Decimal                @default(0) @db.Decimal(15, 2)
  discountType          DiscountType           @default(FIXED_AMOUNT)
  discountReason        String?
  shippingFee           Decimal                @default(0) @db.Decimal(15, 2)
  taxAmount             Decimal                @default(0) @db.Decimal(15, 2)
  totalAmount           Decimal                @db.Decimal(15, 2)
  paidAmount            Decimal                @default(0) @db.Decimal(15, 2)
  currency              String                 @default("VND")
  
  customerNotes         String?                @db.Text
  internalNotes         String?                @db.Text
  cancelReason          String?                @db.Text
  
  confirmedAt           DateTime?
  paidAt                DateTime?
  shippedAt             DateTime?
  completedAt           DateTime?
  cancelledAt           DateTime?
  
  metadata              Json                   @default("{}")
  createdAt             DateTime               @default(now())
  updatedAt             DateTime               @updatedAt

  workspace             Workspace              @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  conversation          Conversation?          @relation(fields: [conversationId], references: [id], onDelete: SetNull)
  contact               Contact                @relation(fields: [contactId], references: [id], onDelete: Restrict)
  createdBy             User?                  @relation("UserCreatedOrders", fields: [createdById], references: [id], onDelete: SetNull)
  
  items                 OrderItem[]
  shippingAddress       ShippingAddress?
  paymentTransactions   PaymentTransaction[]
  inventoryTransactions InventoryTransaction[]

  @@unique([workspaceId, id])
  @@unique([workspaceId, displayId])
  @@unique([workspaceId, orderNumber])
  @@index([workspaceId, status])
  @@index([workspaceId, paymentStatus])
  @@index([workspaceId, contactId])
  @@index([workspaceId, conversationId])
  @@index([workspaceId, createdAt])
  @@map("orders")
}

model OrderItem {
  id             String          @id @default(uuid())
  workspaceId    String
  orderId        String
  productId      String
  variantId      String
  productName    String          // Snapshot at time of order
  variantName    String          // Snapshot at time of order
  sku            String          // Snapshot at time of order
  unitPrice      Decimal         @db.Decimal(15, 2)
  costPrice      Decimal         @default(0) @db.Decimal(15, 2)
  quantity       Int
  discountAmount Decimal         @default(0) @db.Decimal(15, 2)
  totalPrice     Decimal         @db.Decimal(15, 2)
  metadata       Json            @default("{}")
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  workspace      Workspace       @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  order          Order           @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product        Product         @relation(fields: [productId], references: [id], onDelete: Restrict)
  variant        ProductVariant  @relation(fields: [variantId], references: [id], onDelete: Restrict)

  @@unique([workspaceId, id])
  @@index([workspaceId, orderId])
  @@index([workspaceId, productId])
  @@index([workspaceId, variantId])
  @@map("order_items")
}

model ShippingAddress {
  id              String          @id @default(uuid())
  workspaceId     String
  orderId         String          @unique
  contactId       String?
  recipientName   String
  phoneNumber     String
  carrierNetwork  CarrierNetwork  @default(OTHER)
  streetAddress   String          // e.g., "Số 45 ngõ 120 Trường Chinh"
  ward            String          // Phường / Xã
  district        String          // Quận / Huyện
  province        String          // Tỉnh / Thành phố
  country         String          @default("VN")
  postalCode      String?
  shippingCarrier CarrierProvider @default(CUSTOM)
  trackingCode    String?
  shippingNotes   String?         @db.Text
  carrierMetadata Json?           @default("{}") // Stores carrier routing identifiers (e.g. GHN DistrictID, WardCode; GHTK hub/route codes)
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  workspace       Workspace       @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  order           Order           @relation(fields: [orderId], references: [id], onDelete: Cascade)
  contact         Contact?        @relation(fields: [contactId], references: [id], onDelete: SetNull)

  @@unique([workspaceId, id])
  @@index([workspaceId, trackingCode])
  @@index([workspaceId, phoneNumber])
  @@index([workspaceId, province, district])
  @@map("shipping_addresses")
}

model PaymentTransaction {
  id                 String                   @id @default(uuid())
  workspaceId        String
  orderId            String
  paymentMethod      PaymentMethod            @default(VIETQR)
  gateway            PaymentGateway           @default(MANUAL)
  amount             Decimal                  @db.Decimal(15, 2)
  currency           String                   @default("VND")
  status             PaymentTransactionStatus @default(PENDING)
  transactionCode    String?                  // Bank / Gateway transaction reference
  accountNumber      String?                  // Receiving bank account
  bankCode           String?                  // Bank short code: "MB", "VCB", "TCB", "ICB"
  transferContent    String?                  // Transfer memo e.g., "ORD 1004"
  qrUrl              String?                  @db.Text
  rawWebhookPayload  Json?
  idempotencyKey     String                   // Unique key per gateway event
  paidAt             DateTime?
  createdAt          DateTime                 @default(now())
  updatedAt          DateTime                 @updatedAt

  workspace          Workspace                @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  order              Order                    @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@unique([workspaceId, id])
  @@unique([workspaceId, idempotencyKey])
  @@index([workspaceId, orderId])
  @@index([workspaceId, transactionCode])
  @@index([workspaceId, status])
  @@index([workspaceId, createdAt])
  @@map("payment_transactions")
}

model InventoryTransaction {
  id                 String                   @id @default(uuid())
  workspaceId        String
  variantId          String
  orderId            String?
  type               InventoryTransactionType
  quantity           Int                      // Number of units affected (positive integer)
  previousStock      Int                      // Stock quantity before transaction
  newStock           Int                      // Stock quantity after transaction
  previousReserved   Int                      // Reserved quantity before transaction
  newReserved        Int                      // Reserved quantity after transaction
  reason             String?
  performedByUserId  String?
  createdAt          DateTime                 @default(now())

  workspace          Workspace                @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  variant            ProductVariant           @relation(fields: [variantId], references: [id], onDelete: Restrict)
  order              Order?                   @relation(fields: [orderId], references: [id], onDelete: SetNull)
  performedByUser    User?                    @relation("UserInventoryTransactions", fields: [performedByUserId], references: [id], onDelete: SetNull)

  @@unique([workspaceId, id])
  @@index([workspaceId, variantId, createdAt])
  @@index([workspaceId, orderId])
  @@index([workspaceId, type])
  @@map("inventory_transactions")
}
```

---

### 2.3. Backward Compatibility Hook on Existing Models

To satisfy bidirectional Prisma relation rules without altering runtime behaviors or introducing breaking schema migrations:

1. **`User` model** (`apps/server/prisma/schema.prisma:175`):
   ```prisma
   // Add inside model User:
   createdOrders                  Order[]                @relation("UserCreatedOrders")
   performedInventoryTransactions InventoryTransaction[] @relation("UserInventoryTransactions")
   ```

2. **`Workspace` model** (`apps/server/prisma/schema.prisma:200`):
   ```prisma
   // Add inside model Workspace:
   products              Product[]
   productVariants       ProductVariant[]
   orders                Order[]
   orderItems            OrderItem[]
   shippingAddresses     ShippingAddress[]
   paymentTransactions   PaymentTransaction[]
   inventoryTransactions InventoryTransaction[]
   ```

3. **`Conversation` model** (`apps/server/prisma/schema.prisma:401`):
   ```prisma
   // Add inside model Conversation:
   orders                Order[]
   ```

4. **`Contact` model** (`apps/server/prisma/schema.prisma:282`):
   ```prisma
   // Add inside model Contact:
   orders                Order[]
   shippingAddresses     ShippingAddress[]
   ```

---

## 3. Concurrency & Anti-Overselling Architecture

### 3.1. The Race Condition Danger in Social Commerce
In high-velocity live chat and social sales, flash sales or viral broadcasts prompt hundreds of conversations simultaneously. If two agents recommend the last remaining unit of an item (e.g., `stockQuantity = 1`) and both click **"Tạo đơn"**, a traditional application workflow (`SELECT stockQuantity` -> check `> 0` -> `UPDATE stockQuantity`) creates a classic Time-of-Check to Time-of-Use (TOCTOU) race condition. Both transactions read `stockQuantity = 1`, both commit, and the warehouse inventory drops to `-1`, resulting in overselling, customer disappointment, and brand damage.

---

#### 3.2. Two-Tier Anti-Overselling Guard (Model A: Physical Stock Preservation)

In Vietnamese conversational commerce, accurate inventory visibility is paramount. The platform enforces the industry-standard **Model A (Physical Stock Preservation)** mathematical model:
- **Physical Stock (`stockQuantity`)**: Units physically present on warehouse shelves.
- **Reserved Stock (`reservedQuantity`)**: Units allocated to active confirmed/unshipped orders awaiting payment or packing.
- **Available Stock (`availableStock`)**: $\text{availableStock} = \text{stockQuantity} - \text{reservedQuantity}$.

#### Tier 1: Atomic Reservation with Database Predicate Check
PostgreSQL executes individual row updates under row-level exclusion locks (`FOR UPDATE`). Rather than naive read-then-write patterns, atomic reservation embeds the available stock sufficiency predicate directly into the SQL `WHERE` clause:

```sql
UPDATE product_variants
SET 
  reserved_quantity = reserved_quantity + :requestedQuantity,
  updated_at = NOW()
WHERE id = :variantId 
  AND workspace_id = :workspaceId 
  AND (stock_quantity - reserved_quantity) >= :requestedQuantity;
```

**Inventory State Machine Actions Across Lifecycle Stages**:
1. **Order Confirmation (`DRAFT -> CONFIRMED`)**: Atomically increment `reservedQuantity` (do **NOT** decrement `stockQuantity`). Physical units remain in the warehouse, but are locked from competing checkouts.
2. **Payment Confirmation (`CONFIRMED -> PAID`) / Dispatch (`CONFIRMED -> SHIPPING`)**: Decrement **both** `stockQuantity` and `reservedQuantity` by the ordered quantity:
   `stockQuantity = stockQuantity - Q`, `reservedQuantity = reservedQuantity - Q` (`COMMIT_SALE`). Available stock remains invariant: $(S - Q) - (R - Q) = S - R$.
3. **Order Cancellation (`CONFIRMED -> CANCELLED`)**: Decrement `reservedQuantity`: `reservedQuantity = reservedQuantity - Q` (`RELEASE_RESERVATION`). Available stock instantly restores.
4. **Direct Payment of Draft (`DRAFT -> PAID`)**: If payment arrives for an unconfirmed draft, decrement `stockQuantity` directly (`stockQuantity = stockQuantity - Q`), since it was never held in `reservedQuantity`.
5. **Return / Restock (`SHIPPING -> CANCELLED / RETURNED`)**: Increment physical stock: `stockQuantity = stockQuantity + Q` (`RETURN_RESTOCK`).

When 10 concurrent requests target the last available item ($\text{stock} = 1, \text{reserved} = 0, \text{available} = 1$):
- PostgreSQL serializes the execution queue on that specific variant row.
- The **first** transaction updates the row (`reserved_quantity` 0 -> 1, available becomes 0). The query returns `count = 1`.
- The remaining **9** transactions execute against $(1 - 1) = 0$. Since $0 \ge 1$ evaluates to false, zero rows match the predicate (`count = 0`).
- The application catches `count === 0`, immediately aborts the Prisma transaction, and throws a structured `ConflictException({ code: 'INSUFFICIENT_STOCK' })`.

#### Tier 2: Immutable Inventory Ledger (`InventoryTransaction`)
Every stock state change MUST write an append-only record into `inventory_transactions`. This ledger captures:
- Exact live before/after balances: `previousStock`, `newStock`, `previousReserved`, `newReserved`.
- Transaction intent: `RESERVATION`, `RELEASE_RESERVATION`, `COMMIT_SALE`, `STOCK_IN`, `RETURN_RESTOCK`, `INVENTORY_AUDIT`.
- Attribution: `orderId` and `performedByUserId`.

---

### 3.3. Canonical Service Implementation (`orders.service.ts`)

```typescript
import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderStatus, InventoryTransactionType, PaymentStatus } from '@sales-copilot/shared-contracts';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Atomically transitions order from DRAFT to CONFIRMED and reserves inventory.
   * Guaranteed race-condition safe via database conditional predicate updates.
   * Deterministically sorts line items to eliminate circular wait deadlocks (40P01).
   */
  async confirmOrder(workspaceId: string, orderId: string, userId: string) {
    return this.prisma.getClient().$transaction(async (tx) => {
      // 1. Fetch order with line items strictly scoped to workspaceId
      const order = await tx.order.findFirst({
        where: { id: orderId, workspaceId },
        include: { items: true, shippingAddress: true },
      });

      if (!order) {
        throw new NotFoundException({
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found in this workspace',
          details: { orderId, workspaceId },
        });
      }

      if (order.status !== OrderStatus.DRAFT) {
        throw new BadRequestException({
          code: 'INVALID_STATUS_TRANSITION',
          message: `Only DRAFT orders can be confirmed. Current status: ${order.status}`,
          details: { currentStatus: order.status, targetStatus: OrderStatus.CONFIRMED },
        });
      }

      if (!order.items || order.items.length === 0) {
        throw new BadRequestException({
          code: 'EMPTY_ORDER',
          message: 'Cannot confirm an order with no line items',
        });
      }

      // 2. Deterministic Variant Sorting (Deadlock Prevention 40P01)
      // Sort line items by variantId ascending prior to row-level locking to prevent circular wait
      const sortedItems = [...order.items].sort((a, b) => a.variantId.localeCompare(b.variantId));

      // 3. Atomically reserve inventory for each line item (Model A: Available = stock - reserved)
      for (const item of sortedItems) {
        // Atomic conditional reservation: increments reservedQuantity ONLY IF available stock >= requested
        const count = await tx.$executeRaw`
          UPDATE product_variants
          SET 
            reserved_quantity = reserved_quantity + ${item.quantity},
            updated_at = NOW()
          WHERE id = ${item.variantId}
            AND workspace_id = ${workspaceId}
            AND (stock_quantity - reserved_quantity) >= ${item.quantity}
        `;

        // If count === 0, available stock was insufficient or variant does not exist
        if (count === 0) {
          const variant = await tx.productVariant.findFirst({
            where: { id: item.variantId, workspaceId },
          });

          const currentAvailable = (variant?.stockQuantity ?? 0) - (variant?.reservedQuantity ?? 0);

          throw new ConflictException({
            code: 'INSUFFICIENT_STOCK',
            message: `Insufficient available stock for '${item.productName} - ${item.variantName}' (${item.sku})`,
            details: {
              variantId: item.variantId,
              sku: item.sku,
              requestedQuantity: item.quantity,
              availableStock: Math.max(0, currentAvailable),
            },
          });
        }

        // Fetch accurate live variant snapshot for immutable audit ledger
        const currentVariant = await tx.productVariant.findFirstOrThrow({
          where: { id: item.variantId, workspaceId },
        });

        // Record immutable inventory audit ledger with genuine balances
        await tx.inventoryTransaction.create({
          data: {
            workspaceId,
            variantId: item.variantId,
            orderId: order.id,
            type: InventoryTransactionType.RESERVATION,
            quantity: item.quantity,
            previousStock: currentVariant.stockQuantity,
            newStock: currentVariant.stockQuantity,
            previousReserved: currentVariant.reservedQuantity - item.quantity,
            newReserved: currentVariant.reservedQuantity,
            reason: `Reserved for Order #${order.displayId} (${order.orderNumber})`,
            performedByUserId: userId,
          },
        });
      }

      // 4. Transition order status to CONFIRMED using compound unique key
      const updatedOrder = await tx.order.update({
        where: { workspaceId_id: { workspaceId, id: order.id } },
        data: {
          status: OrderStatus.CONFIRMED,
          confirmedAt: new Date(),
        },
        include: {
          items: true,
          shippingAddress: true,
          paymentTransactions: true,
        },
      });

      // 5. Emit domain events for realtime sync and BullMQ queue registration
      this.eventEmitter.emit('order.confirmed', {
        workspaceId,
        orderId: updatedOrder.id,
        conversationId: updatedOrder.conversationId,
        order: updatedOrder,
      });

      return updatedOrder;
    });
  }

  /**
   * Cancels an order with atomic status guard to prevent double-cancellation phantom stock.
   * Releases reserved stock back to available inventory if previously CONFIRMED.
   */
  async cancelOrder(workspaceId: string, orderId: string, userId: string, cancelReason: string) {
    return this.prisma.getClient().$transaction(async (tx) => {
      // 1. Atomic status transition guard: only DRAFT or CONFIRMED orders can be cancelled
      const updateResult = await tx.order.updateMany({
        where: {
          id: orderId,
          workspaceId,
          status: { in: [OrderStatus.DRAFT, OrderStatus.CONFIRMED] },
        },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason,
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictException({
          code: 'ORDER_ALREADY_FINALIZED_OR_CANCELLED',
          message: 'Order is not in a cancellable state (already PAID, SHIPPING, COMPLETED, or CANCELLED)',
        });
      }

      // 2. Fetch full order details
      const order = await tx.order.findFirstOrThrow({
        where: { id: orderId, workspaceId },
        include: { items: true },
      });

      // 3. If the order was CONFIRMED (stock was reserved), release reservation
      if (order.confirmedAt && !order.paidAt) {
        const sortedItems = [...order.items].sort((a, b) => a.variantId.localeCompare(b.variantId));

        for (const item of sortedItems) {
          await tx.productVariant.update({
            where: { workspaceId_id: { workspaceId, id: item.variantId } },
            data: {
              reservedQuantity: { decrement: item.quantity },
            },
          });

          const currentVariant = await tx.productVariant.findFirstOrThrow({
            where: { id: item.variantId, workspaceId },
          });

          await tx.inventoryTransaction.create({
            data: {
              workspaceId,
              variantId: item.variantId,
              orderId: order.id,
              type: InventoryTransactionType.RELEASE_RESERVATION,
              quantity: item.quantity,
              previousStock: currentVariant.stockQuantity,
              newStock: currentVariant.stockQuantity,
              previousReserved: currentVariant.reservedQuantity + item.quantity,
              newReserved: currentVariant.reservedQuantity,
              reason: `Released reservation on order cancellation: #${order.displayId} (${cancelReason})`,
              performedByUserId: userId,
            },
          });
        }
      }

      // 4. Emit cancellation domain event
      this.eventEmitter.emit('order.cancelled', {
        workspaceId,
        orderId: order.id,
        conversationId: order.conversationId,
        order,
      });

      return order;
    });
  }
}
```

---

## 4. Order Lifecycle & State Machine

### 4.1. Order Lifecycle State Diagram

```text
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                                   DRAFT                                     │
 │  • Created via Agent manual entry or AI conversation parser                 │
 │  • Stock NOT reserved; Line items, discounts, shipping freely editable     │
 └───────────────────────┬─────────────────────────────────────────────┬───────┘
                         │                                             │
                         │ [Agent / Customer Confirms Order]           │ [Direct Transfer on Draft]
                         │ Atomically reserves stock                   │ Decrements stockQuantity
                         │ (reservedQuantity + Q, Physical preserved)  │ (stockQuantity - Q)
                         ▼                                             │
 ┌─────────────────────────────────────────────────────────────────┐   │
 │                            CONFIRMED                            │   │
 │  • Stock atomically RESERVED (Physical stock preserved)         │   │
 │  • Pricing locked; Dynamic VietQR generated                     │   │
 │  • Auto-cancellation TTL timer started (default: 24h)           │   │
 └──────────────┬───────────────────────────────┬──────────────────┘   │
                │                               │                      │
  [Bank Webhook / VietQR Paid]     [COD Carrier Dispatch]              │
  paidAmount >= totalAmount        paymentMethod === COD               │
  (stock - Q, reserved - Q)        (stock - Q, reserved - Q)           │
                │                               │                      │
                ▼                               │                      ▼
 ┌───────────────────────────────┐              │       ┌───────────────────────────────┐
 │             PAID              │              │       │          CANCELLED            │
 │ • Stock committed (sale)      │              │       │ • Terminal state              │
 │ • Real-time in-chat confetti  │              │       │ • Reserved stock released     │
 │ • Instant payment confirmed   │              │       │   (reservedQuantity - Q)      │
 └──────────────┬────────────────┘              │       └───────────────────────────────┘
                │                               │                      ▲
                │ [Package Ready / Carrier]     │                      │
                ▼                               ▼                      │ [Customer Return /
 ┌──────────────────────────────────────────────┐                      │  Delivery Rejected]
 │                   SHIPPING                   │──────────────────────┘ (Restocks warehouse:
 │ • Tracking code assigned (GHTK / GHN)        │                         stockQuantity + Q)
 │ • 58mm/80mm thermal shipping label printed   │
 │ • COD orders: Courier collects cash upon drop│
 └──────────────────────┬───────────────────────┘
                        │
                        │ [Carrier Webhook DELIVERED]
                        │ - Prepaid: finalized
                        │ - COD: paymentStatus -> PAID & COD remittance logged
                        ▼
 ┌──────────────────────────────────────────────┐
 │                  COMPLETED                   │
 │ • Terminal successful state                  │
 │ • Revenue recognized; ticket finalized       │
 └──────────────────────────────────────────────┘
```

---

### 4.2. State Transition Matrix

| Source State | Target State | Trigger / Actor | Guard Conditions | Inventory Action | Side Effects & Notifications |
| :--- | :--- | :--- | :--- | :--- | :--- |
| *(None)* | `DRAFT` | Agent / AI Parser | Valid `contactId`, `workspaceId` | None | Emits `order.created`, broadcasts to conversation room |
| `DRAFT` | `CONFIRMED` | Agent clicks "Tạo đơn" | `items.length > 0`, address present | Increments `reservedQuantity += Q` (Physical stock untouched) | Emits `order.confirmed`, generates VietQR, schedules 24h expiry |
| `DRAFT` | `CANCELLED` | Agent discards draft | None | None | Emits `order.cancelled` |
| `DRAFT` | `PAID` | Direct Bank Webhook | `paidAmount >= totalAmount` | Decrements `stockQuantity -= Q` (`COMMIT_SALE`) | Emits `order.paid`, updates conversation order state |
| `CONFIRMED` | `PAID` | Bank Webhook / VietQR | `paidAmount >= totalAmount` | Decrements `stockQuantity -= Q` AND `reservedQuantity -= Q` (`COMMIT_SALE`) | Emits `order.paid`, plays confetti chime, updates conversation state |
| `CONFIRMED` | `SHIPPING` | 3PL Dispatch (COD) | `paymentMethod === COD && trackingCode present` | Decrements `stockQuantity -= Q` AND `reservedQuantity -= Q` (`COMMIT_SALE`) | Emits `order.shipping`, generates thermal print waybill |
| `CONFIRMED` | `CANCELLED` | Agent / 24h Expiry | Order is unpaid | Decrements `reservedQuantity -= Q` (`RELEASE_RESERVATION`) | Emits `order.cancelled`, creates `RELEASE_RESERVATION` ledger |
| `PAID` | `SHIPPING` | Agent / Courier Push | Tracking code present | None (Stock already committed at `PAID`) | Emits `order.shipping`, generates print data |
| `PAID` | `CANCELLED` | Agent (Refund) | Refund approved | Restocks physical stock: `stockQuantity += Q` (`RETURN_RESTOCK`) | Emits `order.cancelled`, logs refund transaction |
| `SHIPPING` | `COMPLETED` | Carrier Webhook / Agent | Carrier marks DELIVERED | None | Emits `order.completed`, sets `paymentStatus: PAID` if COD, closes ticket |
| `SHIPPING` | `CANCELLED` | Delivery Failed / Return | Customer reject / return | Restocks physical stock: `stockQuantity += Q` (`RETURN_RESTOCK`) | Emits `order.returned`, logs `RETURN_RESTOCK` |

---

### 4.3. Stock Reservation Timing Rationale

1. **Why NOT reserve stock at `DRAFT`?**
   - The AI conversation extractor generates order drafts continuously as customers express interest.
   - If stock were locked at `DRAFT`, uncommitted inquiries or abandoned chats would artificially deplete inventory, causing false out-of-stock conditions for genuine buyers.

2. **Why reserve stock at `CONFIRMED`?**
   - `CONFIRMED` signifies mutual agreement between the agent and buyer on pricing, items, and delivery address.
   - Reserving stock here guarantees that when the customer scans the dynamic VietQR, their goods are reserved and cannot be bought out from under them.

3. **Auto-Expiration TTL via BullMQ**:
   - Every confirmed order schedules a delayed BullMQ job: `expire-unpaid-order` (delay: 24 hours).
   - If the order has not transitioned to `PAID` when the job runs, the worker cancels the order and releases reserved stock back to available inventory.

---

## 5. REST API Contracts & Zod Schemas

All endpoints are scoped under `/api/v1/workspaces/:workspaceId/` and guarded by `JwtAuthGuard`, `WorkspaceGuard`, and `RolesGuard`. The standard envelope `{ success: true, data, meta? }` is applied automatically via `TransformInterceptor`.

### 5.1. Product & Catalog Endpoints

#### 1. `GET /api/v1/workspaces/:workspaceId/products`
Retrieves products with searching, barcode matching, and inventory status.

- **Query Schema (Zod)**:
```typescript
export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().optional(), // Searches name, SKU, barcode
  category: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  lowStock: z.coerce.boolean().optional(), // Items with stockQuantity <= 5
  sortBy: z.enum(['name', 'createdAt', 'basePrice']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
```

- **Response Body**:
```json
{
  "success": true,
  "data": [
    {
      "id": "c3b3e2a0-1234-4567-89ab-cdef01234567",
      "workspaceId": "ws_alpha",
      "name": "Áo Polo Pique Cotton Cao Cấp",
      "slug": "ao-polo-pique-cotton",
      "sku": "POLO-PIQUE-01",
      "barcode": "8935001234567",
      "basePrice": "280000.00",
      "costPrice": "140000.00",
      "imageUrl": "https://storage.salescopilot.vn/products/polo.jpg",
      "totalStock": 45,
      "variants": [
        {
          "id": "v1a2b3c4-0001-4567-89ab-cdef01234567",
          "name": "Size L / Đen",
          "sku": "POLO-PIQUE-01-L-BLK",
          "barcode": "8935001234568",
          "price": "280000.00",
          "stockQuantity": 15,
          "reservedQuantity": 2,
          "availableStock": 13,
          "attributes": { "size": "L", "color": "Đen" }
        }
      ]
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "totalItems": 1,
    "totalPages": 1
  }
}
```

---

#### 2. `POST /api/v1/workspaces/:workspaceId/products`
Creates a product with nested variants.

- **Request Body Schema (Zod)**:
```typescript
export const createProductSchema = z.object({
  name: z.string().trim().min(2, 'Tên sản phẩm tối thiểu 2 ký tự'),
  slug: z.string().trim().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  basePrice: z.coerce.number().positive('Giá bán phải lớn hơn 0'),
  costPrice: z.coerce.number().min(0).default(0),
  sku: z.string().trim().min(1, 'SKU là bắt buộc'),
  barcode: z.string().trim().optional(),
  imageUrl: z.string().url().optional(),
  images: z.array(z.string().url()).default([]),
  trackInventory: z.boolean().default(true),
  variants: z.array(z.object({
    name: z.string().trim().min(1, 'Tên biến thể bắt buộc'),
    sku: z.string().trim().min(1, 'SKU biến thể bắt buộc'),
    barcode: z.string().trim().optional(),
    price: z.coerce.number().positive('Giá biến thể phải lớn hơn 0'),
    costPrice: z.coerce.number().min(0).default(0),
    stockQuantity: z.coerce.number().int().min(0).default(0),
    attributes: z.record(z.string()).default({}),
    imageUrl: z.string().url().optional(),
  })).min(1, 'Sản phẩm phải có ít nhất 1 biến thể'),
});
```

---

#### 3. `POST /api/v1/workspaces/:workspaceId/products/:id/variants/:variantId/inventory`
Manual stock adjustment (restock, write-off, or inventory count).

- **Request Body Schema (Zod)**:
```typescript
export const adjustInventorySchema = z.object({
  type: z.nativeEnum(InventoryTransactionType), // STOCK_IN, STOCK_OUT, INVENTORY_AUDIT
  quantity: z.coerce.number().int().positive('Số lượng phải lớn hơn 0'),
  reason: z.string().trim().min(2, 'Lý do điều chỉnh là bắt buộc'),
});
```

---

### 5.2. Order Management Endpoints

#### 1. `POST /api/v1/workspaces/:workspaceId/orders`
Creates a new order directly from the POS Drawer.

- **Request Body Schema (Zod)**:
```typescript
export const createOrderSchema = z.object({
  conversationId: z.string().uuid().optional(),
  contactId: z.string().uuid('Contact ID không hợp lệ'),
  // Status defaults strictly to DRAFT. Advanced statuses (CONFIRMED, PAID, COMPLETED) cannot be injected by client
  status: z.literal(OrderStatus.DRAFT).default(OrderStatus.DRAFT),
  discountAmount: z.coerce.number().min(0).default(0),
  discountType: z.nativeEnum(DiscountType).default(DiscountType.FIXED_AMOUNT),
  discountReason: z.string().optional(),
  shippingFee: z.coerce.number().min(0).default(0),
  customerNotes: z.string().optional(),
  internalNotes: z.string().optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    variantId: z.string().uuid(),
    quantity: z.coerce.number().int().positive('Số lượng phải lớn hơn 0'),
    unitPrice: z.coerce.number().positive('Đơn giá phải lớn hơn 0'),
    discountAmount: z.coerce.number().min(0).default(0),
  })).min(1, 'Đơn hàng phải có ít nhất 1 sản phẩm'),
  shippingAddress: z.object({
    recipientName: z.string().trim().min(2, 'Tên người nhận tối thiểu 2 ký tự'),
    phoneNumber: z.string().trim().regex(/^(0|\+84)[3|5|7|8|9][0-9]{8}$/, 'Số điện thoại không hợp lệ'),
    streetAddress: z.string().trim().min(3, 'Địa chỉ đường/số nhà bắt buộc'),
    ward: z.string().trim().min(1, 'Phường/Xã bắt buộc'),
    district: z.string().trim().min(1, 'Quận/Huyện bắt buộc'),
    province: z.string().trim().min(1, 'Tỉnh/Thành phố bắt buộc'),
    shippingCarrier: z.nativeEnum(CarrierProvider).default(CarrierProvider.CUSTOM),
    shippingNotes: z.string().optional(),
    carrierMetadata: z.record(z.any()).optional().default({}),
  }).optional(),
});
```

- **Response Body**:
```json
{
  "success": true,
  "data": {
    "id": "e4f5a6b7-8901-2345-6789-abcdef012345",
    "displayId": 1004,
    "orderNumber": "ORD-20260908-1004",
    "workspaceId": "ws_alpha",
    "status": "DRAFT",
    "paymentStatus": "UNPAID",
    "fulfillmentStatus": "UNFULFILLED",
    "subtotal": "560000.00",
    "discountAmount": "50000.00",
    "shippingFee": "30000.00",
    "totalAmount": "540000.00",
    "paidAmount": "0.00",
    "items": [
      {
        "id": "i1a2b3c4-5678-90ab-cdef-1234567890ab",
        "productName": "Áo Polo Pique Cotton",
        "variantName": "Size L / Đen",
        "sku": "POLO-PIQUE-01-L-BLK",
        "unitPrice": "280000.00",
        "quantity": 2,
        "totalPrice": "560000.00"
      }
    ],
    "shippingAddress": {
      "recipientName": "Nguyễn Văn An",
      "phoneNumber": "0988121234",
      "carrierNetwork": "VIETTEL",
      "streetAddress": "Số 45 ngõ 120 Trường Chinh",
      "ward": "Phường Phương Mai",
      "district": "Quận Đống Đa",
      "province": "Hà Nội",
      "carrierMetadata": {
        "ghnDistrictId": 1450,
        "ghnWardCode": "1A0207"
      }
    },
    "createdAt": "2026-09-08T09:40:00.000Z"
  }
}
```

---

#### 2. `POST /api/v1/workspaces/:workspaceId/orders/:id/confirm`
Transitions order from `DRAFT` to `CONFIRMED`. Atomically locks and reserves inventory.

- **URL Params**: `id` (UUID)
- **Response**: Full confirmed order object with reserved stock status.
- **Error Codes**:
  - `404 Not Found`: `ORDER_NOT_FOUND`
  - `400 Bad Request`: `INVALID_STATUS_TRANSITION`, `EMPTY_ORDER`
  - `409 Conflict`: `INSUFFICIENT_STOCK` (returns variant details and remaining available stock).

---

#### 3. `POST /api/v1/workspaces/:workspaceId/orders/:id/pay`
Records manual payment (for cash at desk or manual bank transfer verification).

- **Request Body Schema (Zod)**:
```typescript
export const manualPayOrderSchema = z.object({
  paymentMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.CASH),
  amount: z.coerce.number().positive('Số tiền thanh toán phải lớn hơn 0'),
  transactionCode: z.string().optional(),
  notes: z.string().optional(),
});
```

---

#### 4. `POST /api/v1/workspaces/:workspaceId/orders/:id/cancel`
Cancels an order and releases any reserved inventory.

- **Request Body Schema (Zod)**:
```typescript
export const cancelOrderSchema = z.object({
  cancelReason: z.string().trim().min(3, 'Lý do hủy đơn bắt buộc'),
});
```

---

### 5.3. Dynamic VietQR Generation Endpoint

#### `POST /api/v1/workspaces/:workspaceId/orders/:id/vietqr`
Generates a dynamic VietQR payload (EMVCo format) and quick-copy metadata.

- **Request Body Schema (Zod)**:
```typescript
export const generateVietQrSchema = z.object({
  bankBin: z.string().optional(),        // e.g., "970422" (MBBank). Defaults to Workspace Bank Config
  accountNumber: z.string().optional(),  // Defaults to Workspace Bank Config
  accountName: z.string().optional(),    // Defaults to Workspace Bank Config
});
```

- **Transfer Memo Invariant**:
  ```text
  ORD {displayId}
  // Example: "ORD 1004"
  ```
  *Design Rationale*: Vietnamese mobile banking apps restrict transfer remarks to alphanumeric characters without special characters. Using the clear, uppercase prefix `ORD` followed by the order's sequential display ID guarantees 100% regex parsing accuracy in webhook ingestion while remaining concise for customers.

- **Response Body**:
```json
{
  "success": true,
  "data": {
    "orderId": "e4f5a6b7-8901-2345-6789-abcdef012345",
    "orderNumber": "ORD-20260908-1004",
    "displayId": 1004,
    "amount": 540000,
    "bankBin": "970422",
    "bankCode": "MB",
    "bankName": "Ngân hàng Quân Đội (MBBank)",
    "accountNumber": "0987654321",
    "accountName": "CONG TY SALES COPILOT",
    "transferContent": "ORD 1004",
    "qrUrl": "https://img.vietqr.io/image/970422-0987654321-compact2.png?amount=540000&addInfo=ORD%201004&accountName=CONG%20TY%20SALES%20COPILOT",
    "qrPayload": "00020101021238540010A00000072701240006970422011009876543210208QRIBFTTA530370454065400005802VN5921CONG TY SALES COPILOT62120808ORD 100463042B6B"
  }
}
```

---

### 5.4. Thermal Shipping Label Printing Endpoint

#### `GET /api/v1/workspaces/:workspaceId/orders/:id/shipping-label`
Generates formatted print data optimized for ESC/POS thermal printers (58mm K58 and 80mm K80) and browser `@media print`.

- **Query Parameters**:
  - `paperSize`: `'58mm' | '80mm'` (default: `'80mm'`)
  - `format`: `'html' | 'json'` (default: `'json'`)

- **Response Body (JSON)**:
```json
{
  "success": true,
  "data": {
    "paperSize": "80mm",
    "orderNumber": "ORD-20260908-1004",
    "barcode": "ORD202609081004",
    "createdAt": "2026-09-08T09:40:00.000Z",
    "sender": {
      "storeName": "Sales Copilot Fashion",
      "phoneNumber": "0901234567",
      "address": "Tầng 5, Tòa nhà Innovation, Cầu Giấy, Hà Nội"
    },
    "recipient": {
      "name": "Nguyễn Văn An",
      "phoneNumber": "098***1234",
      "fullPhoneNumber": "0988121234",
      "carrierNetwork": "VIETTEL",
      "fullAddress": "Số 45 ngõ 120 Trường Chinh, Phường Phương Mai, Quận Đống Đa, Hà Nội"
    },
    "carrier": {
      "provider": "GHTK",
      "trackingCode": "S21890.MN.123456"
    },
    "items": [
      {
        "name": "Áo Polo Pique Cotton - Size L / Đen",
        "sku": "POLO-PIQUE-01-L-BLK",
        "quantity": 2,
        "price": 280000,
        "total": 560000
      }
    ],
    "financials": {
      "subtotal": 560000,
      "discount": 50000,
      "shippingFee": 30000,
      "totalAmount": 540000,
      "paidAmount": 540000,
      "paymentStatus": "PAID",
      "codAmount": 0,
      "paymentMethod": "VIETQR"
    },
    "instructions": "Cho xem hàng, không cho thử",
    "printHtml": "<!DOCTYPE html><html><head><style>@page{size:80mm auto;margin:0;}body{font-family:Arial,sans-serif;width:76mm;padding:2mm;}...</style></head><body>...</body></html>"
  }
}
```

---

### 5.5. Banking Webhook Endpoint (SePay / Casso)

#### `POST /api/v1/workspaces/:workspaceId/webhooks/payments/:gateway`
- **Route**: Multi-Tenant Webhook Endpoint (guarded via Gateway Secret Token and/or HMAC SHA-256 signature).
- **Supported Gateways**: `sepay`, `casso`.
- **Tenant Scoping & Authentication Architecture**:
  - In strict compliance with `AGENTS.md` Rule 3.1, webhook routing embeds `:workspaceId` directly into the path (`/api/v1/workspaces/:workspaceId/webhooks/payments/:gateway`). This guarantees O(1) indexed resolution of workspace settings and direct retrieval of AES-256-GCM encrypted bank secrets/credentials via `ChannelCredentialService`.
  - *Gateway Parameter Fallback*: If an external payment provider does not permit dynamic route paths during webhook setup, the platform supports resolving the tenant in O(1) time via an indexed SHA-256 hash of the API key (`Workspace.webhookApiKeyHash`) without sequential table scanning.
  - `PaymentWebhooksGuard` validates `x-api-key` or HMAC `x-signature` specifically against the resolved workspace's credentials.
- **Headers**:
  - `x-api-key`: Workspace Webhook Secret Token.
  - `x-signature`: HMAC SHA-256 signature over request body.

- **Fast-ACK & Reliable Queueing Pipeline (< 50ms)**:
```text
[Incoming Bank Webhook]
          │
          ▼
[1. Verify API Key / HMAC Signature against Workspace] ──(Invalid)──► HTTP 401 Unauthorized
          │
          ▼ (Valid)
[2. Extract Unique Gateway Transaction ID]
    Fallback: `txId = payload.id || payload.transactionId || payload.referenceCode`
    (Guards against SePay `code: null` issue)
          │
          ▼
[3. Push to BullMQ `pos-reconciliation` Queue] (< 50ms)
    Payload includes `workspaceId`.
    BullMQ `jobId = \`${gateway}:${txId}\`` handles queue deduplication
    without dropping retries on worker failure.
          │
          ▼
[4. Return Immediate HTTP 200 { success: true, queued: true }]
```

- **SePay Inbound Payload Handling (`code: null` Invariant)**:
In standard Vietnamese interbank transfers received by SePay, `code` is `null` (only custom virtual accounts populate `code`). Systems that naively evaluate `\${gateway}:\${payload.code}\` will evaluate to `"sepay:null"`, triggering unique constraint crashes on the second payment. The platform robustly constructs the idempotency identifier from non-null identifiers:
```typescript
const txId = payload.id || payload.transactionId || payload.referenceCode;
const idempotencyKey = `${gateway}:${txId}`;
```

- **SePay Inbound Payload Sample**:
```json
{
  "id": 987654,
  "gateway": "Vietcombank",
  "transactionDate": "2026-09-08 09:45:12",
  "accountNumber": "0987654321",
  "code": null,
  "content": "ORD 1004 Nguyen Van An chuyen khoan",
  "transferType": "in",
  "transferAmount": 540000,
  "accumulated": 12540000,
  "subAccount": null,
  "referenceCode": "VCB.987654321",
  "description": "Thanh toan don hang ORD 1004"
}
```

---

## 6. Realtime Events & WebSocket Room Topology

### 6.1. Room Routing Topology
Sales Copilot's `RealtimeGateway` (namespace `/realtime`) routes events according to three tiered scopes:

1. `workspace_{workspaceId}`:
   - Subscribed by all agents active in the workspace.
   - Broadcasts workspace-level inventory changes and global order count badges.
2. `conversation_{conversationId}`:
   - Subscribed by agents viewing a specific conversation thread.
   - Broadcasts real-time order updates, VietQR cards, and agent collision events.
3. `order_{orderId}`:
   - Subscribed when an agent opens an order modal or shipping manager.

---

### 6.2. Event Definitions & Payloads

| Event Name | Room Scope | Payload Structure | Trigger Condition |
| :--- | :--- | :--- | :--- |
| `order.created` | `workspace_{wsId}`, `conversation_{convId}` | `OrderResponseDto` | Order draft created (Agent or AI) |
| `order.confirmed` | `workspace_{wsId}`, `conversation_{convId}` | `{ orderId, displayId, confirmedAt, reservedItems }` | Order confirmed; stock reserved |
| `order.paid` | `workspace_{wsId}`, `conversation_{convId}` | `{ orderId, paidAmount, paymentMethod, transactionCode }` | Bank match or manual payment success |
| `order.status_updated` | `workspace_{wsId}`, `conversation_{convId}` | `{ orderId, previousStatus, newStatus }` | Shipping or delivery status change |
| `order.cancelled` | `workspace_{wsId}`, `conversation_{convId}` | `{ orderId, cancelReason, releasedStock }` | Order cancelled; stock returned |
| `inventory.updated` | `workspace_{wsId}` | `{ variantId, sku, stockQuantity, availableStock }` | Stock change across workspace |
| `agent.collision_detected` | `conversation_{convId}` | `{ conversationId, activeAgents: [{ userId, name, avatarUrl, action }] }` | Multiple agents viewing/editing drawer |

> **⚠️ Room Emission Guard for Non-Chat Orders**: Counter POS orders or manual telephone orders have `conversationId = null`. All Socket.io room emissions must be safely guarded to prevent emitting to invalid rooms (`conversation_null` or `conversation_undefined`):
> ```typescript
> if (order.conversationId) {
>   this.socketServer.to(`conversation_${order.conversationId}`).emit(eventName, payload);
> }
> this.socketServer.to(`workspace_${order.workspaceId}`).emit(eventName, payload);
> ```

---

### 6.3. Real-Time Multi-Agent Collision Avoidance
To prevent two agents from issuing conflicting orders for the same customer:
1. When Agent A opens the POS Drawer or edits items:
   - Client sends WebSocket event `drawer.activity` with `{ conversationId, action: 'EDITING_ORDER' }`.
   - Server writes to Redis Hash: `HSET ws:{workspaceId}:conv:{conversationId}:drawer_agents {userId} JSON.stringify({ userId, name, avatarUrl, action, updatedAt: Date.now() })` with key TTL 30s.
   - Client emits heartbeat ping every 15s to refresh key TTL.
   - Server reads all active fields in the hash and broadcasts `agent.collision_detected` with `activeAgents: [...]` array to `conversation_{conversationId}`.
2. If Agent B opens the conversation:
   - Client renders an amber collision warning banner: *"⚠️ Hoàng Nam đang soạn đơn hàng cho khách này"*.
   - The primary action button (**"Tạo đơn"**) is soft-locked with a takeover confirmation dialog to prevent duplicate order generation.
3. When drawer is closed or user disconnects, server executes `HDEL` and broadcasts updated active agent array.

---

## 7. Background Processing & BullMQ Queues

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          BULLMQ ARCHITECTURE                           │
├───────────────────────────────────┬────────────────────────────────────┤
│        pos-reconciliation         │        pos-order-automation        │
├───────────────────────────────────┼────────────────────────────────────┤
│ • Bank Webhook Reconciliation     │ • AI Customer Details Extraction   │
│ • Transfer Memo Regex Matching    │ • Telco Carrier Auto-Detection     │
│ • Distributed Order Redlock       │ • 3-Level Address Parsing          │
│ • Auto-Transition to PAID         │ • Auto Draft Order Generation      │
│ • Inventory Commitment            │ • Suggestion Event Broadcast       │
└───────────────────────────────────┴────────────────────────────────────┘
```

### 7.1. Queue 1: `pos-reconciliation`

- **Queue Name**: `pos-reconciliation`
- **Job Name**: `reconcile-bank-payment`
- **Concurrency**: 5 workers per node
- **Retry Strategy**: 3 attempts with exponential backoff (1s, 5s, 15s)

#### Processing Logic (`pos-reconciliation.processor.ts`)
```typescript
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { 
  OrderStatus, 
  PaymentStatus, 
  PaymentMethod, 
  PaymentGateway, 
  PaymentTransactionStatus, 
  InventoryTransactionType 
} from '@sales-copilot/shared-contracts';

@Processor('pos-reconciliation')
export class PosReconciliationProcessor extends WorkerHost {
  private readonly logger = new Logger(PosReconciliationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    const { workspaceId, gateway, transactionCode, accountNumber, amount, transferContent, rawPayload } = job.data;

    if (!workspaceId) {
      this.logger.error(`Reconciliation job ${job.id} missing mandatory workspaceId.`);
      return { status: 'missing_workspace_id' };
    }

    // 1. Regex parsing on transfer content to extract displayId
    // Matches: "ORD 1004", "ORD1004", "DH 1004", "DH1004"
    const memoMatch = transferContent.match(/(?:ORD|DH)\s*(\d+)/i);
    if (!memoMatch) {
      this.logger.warn(`Unmatched memo format: "${transferContent}". Flagged for manual review.`);
      return { status: 'unmatched_memo' };
    }

    const displayId = parseInt(memoMatch[1], 10);

    // 2. Locate order by displayId strictly scoped to workspaceId (AGENTS.md Rule 3.1)
    const order = await this.prisma.getClient().order.findFirst({
      where: { displayId, workspaceId },
      include: { items: true },
    });

    if (!order) {
      this.logger.error(`Order displayId #${displayId} not found in workspace ${workspaceId}.`);
      return { status: 'order_not_found' };
    }

    // 3. Verify destination bank account matches workspace payment configuration
    const workspace = await this.prisma.getClient().workspace.findUnique({
      where: { id: workspaceId },
      select: { settings: true },
    });
    const workspaceSettings = (workspace?.settings as any) || {};
    const configuredBankAccounts = workspaceSettings.paymentAccounts || [];
    if (configuredBankAccounts.length > 0 && accountNumber) {
      const isAccountValid = configuredBankAccounts.some(
        (acc: any) => acc.accountNumber === accountNumber,
      );
      if (!isAccountValid) {
        this.logger.error(`Bank account ${accountNumber} does not match configured accounts for workspace ${workspaceId}.`);
        return { status: 'account_mismatch' };
      }
    }

    // 4. Acquire distributed lock for this specific order
    const lockKey = `ws:${workspaceId}:order:${order.id}:reconciliation_lock`;
    const lockToken = await this.redis.acquireLock(lockKey, 10000); // 10s TTL
    if (!lockToken) {
      throw new Error(`Order ${order.id} locked by another worker. Retrying...`);
    }

    try {
      const receivedAmount = Number(amount);
      const remainingAmount = Number(order.totalAmount) - Number(order.paidAmount);
      // Robust idempotency key handling SePay code: null
      const txId = rawPayload?.id || rawPayload?.transactionId || rawPayload?.referenceCode || transactionCode || job.id;
      const idempotencyKey = `${gateway}:${txId}`;

      return await this.prisma.getClient().$transaction(async (tx) => {
        // Record payment transaction
        await tx.paymentTransaction.create({
          data: {
            workspaceId,
            orderId: order.id,
            paymentMethod: PaymentMethod.VIETQR,
            gateway: gateway === 'sepay' ? PaymentGateway.SEPAY : PaymentGateway.CASSO,
            amount: receivedAmount,
            status: PaymentTransactionStatus.SUCCESS,
            transactionCode: String(txId),
            accountNumber,
            transferContent,
            rawWebhookPayload: rawPayload,
            idempotencyKey,
            paidAt: new Date(),
          },
        });

        if (receivedAmount >= remainingAmount) {
          // Full payment: Transition order status to PAID
          const updatedOrder = await tx.order.update({
            where: { workspaceId_id: { workspaceId, id: order.id } },
            data: {
              status: OrderStatus.PAID,
              paymentStatus: PaymentStatus.PAID,
              paidAmount: { increment: receivedAmount },
              paidAt: new Date(),
            },
            include: { items: true, shippingAddress: true },
          });

          // Commit stock for each line item (Model A)
          // Deterministic sorting to prevent circular wait deadlocks
          const sortedItems = [...order.items].sort((a, b) => a.variantId.localeCompare(b.variantId));

          for (const item of sortedItems) {
            if (order.status === OrderStatus.CONFIRMED) {
              // Item was previously reserved: decrement BOTH stockQuantity and reservedQuantity
              await tx.productVariant.update({
                where: { workspaceId_id: { workspaceId, id: item.variantId } },
                data: {
                  stockQuantity: { decrement: item.quantity },
                  reservedQuantity: { decrement: item.quantity },
                },
              });

              // Fetch live snapshot for authentic ledger balances
              const currentVariant = await tx.productVariant.findFirstOrThrow({
                where: { id: item.variantId, workspaceId },
              });

              await tx.inventoryTransaction.create({
                data: {
                  workspaceId,
                  variantId: item.variantId,
                  orderId: order.id,
                  type: InventoryTransactionType.COMMIT_SALE,
                  quantity: item.quantity,
                  previousStock: currentVariant.stockQuantity + item.quantity,
                  newStock: currentVariant.stockQuantity,
                  previousReserved: currentVariant.reservedQuantity + item.quantity,
                  newReserved: currentVariant.reservedQuantity,
                  reason: `Payment verified via ${gateway} (${txId}) - Committed reservation`,
                },
              });
            } else {
              // Order was in DRAFT: stock was never in reservedQuantity. Decrement stockQuantity directly.
              await tx.productVariant.update({
                where: { workspaceId_id: { workspaceId, id: item.variantId } },
                data: {
                  stockQuantity: { decrement: item.quantity },
                },
              });

              const currentVariant = await tx.productVariant.findFirstOrThrow({
                where: { id: item.variantId, workspaceId },
              });

              await tx.inventoryTransaction.create({
                data: {
                  workspaceId,
                  variantId: item.variantId,
                  orderId: order.id,
                  type: InventoryTransactionType.COMMIT_SALE,
                  quantity: item.quantity,
                  previousStock: currentVariant.stockQuantity + item.quantity,
                  newStock: currentVariant.stockQuantity,
                  previousReserved: currentVariant.reservedQuantity,
                  newReserved: currentVariant.reservedQuantity,
                  reason: `Payment verified via ${gateway} (${txId}) - Direct draft commitment`,
                },
              });
            }
          }

          // Emit domain event with room emission guard
          this.eventEmitter.emit('order.paid', {
            workspaceId,
            orderId: order.id,
            conversationId: order.conversationId,
            paidAmount: receivedAmount,
            order: updatedOrder,
          });

          return { status: 'fully_paid', orderId: order.id };
        } else {
          // Partial payment
          const updatedOrder = await tx.order.update({
            where: { workspaceId_id: { workspaceId, id: order.id } },
            data: {
              paymentStatus: PaymentStatus.PARTIALLY_PAID,
              paidAmount: { increment: receivedAmount },
            },
          });

          this.eventEmitter.emit('order.partially_paid', {
            workspaceId,
            orderId: order.id,
            conversationId: order.conversationId,
            paidAmount: receivedAmount,
            remaining: remainingAmount - receivedAmount,
            order: updatedOrder,
          });

          return { status: 'partially_paid', orderId: order.id };
        }
      });
    } finally {
      await this.redis.releaseLock(lockKey, lockToken);
    }
  }
}
```

---

### 7.2. Queue 2: `pos-order-automation` (AI Conversation Extraction)

- **Queue Name**: `pos-order-automation`
- **Job Name**: `extract-order-details`
- **Trigger**: Inbound customer chat message (`DomainEvent.MESSAGE_CREATED`) debounced by 500ms to aggregate sequential bursts.
- **Workflow**:
  1. Fast Regex extracts Vietnamese phone numbers (`0988121234`).
  2. Carrier prefix rules identify Telco (`CarrierNetwork.VIETTEL`).
  3. Trie / Administrative dictionary resolves 3-level Vietnamese administrative address (Hà Nội -> Đống Đa -> Phương Mai).
  4. Vector or fuzzy string match queries catalog for SKU/Variant (`Áo Polo size L đen`).
  5. If confidence score > 80%, generates a `DRAFT` order in DB.
  6. Emits `copilot.draft_order_suggested` via Socket.io. The POS Drawer on the frontend displays an **"Áp dụng (Tab)"** banner for 1-click confirmation.

---

## 8. Telco Carrier & Administrative Address Parser Specification

### 8.1. Vietnamese Mobile Carrier Prefix Detection Rules

| Network Prefix Range | Carrier Name | `CarrierNetwork` Enum |
| :--- | :--- | :--- |
| `086`, `096`, `097`, `098`, `032`, `033`, `034`, `035`, `036`, `037`, `038`, `039` | Viettel Telecom | `VIETTEL` |
| `088`, `091`, `094`, `083`, `084`, `085`, `081`, `082` | VNPT Vinaphone | `VINAPHONE` |
| `089`, `090`, `093`, `070`, `079`, `077`, `076`, `078` | MobiFone | `MOBIFONE` |
| `092`, `056`, `058` | Vietnamobile | `VIETNAMOBILE` |
| `099`, `059` | Gmobile | `GMOBILE` |
| `087` | Itelecom | `ITEL` |
| `055` | Wintel (Mobicast) | `WINTEL` |

#### Detection Helper Implementation
```typescript
export function detectCarrierNetwork(phoneNumber: string): CarrierNetwork {
  const clean = phoneNumber.replace(/[\s.-]/g, '').replace(/^\+84/, '0');
  const prefix = clean.substring(0, 3);

  const viettel = ['086', '096', '097', '098', '032', '033', '034', '035', '036', '037', '038', '039'];
  const vina = ['088', '091', '094', '083', '084', '085', '081', '082'];
  const mobi = ['089', '090', '093', '070', '079', '077', '076', '078'];
  const vnm = ['092', '056', '058'];
  const gmobile = ['099', '059'];

  if (viettel.includes(prefix)) return CarrierNetwork.VIETTEL;
  if (vina.includes(prefix)) return CarrierNetwork.VINAPHONE;
  if (mobi.includes(prefix)) return CarrierNetwork.MOBIFONE;
  if (vnm.includes(prefix)) return CarrierNetwork.VIETNAMOBILE;
  if (gmobile.includes(prefix)) return CarrierNetwork.GMOBILE;
  if (prefix === '087') return CarrierNetwork.ITEL;
  if (prefix === '055') return CarrierNetwork.WINTEL;

  return CarrierNetwork.OTHER;
}
```

---

## 9. External Integration Adapters

### 9.1. VietQR NAPAS 247 Dynamic QR Specification

VietQR encodes bank transfer instructions in standard EMVCo Merchant-Presented Mode (MPM) QR format:
- **Tag 00**: Payload Format Indicator (`"01"`).
- **Tag 01**: Point of Initiation Method (`"12"` for Dynamic QR with amount).
- **Tag 38**: Merchant Account Information (NAPAS 247).
  - Sub-tag 00: GUID (`"A000000727"` for VietQR).
  - Sub-tag 01: Beneficiary Bank BIN (6 digits, e.g., `"970422"` for MBBank) + Account Number (`"0987654321"`).
  - Sub-tag 02: Service Code (`"QRIBFTTA"` for Quick Transfer to Account).
- **Tag 53**: Transaction Currency (`"704"` for VND).
- **Tag 54**: Transaction Amount (Order `totalAmount`, e.g., `"540000"`).
- **Tag 58**: Country Code (`"VN"`).
- **Tag 59**: Merchant / Beneficiary Name (`"CONG TY SALES COPILOT"`).
- **Tag 62**: Additional Data Field Template.
  - Sub-tag 08: Purpose of Transaction / Memo (`"ORD 1004"`).
- **Tag 63**: CRC-16 (EMVCo CCITT-FALSE checksum).

#### EMVCo Standard CRC-16 (CCITT-FALSE) Implementation
The CRC-16 checksum must follow the standard EMVCo CCITT-FALSE specification (Polynomial `0x1021`, Initial Value `0xFFFF`, Final XOR `0x0000`):

```typescript
/**
 * Computes standard EMVCo CRC-16 (CCITT-FALSE) checksum.
 * Used for dynamic VietQR generation and strict banking verification.
 */
export function calculateCrc16Ccitt(payload: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= (payload.charCodeAt(i) << 8);
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
```

---

### 9.2. Shipping Carrier Adapter (`ShippingCarrierAdapter`)

In accordance with anti-over-engineering rules, polymorphic interfaces are strictly reserved for external logistics providers:

```typescript
export interface FeeCalculationInput {
  workspaceId: string;
  fromProvince: string;
  fromDistrict: string;
  toProvince: string;
  toDistrict: string;
  weightGrams: number;
  insuranceValue?: number;
}

export interface FeeCalculationResult {
  carrier: CarrierProvider;
  serviceName: string;
  shippingFee: number;
  insuranceFee: number;
  totalFee: number;
  estimatedDeliveryDate?: Date;
}

export interface CreateShipmentInput {
  workspaceId: string;
  orderId: string;
  recipientName: string;
  phoneNumber: string;
  streetAddress: string;
  ward: string;
  district: string;
  province: string;
  codAmount: number;
  weightGrams: number;
  items: Array<{ name: string; quantity: number }>;
  note?: string;
}

export interface ShipmentResult {
  carrier: CarrierProvider;
  trackingCode: string;
  sortingCode?: string;
  totalFee: number;
  labelUrl?: string;
}

export interface ShippingCarrierAdapter {
  calculateFee(input: FeeCalculationInput): Promise<FeeCalculationResult>;
  createShipment(input: CreateShipmentInput): Promise<ShipmentResult>;
  trackShipment(trackingCode: string, workspaceId: string): Promise<any>;
  cancelShipment(trackingCode: string, workspaceId: string): Promise<boolean>;
}
```

The system implements `GhtkCarrierAdapter` and `GhnCarrierAdapter`, injecting them via a factory based on workspace settings.

---

## 10. Security, Multi-Tenancy & Performance SLAs

1. **Strict Multi-Tenancy Invariant**:
   - Every read, write, update, and delete MUST include `workspaceId`.
   - Redis cache keys MUST follow: `ws:{workspaceId}:pos:...`.
2. **Channel & Banking Credential Encryption**:
   - Banking API keys, webhook secrets, and carrier tokens stored in `Workspace.settings` MUST be encrypted at rest using **AES-256-GCM** via `ChannelCredentialService`. Plaintext tokens are never logged.
3. **Webhook Verification**:
   - Webhook endpoints verify HMAC-SHA256 signatures before reading payloads.
   - Redis idempotency guards prevent duplicate payment recognition.
4. **Performance SLAs**:
   - Catalog Search / Barcode match: `< 50ms` (p95).
   - Order Confirmation & Inventory Lock: `< 100ms` (p95).
   - Bank Webhook Ingestion ACK: `< 50ms` (p95).
   - Bank Webhook Processing to In-Chat Paid State: `< 1.5s` end-to-end.

---

## 11. Phased Implementation Roadmap & Verification Plan

### 11.1. Milestone Breakdown

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        IMPLEMENTATION ROADMAP                          │
├────────────────────────────────┬───────────────────────────────────────┤
│ M1: Schema & Core Backend      │ - Prisma migration for 7 POS models   │
│ (Foundation & Data Access)     │ - ProductsService & OrdersService     │
│                                │ - Atomic conditional decrement logic  │
├────────────────────────────────┼───────────────────────────────────────┤
│ M2: Realtime In-Chat POS Drawer│ - Socket.io order room events         │
│ (Frontend UX & Collision)      │ - Agent collision detection & banners │
│                                │ - Fast Command/Combobox catalog UI    │
├────────────────────────────────┼───────────────────────────────────────┤
│ M3: Dynamic VietQR & Webhook   │ - VietQR EMVCo generator              │
│ (Reconciliation Automation)    │ - SePay / Casso webhook receivers     │
│                                │ - BullMQ `pos-reconciliation` queue   │
├────────────────────────────────┼───────────────────────────────────────┤
│ M4: Thermal Labels & AI Order  │ - 58mm/80mm ESC/POS & HTML templates  │
│ (Logistics & Intelligent POS)  │ - BullMQ `pos-order-automation` queue │
│                                │ - GHTK/GHN Shipping Carrier Adapters  │
└────────────────────────────────┴───────────────────────────────────────┘
```

---

### 11.2. Independent Verification & Quality Gates

To ensure zero regressions and forensic audibility, the following verification commands must pass:

1. **Unit & Concurrency Tests**:
   - `pnpm nx test server --testFile=orders.service.spec.ts`
   - Test scenario: 10 concurrent requests attempting to purchase 1 remaining unit of stock. Verify that exactly 1 succeeds and 9 fail with `INSUFFICIENT_STOCK`.
2. **Multi-Tenancy Isolation Verification**:
   - `pnpm nx test server --testFile=pos-multitenancy.spec.ts`
   - Verify that Workspace A cannot query, update, or cancel orders or products belonging to Workspace B.
3. **Webhook Idempotency & Reconciliation Tests**:
   - `pnpm nx test server --testFile=webhook-reconciliation.spec.ts`
   - Verify that duplicate webhook deliveries are acknowledged with `duplicated: true` without double-crediting balances.
4. **Monorepo Quality Gates**:
   - `pnpm nx run-many -t lint` (0 errors)
   - `pnpm nx run-many -t build` (Clean compile)
   - `pnpm nx run-many -t test` (All tests green)

---
*End of Technical Architecture RFC & Prisma Schema Specification.*
