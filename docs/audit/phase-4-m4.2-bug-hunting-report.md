# Phase 4 — Milestone 4.2: Bug Hunting Report

> **Ngày:** 2026-09-28
> **Branch:** `audit/m4.2-bugs-and-architecture` (từ `main` @ `2921d12`)
> **Phạm vi:** TASK-4.2-01 Commerce · TASK-4.2-02 Omnichannel · TASK-4.2-03 AI Agent · TASK-4.2-04 Error Handling & Data Flow
> **Phương pháp:** 5 audit agents song song (đọc toàn bộ file đích + truy vết caller + verify framework internals trong node_modules) → **mọi finding CRITICAL/HIGH đều được verify bằng tay** trước khi ghi nhận. Auto-fix chỉ áp dụng cho bug rõ ràng/safe; money-path race/locking chỉ báo cáo.

**Tổng kết: 2 CRITICAL · 8 HIGH · 21 MED · 22 LOW đã ghi nhận · 8 fix đã áp dụng (mục §0)**

---

## 0. Đã fix trong milestone này (safe fixes, đã gate pass)

| # | Bug | Fix |
|---|-----|-----|
| F1 | **[CRITICAL] Duplicate `@OnEvent` registration — 8 handlers** (`commerce-event.listener.ts` ×5, `realtime-event.dispatcher.ts` ×3): mỗi handler bị decorate 2 lần — `@OnEvent(DomainEvent.ORDER_PAID)` + `@OnEvent('order.paid')` là **cùng một string** → @nestjs/event-emitter đăng ký 2 listener (1 metadata entry/decorator, loader không dedup — đã verify từ source của lib) → **mỗi order paid/confirmed/completed/cancelled/partially_paid post 2 activity messages trùng vào thread khách hàng**; contact events broadcast WS đôi. | Xóa 8 decorator string-literal (giữ `@OnEvent(DomainEvent.*)`), + regression spec `src/__tests__/event-listener-registration.spec.ts` quét metadata của 12 listener class, chặn cứng bug class này. |
| F2 | **[MED] Web-chat double-emit + double-registration**: `web-chat.adapter.ts` emit CẢ `widget.outbound_message` lẫn `widget:message` (cùng payload, liên tiếp); gateway đăng ký cả 2 → handler chạy 2 lần/outbound; chỉ được cứu bởi dedup Set tự vệ. | Adapter emit 1 event duy nhất (`widget:message`), xóa legacy decorator; giữ dedup Set như idempotency guard chống producer retry; cập nhật 2 specs. |
| F3 | **[HIGH] `ai-dispatcher.listener.ts` — 0 error handling** trên pipeline inbound→AI: guardrail/Prisma/Redis/queue lỗi nào cũng bị framework swallow silently, message khách hàng lặng lẽ không tới AI, không có dấu vết. | Wrap thân handler trong try/catch, log error kèm workspaceId/conversationId/messageId. |
| F4 | **[MED] `ai-takeover.listener.ts` — 2 handler không try/catch**: Redis outage → takeover không kích hoạt mà không ai biết. | Error boundary + log có context cho cả 2 handler. |
| F5 | **[MED] `address-parser.util.ts:39` — `loadPromise` không reset khi reject**: 1 lần load divisions thất bại → mọi call sau vĩnh viễn chờ cùng một promise đã reject → `extractShippingInfo` hỏng đến khi restart. | Reset `loadPromise = null` trong catch để call sau retry. |
| F6 | **[MED] Pagination meta drift**: `messages.service.ts` dùng `hasNextPage/hasPreviousPage` trong khi toàn bộ endpoints khác dùng `hasMore` — FE phải dual-read phòng thủ. | Thêm `hasMore` vào meta của messages (additive, contract `PaginationMeta` đã khai báo sẵn). |
| F7 | **[LOW] Raw enum literals** ở 3 components reconciliation (`'UNPAID'`, `'PENDING'`, `'SUCCESS'`...). | Import `OrderStatus`/`PaymentStatus`/`PaymentTransactionStatus` từ shared-contracts. |

---

## 1. TASK-4.2-01 — Commerce (money path)

### C1. [CRITICAL] payOrder ↔ reconcileTransaction lost update + double stock commit
`apps/server/src/modules/commerce/orders/orders.service.ts:617-621, 713` · `reconciliation/payment-reconciliation.service.ts:357`
- **Root cause:** 2 flow thanh toán dùng 2 lock domain khác nhau (`order:payment:{orderId}` vs `ws:{ws}:order:{id}:reconcile`) và lock của `payOrder` là **dead code** — `@Optional() redisService` không bao giờ được inject (OrdersModule chỉ import `DatabaseModule, AuthModule, WorkspacesModule, InventoryModule, MessagesModule`). Cả 2 flow đều `updateMany` **không có predicate** trạng thái (Read Committed) → concurrent manual-pay + bank-reconcile cùng đọc `paidAmount` cũ, last-write-wins nuốt 1 payment; nếu cả 2 thấy `isFullyPaid` → `commitStock` chạy 2 lần → **trừ kho kép**.
- **Impact:** mất tiền/kho trong kịch bản thanh toán song song (thực tế: khách chuyển khoản đúng lúc agent thu COD).
- **Suggested fix:** (1) inject RedisService (thêm RedisModule vào OrdersModule); (2) thống nhất 1 lock key per-order cho cả 2 flow; (3) thêm predicate điều kiện vào updateMany (`WHERE status IN ('DRAFT','CONFIRMED')`) hoặc `SELECT ... FOR UPDATE` trên order row; (4) re-read paidAmount trong transaction.
- **Verdict:** REPORT ONLY — race/locking (nguyên tắc milestone). Verify đã làm: confirmed `@Optional` + module imports + 2 lock keys.

### C2. [CRITICAL] manualMatchTransaction thiếu guard SHIPPING/COMPLETED
`payment-reconciliation.service.ts:777-820` (so với guard chuẩn tại `:236-244` của `reconcileTransaction`)
- **Root cause:** `wasAlreadyPaid` chỉ check `status === PAID`. Order **COMPLETED** (đã commit stock lúc complete) được manual-match sẽ: (1) `commitStock(isPreviouslyReserved: false)` lần 2 → **trừ kho vật lý kép**; (2) `targetOrderStatus = PAID` → **regression COMPLETED→PAID**. Auto-reconcile đã có guard đúng ("record payment without stock deduction or status regression") — manual match bị bỏ sót.
- **Suggested fix:** mirror guard của `reconcileTransaction` vào `manualMatchTransaction`: nếu status ∈ {SHIPPING, COMPLETED} → chỉ ghi paidAmount/paymentStatus, KHÔNG commitStock, KHÔNG đổi status; + regression test.
- **Verdict:** REPORT ONLY — money state machine (fix chuẩn có sẵn ở method kế bên để mirror).

### C3. [HIGH] Line-item discount không được cộng vào totalAmount
`orders.service.ts:129-155` · `orders-calculator.ts:62-79`
- **Root cause:** `discountAmount` per-line được store nhưng subtotal chỉ cộng `itemCalc.subtotal` (giá gốc); tổng đơn chỉ trừ order-level discount → `sum(line.totalPrice) ≠ totalAmount` khi có discount dòng → **VietQR/bank charge nhầm số chưa giảm**.
- **Suggested fix:** fold line discounts vào order discount (hoặc reject item-level discount nếu không phải feature).
- **Verdict:** REPORT ONLY — quyết định nghiệp vụ cần chọn 1 hướng.

### C4. [HIGH] updateOrder TOCTOU trên đơn đã PAID
`orders.service.ts:310-323, 486-489` — `assertCanUpdate` đọc DRAFT không lock, `updateMany` không predicate → concurrent reconcile flip sang PAID giữa read/write, tổng tiền đơn đã paid bị mutate. Fix: `WHERE status = 'DRAFT'` trong updateMany predicate. **REPORT ONLY.**

### C5. [MED] Webhook destination-account mismatch chỉ là warn
`commerce-reconciliation.processor.ts:192-206` — sai tài khoản đích vẫn reconcile theo displayId. Fix: reject/park PENDING. **REPORT ONLY** (nghiệp vụ có thể cố ý cho phép suffix-match).

### C6. [MED] cancelOrder race với reconcile
`orders.service.ts:864` — cancel không lock, `status: CANCELLED` vô điều kiện; đua với full-pay → PAID order đã restock, hoặc CANCELLED order bị commit stock. Fix: predicate trạng thái + lock chung với C1. **REPORT ONLY.**

### C7. [MED] releaseStock ledger snapshot lệch
`inventory-ledger.service.ts:481` — `variantBefore` đọc không lock trước UPDATE `GREATEST(0, reserved - qty)` vô điều kiện; concurrent commit giữa 2 statement → previousReserved/newReserved trong ledger (bất biến) sai. Stock vẫn an toàn (conditional update). Fix: đọc post-update row như reserveStock đã làm, hoặc RETURNING. **REPORT ONLY.**

### C8. [LOW] (5 items)
- Metadata JSON merge race trong updateOrder (`orders.service.ts:478`) — 2 update đồng thời mất field (kể cả paymentMethod). Fix: jsonb `||` merge phía SQL hoặc version check.
- payOrder không lock TTL ngang timeout tx (`processor.ts:240` 10s = tx timeout 10s).
- payOrder chấp nhận overpay lặng lẽ (không overpaidAmount event như reconcile) — `orders.service.ts:687`.
- Idempotency `manual:{orderId}` khóa mọi installment không-code tiếp theo — `orders.service.ts:648`.
- VietQR re-offer full amount cho đơn đã paid đủ — `vietqr.service.ts:240`.
- `OrderStatus.SHIPPING` không bao giờ được gán (không có endpoint fulfillment) — guard branches là dead states (liên quan backlog fulfillment, để quyết định sản phẩm).

### VERIFIED-OK (Commerce — bất biến đã xác nhận đúng)
- Reserve/commit stock là single atomic conditional UPDATE, không check-then-act; deadlock tránh bằng sort variantId; ledger ghi cùng tx với mutation; post-commit hooks không fire khi rollback.
- Idempotency reconcile: `@@unique([workspaceId, idempotencyKey])` + P2002 cả 3 tầng + jobId dedup.
- Calculator chặn mọi giá âm (clamp Math.max/min), DTO schema chặn qty/price/discount âm.
- VietQR NAPAS 247: tag order đúng, CRC-16/CCITT-FALSE match vector 0x29B1, amount integer, TLV UTF-8 byte length, GUID A000000727, QRIBFTTA.
- Tenant isolation đầy đủ trong 6 file commerce.

---

## 2. TASK-4.2-02 — Omnichannel

### O1. [HIGH] Inbound message loss — processor swallow per-message errors
`infrastructure/queue/channel-ingestion.processor.ts:384`
- **Root cause:** try/catch trong message loop chỉ log; job return success → BullMQ không retry, `ChannelEvent` bị mark processed → **tin nhắn khách mất vĩnh viễn** dù đã có sẵn attempts:3 + backoff 30s + dedup hoàn toàn an toàn để retry (ChannelEvent unique + Message unique [conversationId, externalId]).
- **Suggested fix:** thu thập failures, throw sau loop để job fail và BullMQ retry; chỉ mark processed khi không còn pending message.
- **Verdict:** REPORT ONLY (đổi retry semantics của ingestion pipeline — cần test cẩn thận, nhưng là fix ưu tiên #1 của Omnichannel).

### O2. [MED] Outbound fire-and-forget + optimistic SENT
`outbound-message.listener.ts:86-172` · `messages.service.ts:176-177`
- Outbound là in-process `@OnEvent` (không queue/retry); deliveryStatus ghi **SENT trước khi gọi provider**; crash giữa create và send → tin nhắn agent không bao giờ tới khách và không bao giờ FAILED.
- **Suggested fix:** đưa outbound vào BullMQ (đối xứng với inbound) hoặc lifecycle PENDING→SENT/FAILED + sweep job cho row stuck. REPORT ONLY (kiến trúc).

### O3. [MED] Telegram media không dùng được
`telegram.adapter.ts:315-397` — mọi photo/video/voice/document lưu raw `file_id` làm `fileUrl`; processor downloader chỉ chấp nhận `http(s)` → attachment Telegram không render được trong inbox. Fix: resolve `getFile` → URL/download trước khi persist. **REPORT.**

### O4. [MED] FB read-receipt bị dedup nuốt
`webhooks.service.ts:72` — receipt-only payload rơi xuống `entry[0].id` = **Page ID** → mọi read receipt sau đầu tiên bị coi là duplicate → READ status không bao giờ update. Fix: hash `read.watermark`+`seq` vào event id. **REPORT.**

### O5. [MED] All-agents-offline → conversation bỏ rơi
`auto-assignment.service.ts:198-200` — trả null, conversation OPEN không assign vĩnh viễn; không có trigger khi agent online lại (không listener presence) hay retry job. Fix: delayed job / presence hook re-assign. **REPORT.**

### O6. [MED] Events emit trong transaction
`contacts.service.ts:677` — `contact.merged`/`contact.updated` emit bên trong open tx → listener thấy uncommitted state, vẫn fire nếu tx rollback. Fix: collect + emit sau commit (như `contact-resolution.service.ts:634` đã làm đúng). **REPORT (hoặc fix M4.3).**

### O7. [LOW] (6 items)
- Conversation find-then-create không có unique constraint (`conversations.service.ts:517-557`) — concurrent first messages có thể tạo 2 thread.
- MED-08 re-verify: `auto-assignment.service.ts:165-168,178-181` vẫn thiếu workspaceId (defense-in-depth; risk thấp vì inbox/team đã validate) → gắn M4.3 Task 4.3-01.
- `findOrCreateIdentity` P2002 không re-sync contact (`contact-resolution.service.ts:538-545`).
- Auto-assignment lock TTL 3s < critical section — round-robin rotation có thể double-rotate.
- Unsupported content (poll/dice/template-only) → message bị drop hẳn (`messages.service.ts:139-144`).
- Adapter retry không nhất quán: Telegram retry 1 lần khi HTML parse fail; Facebook không retry, 429 ở sendMessage là FAILED vĩnh viễn.

### VERIFIED-OK (Omnichannel)
- Webhook idempotency 3 tầng: `ChannelEvent @@unique([channelId, externalEventId])` + pre-check + P2002 recovery; `Message @@unique([conversationId, externalId])`; `ChannelIdentity @@unique`.
- Concurrent webhooks cùng customer mới: P2002 loser trả về contact của winner, tx rollback — không duplicate contact.
- Merge contact transactional hoàn toàn (identities/conversations/orders/messages re-point, không orphan — FK Restrict được di chuyển trước khi delete).
- Facebook signature verify timing-safe; echo filter chống double-ingest.
- 3 adapters cùng contract, self-register, processor không special-case theo type.

---

## 3. TASK-4.2-03 — AI Agent

### A1. [CRITICAL] Human takeover abort là dead code — AI vẫn reply sau khi human takeover
`ai-agent/ai-agent.service.ts:178-183`
- **Root cause:** `HumanTakeoverAbortError` throw trong `onStepFinish` — AI SDK v7 gọi `onStepFinish` qua `notify()` với **bare `catch (e) {}`** (đã verify `ai/dist/index.js:2807-2815`) → exception nuốt sạch, loop chạy tiếp đến `stepCountIs(10)`, tools (createDraftOrder/confirmQR/escalate) vẫn execute, worker vẫn gửi reply cuối → **khách nhận cả tin human lẫn tin AI**.
- **Suggested fix:** chuyển check `isAiPaused` sang custom `stopWhen` (SDK await condition) và/hoặc re-check trong wrapper `execute` của mỗi tool. REPORT ONLY (refactor loop SDK).

### A2. [HIGH] Không có generation lock per-conversation
`ai-agent.worker.ts:50-92` + `ai-dispatcher.listener.ts:123-129` — debounce chỉ chặn lúc enqueue; job đang chạy không bị cancel; `latestTimestamp > scheduledAt` cho phép 2 job cùng-ms chạy song song → **2 AI reply trùng / duplicate draft orders**. Fix: Redis `SET NX PX` lock per-conversation tại job start + `>=` trong debounce check. REPORT.

### A3. [HIGH] Rate limit fail-OPEN khi Redis chết
`ai-guardrail.service.ts:128-163` (+ Tier B abuse :88-125) — `RedisService.incr` trả 0 khi lỗi (không throw) + outer catch swallow → Redis outage = **unbounded AI usage/cost**. Fix: fail-closed hoặc circuit breaker. REPORT.

### A4. [HIGH] INCR/EXPIRE non-atomic + fixed window
`ai-guardrail.service.ts:130-134` — crash giữa incr và expire → key không TTL → conversation bị rate-limit **vĩnh viễn** sau 5 tin đời đời; fixed window cho phép burst 2x qua biên phút; không phải sliding window như thiết kế. Fix: Lua script / ZADD sliding window. REPORT.

### A5. [MED] Prompt injection không có cấu trúc
`ai-context.builder.ts:45,100-116` + `extract-shipping-info.tool.ts:119-153` — customer content nhúng raw, không delimiter; `sanitize` chỉ strip `<>`; Tier-2 `generateObject` output (do khách kiểm soát) re-enter loop không giới hạn. Impact giới hạn bởi workspace-scoped tools + DiscountGuard fail-closed, nhưng có thể kích hoạt order/QR thật trong policy. Fix: delimiter + "data not instructions" + truncate tool output. REPORT.

### A6. [MED] Guardrail reply gửi trước check `aiPolicy.enabled`
`ai-dispatcher.listener.ts:67-92` — inbox KHÔNG bật AI vẫn nhận auto-reply "vui lòng chờ" từ guardrail (BLACKLISTED/RATE_LIMITED). Fix: check policy trước guardrail side-effect. REPORT (đã thêm error boundary — F3 — nhưng không đổi flow nghiệp vụ này).

### A7. [MED] Empty final text → khách bị bỏ lửng
`ai-agent.worker.ts:95-96` — `generateText` kết thúc không text (hết 10 steps sau tool calls) → không gửi gì, không fallback (fallback chỉ trên exception). Fix: treat empty text như failure. REPORT.

### A8. [LOW] (7 items)
- `create-draft-order.tool.ts:57` — `shippingFee` LLM-supplied không có upper bound (chỉ discount được verify DB).
- `confirm-and-generate-qr.tool.ts:41` — confirm bất kỳ order nào trong workspace (thiếu scope conversationId).
- Usage rollup RMW không atomic (`ai-agent.worker.ts:110-147`).
- `generateText` không timeout/abortSignal/maxOutputTokens (`ai-agent.service.ts:161`).
- `escalate-to-human` set `isAiPaused` SAU khi gửi farewell (LLM có thể emit thêm 1 reply).
- `ai-tool-summarizer` 3 key mismatch (log-only): `inStock`→`isInStock`, `confidenceScore`→`confidence`, searchKnowledge shape.
- Spam threshold off-by-one (`length < 2`).

### VERIFIED-OK (AI)
- **DiscountGuard fail-CLOSED** (thiếu policy → approved:false) và LLM không được tin giá: subtotal recompute từ DB prices, discount re-check với guard (`create-draft-order.tool.ts:141-172`).
- workspaceId inject qua closure, không expose trong tool schemas; mọi Prisma read của tools workspace-scoped.
- Tool errors không crash agent (AI SDK converts to tool-error results + mọi tool tự try/catch); input schema parsed trước execute.
- Fallback chỉ fire lần cuối retry (verified BullMQ 6.2.0 attemptsMade semantics) — không double-reply.
- Queue-time check `isAiPaused` + status; takeover listener workspace-scoped.
- Tier-2 LLM có AbortSignal.timeout(5000) + graceful fallback.

---

## 4. TASK-4.2-04 — Error Handling & Data Flow

### E1. [HIGH] Listeners thiếu error boundary (sau F3/F4 còn lại)
- `outbound-message.listener.ts:111,146,161` — các await DB nằm NGOÀI try (chỉ adapter send được guard) → delivery failure có thể để message kẹt trạng thái stale. REPORT (kèm O2).
- `facebook.lifecycle.ts:299-366` (handleAuthorizationError), `facebook.lifecycle.ts:136,165,239`, `telegram.lifecycle.ts:86,131,154,271` — DB/Redis awaits không guard. REPORT.
- `presence.service.ts:320-340` — 2 @OnEvent presence không guard (thấp). REPORT.

### E2. [MED] decryptCredentials swallow → `{}` im lặng
4 files (`outbound-message.listener.ts:69`, `facebook.lifecycle.ts:44`, `telegram.lifecycle.ts:31`, `channel-ingestion.processor.ts:57`) — decrypt fail trả `{}` → outbound fail sau đó với lỗi auth mờ nhạt, mất root cause. Fix gợi ý: đánh dấu channel `isConnected:false` / `reauthorization_required`. REPORT.

### E3. [MED] FE auth bare catch
`auth-actions.ts:248-250,298-300` — `catch { return null }` không log: network glitch vs token revoked indistinguishable. (Khác với các catch hợp lệ đã whitelist trong VERIFIED-OK.)

### Framework context (verified): `@nestjs/event-emitter` wrap mọi handler trong try/catch + suppressErrors → **không có unhandled rejection** từ listeners; rủi ro thực là **silent swallow** (đã liệt kê). BullMQ processors capture rejection → job fail/retry đúng.

### VERIFIED-OK (Data flow)
- TransformInterceptor envelope `{success, data, meta?}` ↔ FE `ApiResponse` khớp (meta top-level, Decimal đã convert ở service).
- Zod ↔ Prisma drift: **0 drift thật** — Order/PaymentTransaction/Product/Variant/Contact/Conversation/Message DTO khớp field-for-field (nullable flags khớp; các field computed có comment).
- Enums: toàn bộ mirror shared-contracts ↔ Prisma value-for-value.
- Pagination: 7/8 endpoints nhất quán `{page,limit,total,totalPages,hasMore}` (drift messages đã fix F6).

---

## 5. Danh sách fix priority cho M4.2.5/M4.3 (đề xuất)

1. **C2** manualMatch guard (money, patch sẵn có để mirror) — nhanh nhất, tiền.
2. **C1** unify payment lock + conditional updateMany (money race).
3. **O1** ingestion processor fail-job để retry (message loss).
4. **A1** takeover stopWhen (customer-facing double reply).
5. **A3/A4** rate-limit fail-closed + atomic sliding window (cost control).
6. **C3** line-item discount vào totalAmount (charge đúng số tiền).
