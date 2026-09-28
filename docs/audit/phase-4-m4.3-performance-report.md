# Phase 4 — Milestone 4.3: Performance & Dependencies Audit Report

> **Ngày:** 2026-09-28
> **Scope:** TASK-4.3-04 — Backend queries/queues/Redis/WS · Frontend bundle/boundaries/caching · Dependencies
> **1 fix đã áp dụng:** channel-ingestion processor concurrency (P1)

---

## 1. Backend

### 1.1. Queries không `select` (~190/~290 find calls load full rows, kể cả Json columns lớn)

| Sev | Hot path | Vị trí | Chi tiết | Impact |
|-----|----------|--------|----------|--------|
| HIGH | Conversations list | `conversations.service.ts:645` (`CONVERSATION_STANDARD_INCLUDE` :23-45) | Include contact(+identities+Json attrs), inbox→**channel (kéo `credentials` Json — secrets mã hóa vào mọi list row!)**, labels, last message | 30-60% payload/serial-CPU trên endpoint nóng nhất + khép secret-over-read |
| HIGH | Orders list | `orders.service.ts:1146` (cùng include ở 9 nơi khác) | Include full `items` + `paymentTransactions` (kéo `rawWebhookPayload` Json mỗi tx mỗi row) | Lớn trên orders page |
| HIGH | Contacts list | `contacts.service.ts:172` (+7 nơi) | `identities.include.channel` — full Channel row (credentials) per identity per contact | Lớn |
| MED | Products list | `products.service.ts:107` (+12) | `variants: true` (attributes Json) | Medium |
| MED | Messages list | `messages.service.ts:448` (+8) | Full rows (metadata Json), pagination 50 | Medium |
| MED | Webhook hot path | `channel-ingestion.processor.ts:129,221` | Full ChannelEvent (payload Json) + Channel | Medium — chạy per webhook |
| LOW | Auth hot path | `auth.service.ts:44,72,156,211,244,278,322` | 7 no-select finds (User/Workspace + settings Json) | Nhỏ nhưng rất nóng |

**Đề xuất:** thay `include` bằng `select` projection theo mapper cho big-4 list queries (conversations/orders/contacts/products) — ước tính 1-2 ngày, biggest DB win. VERIFIED-OK: không có include sâu >2 levels.

### 1.2. Queues (BullMQ)

| Sev | Finding | Vị trí | Fix |
|-----|---------|--------|-----|
| **HIGH** | `channel-ingestion` — queue ingest webhook chính — **không set concurrency (default = 1)**, mọi webhook xử lý tuần tự | `channel-ingestion.processor.ts:30` | ✅ **FIXED — `@Processor('channel-ingestion', { concurrency: 5 })`** |
| MED | `removeOnFail: false` giữ failed jobs vĩnh viễn (channel-ingestion, knowledge); nhiều add không set → default retain | `webhooks.service.ts:274`, `knowledge.service.ts:49` | `removeOnFail: { age: 7*24h, count: 1000 }` hoặc DLQ policy |
| LOW | Không có `defaultJobOptions` ở registerQueue — mỗi add tự lặp options, 1 sót = unbounded history | `queue.module.ts:51` + 5 registerQueue | Set default per queue: `removeOnComplete: { age: 3600, count: 500 }` |
| VERIFIED-OK | Concurrency đúng chỗ: reconciliation 5, ai-agent 5, knowledge 3; comment-guard có group limiter 180/hour; webhook dedup jobId deterministic + attempts 3 + backoff | — | — |

### 1.3. Redis — VERIFIED-OK toàn diện

Mọi `set()` đều có TTL (refresh tokens, OAuth state, AI debounce/abuse, link-preview); system-settings cache L1 30s + L2 1h có invalidation đúng khi update; rate-limit dùng incr+expire-on-first. LOW: `RedisService.set` cho phép gọi không TTL (footgun cho caller tương lai — khuyến nghị bắt buộc TTL); system-settings memCache không evict key đã xóa (negligible). MED: ThrottlerModule dùng **in-memory store** — rate limit per-instance khi horizontal scaling → plug Redis storage.

### 1.4. WebSocket payloads

| Sev | Finding | Vị trí | Đề xuất |
|-----|---------|--------|---------|
| MED | `broadcastSafe` emit **mỗi payload 2 lần/socket** — 1 kênh typed + 1 kênh generic `'event'` | `realtime-event.dispatcher.ts:523-527` | Opt-in generic stream per client hoặc drop (check FE consumers trước) |
| MED | `message.created` broadcast full enriched DTO (kèm attachments) đến CẢ `workspace_*` lẫn `conversation_*` (overlap) | `messages.service.ts:355`, `dispatcher.ts:58` | Slim DTO cho workspace room |
| MED | 6 order lifecycle events mang `order: Record<string, unknown>` = full order incl. items + transactions đến cả workspace room | `event-payloads.ts:158-200`, `orders.service.ts:255` | Slim `{orderId, displayId, status, total}` + client refetch detail |

VERIFIED-OK: Socket.io Redis pub/sub adapter cho horizontal scaling với in-memory fallback.

### 1.5. Memory leaks — VERIFIED-OK sạch

web-chat dedup Set có FIFO eviction cap 1000; 0 setInterval; mọi setTimeout có clearTimeout; không per-request listener; presence Redis-TTL + cron sweep; link-preview LRU TTL.

## 2. Frontend

| Sev | Finding | Chi tiết | Đề xuất |
|-----|---------|----------|---------|
| HIGH | **236/241 .tsx là `'use client'`** — 0 RSC data loading, mọi fetch client-side TanStack | page.tsx/layout.tsx chỉ là shell mount client views | RSC-ify dần conversations + orders lists (bắt đầu từ `message-thread.tsx` 965 dòng) |
| MED | Dead-weight deps client bundle | `framer-motion` 1 file (ghost-404-page-1.tsx 224 dòng), `@shadcn/react` 1 file (message-scroller.tsx), `qrcode.react` 1 file | Remove framer-motion (CSS anim), inline scroller, dynamic-import qr dialog — ~50-150KB gz |
| LOW | `radix-ui` unified barrel import ×23 files | ESM tree-shakeable nên chunk ổn; chỉ rủi ro side-effect retention | Chỉ đổi per-package nếu bundle analysis chỉ ra bloat |
| LOW | `next.config.ts` không có bundle analyzer; `images.remotePatterns: **` quá permissive | `next.config.ts:6-10` | Thêm analyzer + scope hostnames |
| LOW | 10 file raw `<img>` — 4 file load remote URL nên dùng `next/image` | contacts-table, contact-identities, workspace-header, message-thread-header | Chuyển dần; icon local giữ `<img>` được |
| LOW | `refetchOnWindowFocus: true` global | Refetch burst khi agent alt-tab thường xuyên | Tắt cho conversation/message hooks (đã có socket invalidation) |

VERIFIED-OK: TanStack defaults sane (staleTime 30s, retry 1); polling modest + background-gated (30s counts/metrics); emoji-picker dynamic import; date-fns named locale import; lucide named imports; chỉ 3 Context providers, SocketProvider memoize value; chưa cần virtualization (list render 1 page 20-100 rows).

## 3. Dependencies

- **Duplicates: 0** — lockfile có đúng 1 react@19.2.8, 1 date-fns@4.4.0, 1 zod@3.25.76; không lodash full.
- **pnpm audit: 13 vulnerabilities (9 high, 3 moderate, 1 low) — toàn bộ transitive, 0 direct dep:** mysql2 ≤3.23.0 (auth downgrade, via prisma), fast-uri ×4 (SSRF/host confusion, via AWS SDK chain), multer ×3+1 (DoS, via @nestjs/platform-express), qs ×2 (DoS, via express chain), DeepmergeTS (stack exhaustion, via pino-pretty). **Khuyến nghị:** `pnpm.overrides` cho multer ≥2.3.0, mysql2 ≥3.23.1, fast-uri latest — cần regression build/test, đề xuất PR riêng.
- **Ponytail leftovers xác nhận (M4.1):** framer-motion (1 file, ~1h), @shadcn/react (1 file, ~0.5-1h), jsonwebtoken (1 file — widget-token.service, ~0.5-1h swap sang @nestjs/jwt).
- **Outdated (dev tooling):** nx 23.1.1→23.2.1, eslint 10.8.1→10.11, prettier 3.9.6→3.9.9, typescript-eslint 8.67→8.70 — minor bumps an toàn, không gấp.

## 4. Top-5 performance wins (ranked)

1. **`select` projections cho big-4 list queries** (conversations/orders/contacts/products) — cắt Json-blob loading + khép secret-over-read surface (`Channel.credentials` vào list rows) — ~1-2 ngày.
2. **Slim WS broadcasts** — order events full-row → workspace room, message.created dual-room, double-emit generic stream — halve WS egress — ~1 ngày.
3. **Concurrency channel-ingestion** — ✅ đã fix; tiếp: `defaultJobOptions` retention cho 6 queues — ~2-4h.
4. **Drop framer-motion + @shadcn/react, dynamic-import qrcode.react** — client bundle cut với blast radius 3 files — ~2-3h.
5. **RSC-ify page shells** (conversations trước) — TTFB/FCP cho primary views — effort lớn, incremental.
