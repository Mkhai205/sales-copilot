# Phase 4 — M4.4 Remediation: Implement Audit Findings (Fix · Refactor · Clean)

> **Ngày:** 2026-09-28
> **Branch:** `audit/m4.4-remediation` (từ `main` @ `5e44b9d`)
> **Scope:** Triển khai các findings còn lại từ 4 reports của Phase 4 (M4.1–M4.3), theo ưu tiên money-path → security → schema → performance → refactor.
> **Gate mỗi wave: `pnpm lint` + `pnpm typecheck` + `pnpm test:all` — cuối milestone: 0/0/0, **1473 pass / 0 fail / 0 skip** (từ 1459, +14 regression tests).

---

## 1. Đã áp dụng

### 1.1. Money path (M4.2 Bug Report C1/C2/C3/C6)

| Fix | Nội dung | Test |
|-----|----------|------|
| **C1** — lost update race | `RedisModule` inject vào OrdersModule (lock của payOrder từ dead code thành live); **thống nhất 1 lock key** `ws:{ws}:order:{id}:payment` cho cả 3 flow (payOrder / reconcile / manualMatch); conditional predicate `status: { in: [DRAFT, CONFIRMED] }` trên mọi full/partial payment update + throw 409 `PAYMENT_STATE_CONFLICT` khi count=0. Already-PAID orders được route qua predicate `[PAID]` riêng (second/over-payment vẫn ghi nhận — giữ behavior có test che) | spec predicate + conflict |
| **C2** — manualMatch guard | Mirror guard SHIPPING/COMPLETED từ reconcileTransaction: ghi payment, không commitStock, không regression status | regression test COMPLETED order |
| **C3** — line-item discounts | `lineDiscountsTotal` fold vào effective order discount (clamp [0, subtotal]); update path trừ existing line discounts trước khi re-fold để không double-count; bất biến `sum(line.totalPrice) = total − shipping` | calculator tests |
| **C6** — cancelOrder race | Predicate `status in [DRAFT, CONFIRMED, PAID, SHIPPING]` (mirror assertCanCancel) + conflict throw | spec |

### 1.2. Message pipeline & AI (M4.2 O1, A1, A3, A4, A-bonus)

| Fix | Nội dung |
|-----|----------|
| **O1** — message loss | `channel-ingestion.processor`: thu thập per-message failures → ChannelEvent **không** mark processed + job **throw** để BullMQ retry (idempotent nhờ Message/ChannelEvent unique). Parse-fail không tạo được message → fail job. Real-mid receipt không tìm thấy → retryable; synthetic `watermark_*`/`read_*` → skip như cũ |
| **A1** — AI takeover dead code | `onStepFinish` throw (bị SDK `notify()` swallow) → **custom async `stopWhen`** (SDK await) check `isAiPaused` fresh từ DB mỗi step + belt-and-suspenders guard trong tool execute (registry) → loop dừng thật, reply bị discard, không reply sau takeover |
| **A3** — rate limit fail-open | Guardrail fail-CLOSED: Redis lỗi → `INFRA_UNAVAILABLE` (no reply, không đảm bảo UX nhưng không cấp AI miễn phí) |
| **A4** — non-atomic INCR/EXPIRE + fixed window | `RedisService.incrementSlidingWindow` — Lua ZADD/ZREMRANGEBYSCORE/ZCARD/PEXPIRE 1 script atomic, sliding window thật |
| **A-bonus** — debounce double-run | `RedisService.reserveIncreasingValue` — Lua `max(now, prev+1)` slot tăng nghiêm ngặt; 2 tin cùng millisecond không thể cùng stamp → worker drop check `>` giờ đóng race hoàn toàn |

### 1.3. Security (M4.3 §1.2 S4 + hardening)

- **S4**: 4 handlers commerce editing trên realtime gateway verify conversation tồn tại trong workspace + socket membership (`verifyCommerceEditingAccess`) trước khi cấp lock — chặn cross-tenant lock DoS (+111 dòng spec).
- Qúa trình Wave A cũng xác nhận + giữ các fix M4.3 (FB webhook fail-closed, widget token secret, refresh token hash verify, role re-sign...).

### 1.4. Schema (M4.3 Schema Report — migration `20260928192616_m44_schema_hardening`)

- **HNSW index** cho `KnowledgeArticle.embedding` (`vector_cosine_ops`, partial WHERE NOT NULL) — RAG query hết seq-scan.
- `@@unique([workspaceId, name])` cho Inbox (dev DB có 0 duplicates — verified trước khi apply).
- `@@index([workspaceId, action])` audit_logs; `@@index([workspaceId, fulfillmentStatus])` orders; drop unused `[workspaceId, paymentMethod]`.
- `KnowledgeEmbeddingStatus` import enum thay raw strings (service + processor, kể cả raw SQL interpolation).

### 1.5. Performance (M4.3 Perf Report)

- **Select projections big-4**: conversations (`CONVERSATION_STANDARD_SELECT` — exclude `channel.credentials` khỏi list rows), orders (exclude `rawWebhookPayload`), contacts (channel chỉ id/type/name), products (variants projection) — mapper-driven, DTO không đổi.
- **Queue retention**: `defaultJobOptions` global (`removeOnComplete {age 1h, count 500}`, `removeOnFail {age 7d, count 1000}`) + webhooks.service `removeOnFail: false` → bounded.
- **Deps removed**: `framer-motion` (404 page viết lại bằng Tailwind/tw-animate), `jsonwebtoken` (widget-token bắt buộc JwtService — `JwtModule.register({})` vào WebChatModule; jsonwebtoken fallback + dep xóa), Chatwoot compat shim `window.chatwootSDK` xóa khỏi widget-sdk + test-chat.html.
- **Query keys hot files**: 12 inline literals `['conversations','messages'|'detail']` → `conversationKeys.messages()/.detail()` (use-realtime-sync ×10, use-conversation-mutations, use-takeover-conversation).

### 1.6. Refactor

- **BYOK resolver dedupe**: `ai-provider.resolver.ts` — resolvePlatformGoogleAiProvider dùng chung bởi ai-agent.service + knowledge-embedding.service (trước đây copy-paste 30 LOC ×2).

---

## 2. Deferred — cần quyết định riêng (không phải kỹ thuật thuần)

| Item | Lý do defer |
|------|-------------|
| Write-only settings loops (announcements/maintenance tab ~270 LOC; feature.*/llm.* keys + 2 tab) | Product decision: wire settings vào behavior HOẶC xóa UI + keys |
| 31 internal barrels trong shared-contracts | Structural churn; chỉ 5 import sites prod — làm khi đụng contracts |
| God Services split (20 services ≥300 LOC; top-3 có proposal trong M4.2 Arch Report) | Dedicated refactor PR với test bảo vệ — không trộn với remediation |
| Dual-routing standardization (6 dual-route vs 18 short-route) | Quyết định hướng API + PR mechanical lớn |
| WS double-emit `'event'` stream + slim order payload | **E2E ws-client helper đang phụ thuộc generic stream**; `payload.order` đang được commerce-event.listener đọc (receipt message) — phải refactor e2e helper + listener trước |
| Controller webhook logic extraction (facebook fan-out, payment normalize) | Critical ingest path — PR riêng có review |
| ESLint rule chặn raw `<button>` (86 violations hiện hữu) | Cần design refactor các violation trước khi bật rule |
| formatDateTime dedupe ×8 components | Các component đang có format khác nhau nhẹ — unify là thay đổi visual cần approve |
| RSC-ify page shells, refetchOnWindowFocus tuning, raw img → next/image | Incremental lớn, làm theo lộ trình perf riêng |
| `pnpm.overrides` cho 13 transitive vulns (multer/mysql2/fast-uri/qs) | Cần regression build/test riêng |

---

## 3. Verification

| Gate | Kết quả |
|------|---------|
| `pnpm lint` | 0 errors / 0 warnings |
| `pnpm typecheck` | 0 errors / 5 projects |
| `pnpm test:all` | **1473 pass / 0 fail / 0 skip** (unit 98/1245 · integration 3/26 · e2e 8/202) |

Baseline Phase 4: 1452 → sau remediation: 1473 (+14 regression tests cho các fix money/AI/security; −net các test dead-code đã dọn ở M4.1).
