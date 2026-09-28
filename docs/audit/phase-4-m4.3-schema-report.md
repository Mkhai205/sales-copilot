# Phase 4 — Milestone 4.3: Database Schema Audit Report

> **Ngày:** 2026-09-28
> **Scope:** TASK-4.3-03 — `apps/server/prisma/schema.prisma` (831 dòng, 27 models, 20 enums) + migrations
> **Ranh giới:** KHÔNG tạo migration trong milestone này — mọi thay đổi schema là đề xuất kèm SQL sketch
> **`npx prisma validate`: PASS** · **Unused models: 0/27** · **Migration history: sạch (1 init migration, không có create-then-drop)**

---

## 1. Enum values không dùng trong code (15/~120)

| Sev | Value | Trạng thái | Khuyến nghị |
|-----|-------|------------|-------------|
| MED | `OrderStatus.SHIPPING` | **Unreachable state** — guards/dashboard/reconciliation đọc nhưng không có writer nào (`shippedAt` cũng never written) | Không xóa ngay — implement transition endpoint, hoặc gỡ khỏi guard conditions; removal sau này an toàn dữ liệu (0 rows) |
| MED | `FulfillmentStatus.PROCESSING/SHIPPED/RETURNED/CANCELLED` | Lifecycle thực tế chỉ UNFULFILLED → DELIVERED | Giữ (API surface); `.CANCELLED` trùng nghĩa `OrderStatus.CANCELLED` — hoặc wire transition hoặc trim sau |
| MED | `PaymentTransactionStatus.FAILED/EXPIRED/CANCELLED` | **Never written** — bucket "failed" trong stats = mọi thứ không phải SUCCESS/PENDING; QR expiry flow (EXPIRED) chưa implement | Flag: dead states trên financial ledger — implement expiry flow |
| MED | `ChannelType.ZALO` / `.EMAIL` | 0 refs trong code (deliberate deferral từ M4.1) | Giữ enum (PG enum zero-cost); removal = `ALTER TYPE ... DROP VALUE` (PG14+, ngoài txn) — không khuyến nghị; khi xóa thì xóa kèm `lib/channels.ts` meta + 2 icons + placeholder UI |
| LOW | `ConversationPriority.URGENT/HIGH/LOW`, `MessageType.TEMPLATE`, `DeliveryStatus.PENDING`, `PaymentMethod.BANK_TRANSFER/.CREDIT_CARD`, `PaymentGateway.VNPAY/.MOMO`, `PlatformRole.USER` (default) | Reserved/settable qua API | Giữ |
| MED | `KnowledgeEmbeddingStatus` | 4 values đều dùng NHƯNG qua **raw string literals** (kể cả raw SQL) thay vì enum — type-safety gap | Import generated enum vào `knowledge.service.ts:195,252,323` + `knowledge-embedding.processor.ts:48,91` |

## 2. Index & Performance

| Sev | Finding | Evidence | Đề xuất (SQL sketch — chưa chạy) |
|-----|---------|----------|----------------------------------|
| **HIGH** | **Không có ANN index trên pgvector** — mọi RAG similarity query là sequential scan | `schema.prisma:818` (`embedding vector(768)`), migration không có hnsw/ivfflat | `CREATE INDEX knowledge_article_embedding_hnsw_idx ON "KnowledgeArticle" USING hnsw ("embedding" vector_cosine_ops) WHERE "embedding" IS NOT NULL;` (khớp toán tử cosine `<=>` đang dùng) — Prisma không express được, cần manual-SQL migration |
| MED | `audit_logs` filter `action`/`userId` trong workspace không có covering index | `audit-logs.service.ts:70-100` vs `schema.prisma:543-544` | `@@index([workspaceId, action])` (+ `([workspaceId, userId])` khi volume lớn) |
| MED | `orders` filter `fulfillmentStatus` không index | `orders.service.ts:1124` | `@@index([workspaceId, fulfillmentStatus])` |
| LOW | `orders.[workspaceId, paymentMethod]` **không được query nào dùng** | schema.prisma:675 | Drop trong cleanup migration |
| LOW | `conversations` filter `priority` không index | `conversations.service.ts:624` | Thêm khi priority filtering phổ biến |

**VERIFIED-OK composite coverage:** Message `[conversationId, createdAt]` + `[workspaceId, externalId]`; Order workspace+status/paymentStatus/createdAt/contactId/conversationId; PaymentTransaction `[workspaceId, status]` + createdAt; InventoryTransaction 3 composites; Conversation 6 workspace-scoped composites; các `@@unique` double làm lookup index.

## 3. N+1 patterns (chỉ report — inventory per-item loop là deliberate deadlock-prevention)

| Sev | Vị trí | Pattern | Fix |
|-----|--------|---------|-----|
| MED | `orders.service.ts:109-112, 351-354` | Per-item `productVariant.findFirst({include:{product}})` trong create/update | 1 `findMany({ where: { id: { in: [...] }, workspaceId } })` + Map |
| MED | `channel-ingestion.processor.ts:212-240` | Per-inbound-message findFirst+update cho delivery receipts | Batch `in` query + `updateMany` |
| MED | `products.service.ts:208-217` | Per-variant SKU conflict check | `findMany({ sku: { in: skus } })` |
| LOW | `products.service.ts:269-285` (inventoryTransaction.create per variant), `teams.service.ts:306-308` (per-user create), `facebook.service.ts:371-382` (per-page findFirst) | Bounded loops | `createMany` / `findMany in` khi thuận tiện |

VERIFIED-OK: message listing dùng `enrichAndMapMessagesBulk` (no N+1); auto-assignment batch presence/workload; inventory-ledger per-item `$executeRaw` sorted-by-variantId là pattern chống deadlock có chủ đích (comment 40P01).

## 4. Cascade safety

| Sev | Finding | Evidence | Đề xuất |
|-----|---------|----------|---------|
| **HIGH** | **Workspace hard-delete sẽ fail/không xác định do interleaved cascade paths**: Workspace→Cascade→products và →orders→order_items, nhưng `order_items.product/variant` là **Restrict** (`schema.prisma:702-703`), tương tự `inventory_transactions.variant` (760), `orders.contact`/`conversations.contact` Restrict (418, 663). Postgres không đảm bảo thứ tự cascade giữa các sibling paths → RESTRICT có thể fire trước | schema.prisma:702-703, 760 | (a) Soft-delete workspace (`isSuspended` — đã có field) thay vì hard-delete, (b) hoặc `OrderItem.product/variant` + `InventoryTransaction.variant` → `onDelete: Cascade` (productName/sku đã denormalize trong snapshot), (c) hoặc delete theo thứ tự tường minh trong 1 tx |
| LOW | Contact delete bị Restrict từ conversations/orders — an toàn có chủ đích; map P2003 → 409 ở API | — | Chấp nhận |

VERIFIED-OK: mọi owning relation có explicit onDelete; AuditLog SetNull cả 2 FK (log sống sót); PaymentTransaction.order SetNull; Channel.inboxId 1-1 nhất quán.

## 5. Data integrity

| Sev | Finding | Đề xuất |
|-----|---------|---------|
| MED | **Inbox name không có unique constraint** — `inboxes.service.ts` chỉ check channel conflict, không check trùng tên (Team thì có `[workspaceId, name]`) | `@@unique([workspaceId, name])` + dedupe existing rows trong migration |
| MED | `Product.trackInventory` được set/read ở products service nhưng **inventory-ledger không bao giờ đọc** — stock ops chạy bất kể | Gate inventory mutations theo flag, hoặc remove |
| LOW | `Order.taxAmount` write-only literal 0; `Order.shippedAt` never written (liên quan SHIPPING unreachable) | Document as reserved hoặc drop cùng lúc triển khai fulfillment |
| LOW | Không có DB CHECK: TEXT message phải có content, `quantity > 0` | Kiểm soát ở app layer đủ cho pre-production |
| LOW | `KnowledgeArticle` là model duy nhất không `@@map` → bảng PascalCase giữa snake_case, ép raw SQL phải quote | `@@map("knowledge_articles")` trong migration sau |

## 6. VERIFIED-OK (business uniques đã có)

Workspace.slug unique; Order `[workspaceId, orderNumber]` + `[workspaceId, displayId]`; Product `[workspaceId, sku]` + slug; ProductVariant `[workspaceId, sku]`; CannedResponse `[workspaceId, shortCode]`; Label `[workspaceId, title]`; Channel `[workspaceId, channelType, providerAccountId]`; Contact `[workspaceId, identifier]`; idempotency `ChannelEvent [channelId, externalEventId]` + `PaymentTransaction [workspaceId, idempotencyKey]` (P2002 race handled). Required fields đúng: Order.totalAmount/subtotal NOT NULL, Conversation.inboxId NOT NULL, Message.content optional hợp lý cho media.

## 7. Top-5 khuyến nghị (impact-ranked, cần migration → làm ở PR riêng)

1. **HNSW index cho KnowledgeArticle.embedding** (HIGH) — RAG query từ seq-scan → index scan.
2. **Resolve workspace hard-delete vs Restrict** (HIGH) — soft-delete hoặc điều chỉnh cascade trên OrderItem/InventoryTransaction.
3. **3 MED N+1 batch fixes** (orders create/update, ingestion receipts, products SKU).
4. **`@@unique([workspaceId, name])` cho Inbox** + composite indexes audit_logs/orders + drop unused index.
5. **Order lifecycle quyết định:** implement SHIPPING/fulfillment + EXPIRED payment flow, hoặc tài liệu hóa các enum/field là reserved.
