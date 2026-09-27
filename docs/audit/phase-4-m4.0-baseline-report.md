# Phase 4 — Milestone 4.0: Baseline & Triage Report

> **Ngày:** 2026-09-28
> **Git tag:** `audit-v3-baseline` (commit `b86b186`, branch `refactor`)
> **Scope:** CI baseline + re-verify 17 prior audit findings từ audit v2.0. Không thay đổi code.

---

## 1. CI Baseline Metrics

| Lệnh | Kết quả | Chi tiết |
|------|---------|----------|
| `pnpm lint` | ✅ **0 errors, 0 warnings** | `eslint .` exit 0, không có output |
| `pnpm typecheck` | ✅ **0 type errors** | 5 projects pass: shared-contracts, email-templates, widget-sdk, web, server |
| `pnpm test:all` | ✅ **1452 pass / 0 fail / 0 skip** | Xem phân tích bên dưới |

### Phân tích test:all

| Suite | Test Suites | Tests | Pass | Fail | Skip |
|-------|:-----------:|:-----:|:----:|:----:|:----:|
| Unit (`apps/server/src`) | 97 | 1224 | 1224 | 0 | 0 |
| Integration (`test/integration`) | 3 | 26 | 26 | 0 | 0 |
| E2E (`test/e2e`) | 8 | 202 | 202 | 0 | 0 |
| **Total** | **108** | **1452** | **1452** | **0** | **0** |

**Đánh giá:** CI health ở trạng thái tốt — sạch hoàn toàn ở cả 3 gate. Đây là baseline vững để đo lường các milestone sau (mọi regression trong M4.1–M4.3 đều đo được so với số 0 này).

---

## 2. Re-verification: 17 Prior Audit Findings

**Tổng kết: ✅ 5 Fixed · ⚠️ 4 Partial · ❌ 8 Still Open**

### 2.1. Bảng tổng hợp

| ID | Severity | Vấn đề | Trạng thái |
|:---|:--------:|--------|:----------:|
| HIGH-01 | HIGH | `updateOrder` quên assign `paymentMethod` | ✅ Fixed |
| HIGH-02 | HIGH | `z.coerce.number()` trong mutation schemas | ✅ Fixed |
| HIGH-04 | HIGH | Reconciliation worker thiếu P2002 handling | ✅ Fixed |
| HIGH-08 | HIGH | God Services >300 LOC (claimed 16) | ❌ Still Open — **tệ hơn: 21 services** |
| HIGH-10 | HIGH | Dual routing chưa áp dụng cho Omnichannel | ❌ Still Open |
| MED-01 | MED | `DomainEvent` vs `WsServerEvent` chưa merge | ❌ Still Open |
| MED-02 | MED | `broadcastSafe` thiếu `workspaceId`/`timestamp` | ⚠️ Partial |
| MED-04 | MED | Query Keys Factory 0% adoption | ⚠️ Partial — **~80% adoption** |
| MED-05 | MED | Raw `<button>`, Radix imports, hardcoded colors | ⚠️ Partial — **tệ hơn** |
| MED-06 | MED | Module singleton cache `vietnam-address.ts` | ✅ Fixed |
| MED-07 | MED | Facebook DTOs split server/web | ❌ Still Open |
| MED-08 | MED | Secondary queries thiếu `workspaceId` | ⚠️ Partial |
| MED-09 | MED | Inventory ledger thiếu pessimistic locking | ✅ Fixed |
| LOW-01 | LOW | Leaked queue constants trong shared-contracts | ❌ Still Open |
| LOW-02 | LOW | Radix bypass trong `image-lightbox-dialog.tsx` | ❌ Still Open |
| LOW-03 | LOW | Phone regex divergence | ❌ Still Open |
| LOW-04 | LOW | Loose union types trong response DTOs | ❌ Still Open |

### 2.2. Chi tiết & Evidence

#### ✅ HIGH-01 — `updateOrder` paymentMethod — FIXED
`apps/server/src/modules/commerce/orders/orders.service.ts:475-484`: `paymentMethod` được assign vào `updateData` (và merge vào `metadata`) trước khi `tx.order.updateMany`. `paymentStatus` không có trong `updateOrderSchema` (đúng thiết kế, không phải omission).

#### ✅ HIGH-02 — `z.coerce.number()` — FIXED
Toàn bộ numeric fields trong `createProduct/updateProduct/createOrder/updateOrder` schemas đều là `z.number()` (kèm `.positive()/.int()/.min(0)`). `z.coerce` chỉ còn ở query params `page`/`limit` (12 files) — chấp nhận được cho query string.

#### ✅ HIGH-04 — P2002 reconciliation — FIXED
`payment-reconciliation.service.ts` xử lý P2002 ở 3 tầng (dòng 149-165, 205-224, 483-505) + idempotency key `gateway:transactionCode` + DB unique constraint `@@unique([workspaceId, idempotencyKey])` (schema.prisma:736) + BullMQ processor cũng catch P2002 (`commerce-reconciliation.processor.ts:119`) với regression test tương ứng.

#### ❌ HIGH-08 — God Services — STILL OPEN (WORSENED)
Số services ≥300 LOC tăng **16 → 21**. Cả 3 ví dụ gốc đều dài hơn:

| Service | Audit v2.0 | Hiện tại | Δ |
|---------|:---------:|:--------:|:--:|
| `orders.service.ts` | 1160 | **1291** | +131 |
| `inventory-ledger.service.ts` | 949 | **1056** | +107 |
| `conversations.service.ts` | 788 | **911** | +123 |

Top mới: `payment-reconciliation.service.ts` (963), `contacts.service.ts` (870), `workspaces.service.ts` (770). Hai helpers đã extract (`orders-calculator.ts` 91 LOC, `order-status-guard.ts` 89 LOC) vẫn còn nhưng service chính vẫn tiếp tục phình.

#### ❌ HIGH-10 — Dual routing Omnichannel — STILL OPEN
Backend: 6 controllers dùng dual route `['workspaces/:workspaceId/...', 'short']` (inventory, orders, products, reconciliation, dashboard, knowledge — knowledge mới được cover). Toàn bộ Omnichannel (conversations, contacts, inboxes, messages, labels, canned-responses, facebook, web-chat) + Identity (teams, audit-logs) vẫn chỉ short-route + `X-Workspace-Id` header. Frontend thì đã symmetric (`(commerce)`, `(conversations)`, `(overview)`, `(settings)` cùng cấp dưới `[workspaceSlug]/`). **Vấn đề còn lại hoàn toàn ở backend.**

#### ❌ MED-01 — Realtime enum duplication — STILL OPEN
`DomainEvent` (33 members, `realtime/events/event-payloads.ts:12-70`) vs `WsServerEvent` (35 members, `realtime/events/schemas.ts:7-68`) vẫn song song tồn tại, ~95% trùng string. Server bridge thủ công từng event trong `realtime-event.dispatcher.ts` (map `@OnEvent(DomainEvent.X)` → `broadcastSafe(WsServerEvent.X)`) — mỗi event mới phải sửa 3 nơi (2 enum + bridge).

#### ⚠️ MED-02 — broadcastSafe envelope — PARTIAL
- **Đã fix:** các commerce event payloads giờ đều typed (`OrderCreatedEventPayload`...) — `Record<string, unknown>` chỉ còn 2 chỗ cast không liên quan trong gateway.
- **Còn mở:** envelope của `broadcastSafe` (`realtime-event.dispatcher.ts:514-548`) chỉ chứa `{event, data}` — **thiếu `workspaceId` và `timestamp`** dù contract `WsEventPayload` (`schemas.ts:94-99`) khai báo cả hai. Gateway tự build envelope đúng trong path khác (`realtime.gateway.ts:220-231`) → internal inconsistency, đúng pattern contract-mismatch sẽ audit ở Task 4.2-04.

#### ⚠️ MED-04 — Query Keys Factory — PARTIAL (~80%)
`apps/web/src/lib/query-keys.ts` định nghĩa đầy đủ 13 factories; **37 files** import và dùng. Còn ~29 inline `queryKey: [` literals rải trong platform-admin hooks, `use-current-user.ts`, `['geo-provinces']` (address-cascader). Tiêu chí 100% (Task 4.2-05) chưa đạt.

#### ⚠️ MED-05 — UI hygiene — PARTIAL (WORSENED)
- **Đã fix:** direct `@radix-ui/*` imports ngoài `components/ui` = 0 (trừ LOW-02).
- **Tệ hơn:** raw `<button>` tăng **25 → 86 occurrences / 36 files** (top: `web-chat-preview.tsx` 11, `facebook-config.tsx` 4). Hardcoded colors ~67 (35 hex + 32 legacy palette; nhiều hex là brand colors Telegram/Facebook — cần verdict case-by-case).

#### ✅ MED-06 — vietnam-address singleton — FIXED
File đã bị xóa (commit `b142215`). Address data giờ qua React Query `staleTime: Infinity` trong `address-cascader.tsx:47-51` — đúng pattern mong muốn.

#### ❌ MED-07 — Facebook DTOs split — STILL OPEN
`shared-contracts` không có file facebook nào. `FacebookPageInfo` + `ConnectFacebookPagesBatchDto` bị định nghĩa **trùng lặp byte-for-byte** giữa `apps/server/.../facebook.dto.ts:21-48` và `apps/web/.../settings/inboxes/api/facebook.ts:3-16`. Webhook payload types chỉ tồn tại server-side (chấp nhận được, nhưng request/response DTOs là drift-prone).

#### ⚠️ MED-08 — Secondary queries workspaceId — PARTIAL
- **Đã fix:** `inboxes.service.ts` `removeMember` (renamed từ `deleteMember`) verify inbox ownership theo `workspaceId` (dòng 625-627) + `conversation.updateMany` có `workspaceId` (652-658).
- **Còn mở:** (1) `attachments.service.ts:deleteByMessageId` (dòng 250-268) — cả `findMany` lẫn `deleteMany` đều chỉ where `messageId`, method thậm chí không nhận `workspaceId` (caller `messages.service.ts:576` có verify trước, nhưng defense-in-depth gap); (2) `auto-assignment.service.ts:165-168` — `inboxMember.findMany` + `teamMember.findMany` chỉ where `inboxId`/`teamId` dù `workspaceId` có trong scope.

#### ✅ MED-09 — Inventory locking — FIXED
Không dùng `SELECT ... FOR UPDATE` nhưng có dạng mạnh tương đương: mọi stock mutation là **single-statement conditional UPDATE** (`$executeRaw` với guard `("stockQuantity" - "reservedQuantity") >= qty`) chạy bên trong interactive transaction (`prisma.runInTransaction`); `count === 0` → throw `INSUFFICIENT_STOCK`. `previousStock` cho ledger được snapshot SAU atomic update. Deadlock tránh bằng sort items theo `variantId` (dòng 199, 333, 474, 579). Không còn check-then-act window.

#### ❌ LOW-01 — Queue constants leak — STILL OPEN
3 constants queue-name trong shared-contracts: `COMMERCE_RECONCILIATION_QUEUE` (`commerce/enums.ts:77`), `AI_AUTOPILOT_QUEUE` (`intelligence/index.ts:4`), `COMMENT_GUARD_QUEUE` (`omnichannel/inboxes/schemas.ts:62`). Mỗi cái bị lock bởi spec test — cần dọn cả test khi di chuyển. Không có import bullmq trực tiếp.

#### ❌ LOW-02 — Radix bypass lightbox — STILL OPEN
`image-lightbox-dialog.tsx:4` import `{ Dialog as DialogPrimitive } from 'radix-ui'` và compose primitives trực tiếp (Root/Portal/Overlay/Content/Title) bypass shadcn `components/ui/dialog.tsx`. Form import đổi từ `@radix-ui/react-dialog` sang barrel `radix-ui` nhưng substance không đổi. Là file duy nhất ngoài `components/ui` import radix trực tiếp.

#### ❌ LOW-03 — Phone regex divergence — STILL OPEN
3 chuẩn tồn tại song song: Contacts yêu cầu E.164 strict `^\+[1-9]\d{1,14}$` (`omnichannel/contacts/schemas.ts:11,127`); Orders dùng `VIETNAMESE_PHONE_REGEX` `(?:\+84|0)...` (`common/phone.ts:4`, áp cho `shippingAddressInputSchema.phoneNumber`); `recipientPhone` ở `createOrderSchema/updateOrderSchema` (order.schemas.ts:91,113) **không validate gì cả**. Contacts reject `0987654321` trong khi Orders chấp nhận.

#### ❌ LOW-04 — Loose union types — STILL OPEN
`number | string` vẫn ở 16 fields response DTO (orders: subtotal/discountAmount/shippingFee/taxAmount/totalAmount/paidAmount, unitPrice/costPrice/totalPrice; products: basePrice/costPrice ×2; payments: totalAmount/paidAmount/amount). `any[]` vẫn ở `OrderResponseDto.paymentTransactions`/`inventoryTransactions` (order.schemas.ts:204-205). Service layer có convert `Number(...)` lúc serialize (`formatOrder`) nhưng contract types vẫn loose.

---

## 3. Risk Heatmap — Ưu tiên cho M4.1–M4.3

| # | Khu vực | Risk | Findings | Lý do ưu tiên | Milestone đón nhận |
|:--|---------|:----:|:---------|----------------|:------------------:|
| 1 | **God Services — Commerce/Inventory/Reconciliation/Conversations** | 🔴 | HIGH-08 | Tập trung toàn bộ money-path logic; số lượng tăng 16→21, các service chính phình thêm 100+ LOC mỗi cái. Mọi bug hunt (M4.2) đều đắt đỏ trên các file 1000+ LOC | M4.2 (Task 4.2-05 split đề xuất) |
| 2 | **Realtime layer — enum duplication + envelope mismatch** | 🔴 | MED-01, MED-02 | `WsEventPayload` contract khai báo `workspaceId`/`timestamp` nhưng dispatcher không emit → frontend consumer không dựa được envelope; dual enum + manual bridge là nguồn drift dài hạn; mỗi event mới sửa 3 nơi | M4.2 (Task 4.2-04 #5, #7) |
| 3 | **Multi-tenancy secondary queries** | 🟠 | MED-08 | `deleteByMessageId` và auto-assignment member queries thiếu `workspaceId` — defense-in-depth gap, đúng scope Task 4.3-01 sẽ grep toàn bộ | M4.3 (Task 4.3-01) |
| 4 | **Backend route consistency (dual routing)** | 🟠 | HIGH-10 | 6 dual-routed vs 12 header-only controllers — API surface không nhất quán, ảnh hưởng docs + client generation | M4.2 (Task 4.2-05) |
| 5 | **Frontend UI hygiene** | 🟡 | MED-05, MED-04 (phần còn lại), LOW-02 | Raw buttons 25→86 (tăng nhanh — cần chặn sớm trước khi phình tiếp); query-keys còn ~29 inline; 1 radix bypass | M4.1/M4.2 |
| 6 | **Contract hygiene — DTOs & duplication** | 🟡 | MED-07, LOW-03, LOW-04, LOW-01, MED-02 (payload) | Facebook DTO trùng lặp byte-for-byte; phone 3 chuẩn; `number\|string`/`any[]` 18 fields; 3 queue constants. Blast radius thấp nhưng là nợ tích lũy | M4.2/M4.3 |
| 7 | **CI health** | 🟢 | — | 0/0/0 sạch, 1452 tests không skip — baseline lý tưởng | Giữ nguyên |

### Điểm nhấn cho triage

1. **Xu hướng đáng lo nhất: HIGH-08 và MED-05 đang tệ LÊN** giữa 2 lần audit (god services 16→21, raw buttons 25→86). Đây là entropy tăng — cần can thiệp có chủ đích chứ không chỉ dọn 1 lần.
2. **Money-path đã vững:** cả 4 findings tiền bạc (HIGH-01, HIGH-02, HIGH-04, MED-09) đều đã fix đúng cách — null hypothesis cho M4.2 Task 4.2-01 (Commerce audit) có điểm tựa tốt.
3. **Quick wins cho M4.1:** LOW-01 (3 constants + tests), LOW-02 (1 file), MED-07 (move 2 interfaces vào shared-contracts), phần còn lại của MED-04 (~29 inline keys) — đều là thay đổi cơ học, rủi ro thấp.
4. **Cần quyết định kiến trúc trong M4.2:** (a) merge `DomainEvent`/`WsServerEvent` thành 1, (b) thống nhất dual routing áp hết hay bỏ hết, (c) chuẩn phone duy nhất cho toàn hệ.

---

## 4. Trạng thái nghiệm thu M4.0

- [x] CI baseline report với số liệu cụ thể (0 lint errors/warnings, 0 type errors, 1452/1452 tests pass, 0 skip)
- [x] 17 prior findings đánh dấu trạng thái: 5 ✅ Fixed / 4 ⚠️ Partial / 8 ❌ Still Open
- [x] Git tag `audit-v3-baseline` đã tạo tại commit `b86b186`
- [x] Không thay đổi code (chỉ tạo report + tag)
