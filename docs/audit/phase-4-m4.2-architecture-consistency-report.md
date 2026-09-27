# Phase 4 — Milestone 4.2: Architecture Consistency Report

> **Ngày:** 2026-09-28
> **Branch:** `audit/m4.2-bugs-and-architecture`
> **Phạm vi:** TASK-4.2-05 — Backend patterns (AGENTS.md), Frontend patterns, Cross-layer consistency
> **Kết quả tức thì:** 2 violations pattern đơn giản đã fix luôn (raw enum literals — xem Bug Report F7); còn lại là quyết định kiến trúc → báo cáo kèm đề xuất.

---

## 1. Backend — Skinny Controller, Rich Service

### 1.1. Violations

| Severity | Vị trí | Vi phạm | Evidence |
|----------|--------|---------|----------|
| HIGH | `omnichannel/integrations/facebook/facebook.controller.ts:60, 360-476` | Inject `@InjectQueue(COMMENT_GUARD_QUEUE)` + webhook fan-out loop, dedup check, đọc `channelSettings.commentGuard?.enabled`, enqueue — toàn bộ trong controller | `for (const entry of body.entry) { for (const change of entry.changes) { ... await this.commentGuardQueue.add(...)` |
| HIGH | `commerce/webhooks/payment-webhooks.controller.ts:38, 55-114` | Inject reconciliation queue + payload normalization (`for (const item of items)`, `transferType === 'out'` branching, amount validation) trong controller — trên money path | `@InjectQueue(COMMERCE_RECONCILIATION_QUEUE)` |
| MED | `omnichannel/messages/messages.controller.ts:91-126` | `@Body() body: any` + manual `JSON.parse` + `'true'` coercion + inline `createMessageSchema.parse()` thay vì `@ZodBody` | multipart upload path |
| MED | `omnichannel/integrations/web-chat/web-chat.controller.ts:71, 320` | `fs.existsSync` file resolution + credential decrypt (split `':'`) trong controller | widget SDK serve path |
| MED | `realtime/presence.controller.ts:60` | Tự implement membership check (`verifyWorkspaceMembership` + `ForbiddenException`) thay vì `@UseGuards(WorkspaceGuard, RolesGuard)` như mọi workspace controller khác | convention ngoại lệ |

**Đề xuất:** extract `FacebookWebhookProcessor` service (fan-out/dedup/enqueue); chuyển enqueue + normalize vào reconciliation service; messages controller dùng `@ZodBody`. Tất cả là refactor cơ học, không đổi behavior — đề xuất gom làm 1 PR riêng sau M4.2 để review dễ.

### 1.2. VERIFIED-OK
- **0/30 controllers inject PrismaService** (grep toàn bộ) — rule tuân thủ 100%.
- Các controller orders/conversations/contacts/teams/products/labels/inboxes/knowledge là skinny đúng chuẩn: 1 service injection, `@ZodBody`/`@ZodQuery`, `@Roles` per route.

## 2. God Services (≥300 LOC) — 20 services

| # | LOC | Service | | # | LOC | Service |
|--:|----:|---------|---|--:|----:|---------|
| 1 | 1291 | commerce/orders/orders.service.ts | | 11 | 612 | commerce/products/products.service.ts |
| 2 | 1056 | commerce/inventory/inventory-ledger.service.ts | | 12 | 464 | platform-admin/workspaces/platform-workspaces.service.ts |
| 3 | 963 | commerce/reconciliation/payment-reconciliation.service.ts | | 13 | 419 | omnichannel/messages/attachments.service.ts |
| 4 | 911 | omnichannel/conversations/conversations.service.ts | | 14 | 400 | intelligence/knowledge/knowledge.service.ts |
| 5 | 870 | omnichannel/contacts/contacts.service.ts | | 15 | 382 | platform-admin/settings/system-settings.service.ts |
| 6 | 770 | identity/workspaces/workspaces.service.ts | | 16 | 381 | identity/teams/teams.service.ts |
| 7 | 731 | omnichannel/inboxes/inboxes.service.ts | | 17 | 372 | identity/auth/auth.service.ts |
| 8 | 721 | omnichannel/messages/messages.service.ts | | 18 | 355 | realtime/presence.service.ts |
| 9 | 676 | omnichannel/integrations/facebook/facebook.service.ts | | 19 | 338 | identity/audit-logs/audit-logs.service.ts |
| 10 | 654 | omnichannel/contacts/contact-resolution.service.ts | | 20 | 316 | identity/auth/token.service.ts |

*(M4.0 đo 21 — số hiện tại sau M4.1; xu hướng vẫn tăng giữa 2 audits.)*

### Đề xuất split Top-3 (money core)

**`orders.service.ts` (1291 — 8 public methods, state machine chiếm chủ đạo):**
- `OrderLifecycleService` — confirmOrder (87) + payOrder (197) + cancelOrder (134) + completeOrder (164) ≈ 580 LOC
- `OrderWriterService` — createOrder (242) + updateOrder (222)
- `OrderQueryService` — listOrders + getOrderById ≈ 180 LOC

**`inventory-ledger.service.ts` (1056 — 5 movement methods lặp lại scaffold `$transaction` + ledger insert + event dispatch):**
- `StockMovementService` — reserve/commit/release/restock/adjust
- `InventoryQueryService` — getStock, listTransactions, listInventoryVariants, getInventorySummary
- 1 private helper `runMovementTx()` để xóa 5x transaction boilerplate

**`payment-reconciliation.service.ts` (963 — `reconcileTransaction` một mình ~452 LOC):**
- `AutoReconciliationMatcher` — parse → fingerprint → match strategy (phù hợp yêu cầu Strategy Pattern cho đa gateway theo AGENTS.md)
- `ManualMatchService` — manualMatchTransaction (~263 LOC)
- `ReconciliationQueryService` — listTransactions + getStats ≈ 190 LOC

> **KHÔNG tự refactor trong M4.2** (nguyên tắc milestone): split service money-path cần di chuyển cẩn trọng + test riêng. Đề xuất thành milestone riêng hoặc gắn M4.3 sau schema audit.

### Module structure — VERIFIED-OK (20/20 leaf modules có module.ts + controller.ts + service.ts)
Ngoại lệ nhỏ (LOW): 4 leaf `platform-admin/*` không có module.ts riêng (wired tập trung — chấp nhận được); `commerce/webhooks` chỉ có controller (delegate queue).

## 3. Dual Routing (HIGH-10 re-verify — vẫn mở)

- **Nhóm A — dual route** `['workspaces/:workspaceId/x', 'x']` (6): inventory, orders, products, reconciliation, dashboard, knowledge.
- **Nhóm B — short route + header** (18): conversations, contacts, messages, inboxes, inbox-members, labels, canned-responses, teams, workspaces, workspace-members, audit-logs, link-preview, facebook, web-chat, channel-webhooks, platform-admin ×4.
- **Nhóm C — full-path only** (3): vietqr, payment-webhooks, presence.
- **HIGH:** FE đang dùng CẢ HAI convention: `orders.ts:48` gọi `/workspaces/${id}/orders`, `contacts.ts:15` gọi `/contacts`.

**Đề xuất:** chuẩn hóa về short + header (nhóm đa số 18) — collapse nhóm A thành 1 PR mechanical + update FE orders/inventory/products/reconciliation/dashboard/knowledge API base. Quyết định kiến trúc → cần approve.

## 4. Frontend

### 4.1. useEffect fetch — VERIFIED-OK: 0 violations thật
Tất cả useEffect đều là debounce/state-sync/keyboard listener. `fetch(` duy nhất ngoài api-client là blob download trong click handler (hợp lệ).

### 4.2. Query Keys Factory adoption — **46%** (M4.0 đo ~80% theo cách đếm khác; đếm chuẩn theo file: 37 files dùng factory vs 43 files inline literal)

| Khu vực inline | Files |
|----------------|-------|
| `lib/socket/use-realtime-sync.ts` (nghĩa trọng nhất — cache invalidation) | 10 inline literals, hoạt động nhờ string prefix trùng factory |
| `features/platform-admin/**` (6 hooks) | factory cho domain này **chưa tồn tại** trong query-keys.ts |
| `features/settings/**` | 11 |
| `features/commerce/**`, `conversations/**`, `contacts/**`, auth/dashboard | 21 |

**Plan lên 100% (3 bước):**
1. Thêm factories còn thiếu vào `lib/query-keys.ts`: `platformAdminKeys` (audit-logs, metrics, settings, workspaces), `settingsKeys` (knowledge, teams, inboxes, members), `authKeys`.
2. Thay 10 inline literals trong `use-realtime-sync.ts` bằng factories (rủi ro cao nhất — invalidation lệch key là bug im lặng).
3. Sweeping thay thế 33 files inline còn lại (mechanical, typecheck + runtime guard).

### 4.3. Raw HTML / Radix
- `<button>`: 86 occurrences / 36 files (top: conversation-filter-popover 24, web-chat-preview 11, facebook-config 4, inventory-view 4) — tăng so 25 (M4.0) dù M4.1 dọn; cần rule ESLint chặn `<button>` ngoài components/ui.
- `<input>`: 14 / 6 files.
- Direct Radix: chỉ còn `image-lightbox-dialog.tsx:4` (LOW-02 re-verify — vẫn mở).

### 4.4. Layouts — VERIFIED-OK: 8/8 layout.tsx đều Server Components (0 `'use client'`).

### 4.5. API centralization
- MED: `features/auth/actions/auth-actions.ts` — 6 raw `fetch` trong server actions bypass `fetchApi` (duplicate cookie/error handling).
- LOW: 3 RSC pages (`app/page.tsx`, `[workspaceSlug]/page.tsx`, `dashboard/page.tsx`) gọi raw fetch thay vì server-compatible `fetchApi`.
- VERIFIED-OK: 25 files dùng `fetchApi`; không có fetch API thật nào ngoài 2 nhóm trên.

## 5. Cross-layer

### 5.1. Socket events — 37 emit (server) vs 26 listen (FE)
- **MED — 11 events emit không ai nghe:** CHANNEL_IDENTITY_CREATED/DELETED, CHANNEL_CREATED/UPDATED/DELETED, CONTACT_CREATED/DELETED/MERGED, LABEL_CREATED/UPDATED/DELETED (`realtime-event.dispatcher.ts:222-338`) — chi phí fan-out không cần thiết. Fix: trim dispatcher HOẶC wire FE listener (chọn theo nhu cầu UX).
- **MED — FE nghe event không tồn tại:** `use-realtime-sync.ts:311` listen `CONVERSATION_STATUS_CHANGED` nhưng server chỉ emit `CONVERSATION_STATUS_UPDATED` (dead enum twin `conversation.status_changed` trong shared-contracts `schemas.ts:11` — xóa member này ở M4.3).
- **MED — `'workspace_suspended'` raw string** (`realtime.gateway.ts:387`): không FE listener → suspended workspace user không bị kick realtime. Fix: thêm vào WsServerEvent + FE listener.

### 5.2. Role guards ↔ FE — VERIFIED-OK (consistency tốt)
Dashboard/audit-logs/members/teams/labels/canned-responses khớp cả 2 phía. 2 lệch hướng an toàn: `workspace-members.controller` cho AGENT xem list trong khi FE members page là OWNER/ADMIN (permissive hơn phía BE — harmless); `presence.controller` là controller workspace duy nhất không theo convention `@UseGuards` (LOW).

### 5.3. Zod schema coverage — VERIFIED-OK: 12/12 mutation endpoints sampled đều validate qua schemas từ shared-contracts (`@ZodBody`). Điểm lệch pattern duy nhất: messages controller multipart (inline parse) — xem §1.1. 106 server files import shared-contracts; 0 `z.object` inline trong controllers.

---

## 6. Tổng kết & đề xuất thứ tự xử lý

| # | Việc | Mức | Ghi chú |
|---|------|-----|---------|
| 1 | Extract webhook logic khỏi 2 controllers | HIGH | mechanical refactor, 1 PR |
| 2 | Chuẩn hóa routing (collapse nhóm A → short+header) | HIGH | quyết định hướng + PR mechanical |
| 3 | Query keys lên 100% (3 bước §4.2) | MED | bước 2 là ưu tiên rủi ro cao nhất |
| 4 | Trim/wire 11 dead socket events + workspace_suspended | MED | kèm xóa enum twin ở M4.3 |
| 5 | God Services split Top-3 | HIGH | milestone riêng, có test bảo vệ |
| 6 | ESLint rule chặn raw `<button>` + Radix ngoài ui/ | LOW | chặn entropy (tăng 25→86 giữa 2 audits) |
| 7 | `auth-actions` về `fetchApi` + fix bare catch | MED | kèm Bug Report E3 |
