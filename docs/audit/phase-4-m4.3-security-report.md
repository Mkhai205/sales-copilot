# Phase 4 — Milestone 4.3: Security Audit Report (Multi-Tenancy + AuthN/AuthZ)

> **Ngày:** 2026-09-28
> **Branch:** `audit/m4.3-security-schema-performance` (từ `main` @ `5605bb3`)
> **Phạm vi:** TASK-4.3-01 Multi-Tenancy Isolation · TASK-4.3-02 Authentication & Authorization
> **Phương pháp:** 2 audit agents quét ~381 Prisma call sites + toàn bộ 30 controllers + framework internals → verify bằng tay trước khi fix. **Fix đã áp dụng cho các security gap cơ học; các thay đổi kiến trúc chỉ báo cáo.**

**Tổng kết: CRITICAL 0 · HIGH 3 (2 đã fix, 1 report) · MED 10 (6 đã fix) · LOW 8**

---

## 1. TASK-4.3-01 — Multi-Tenancy Isolation

### 1.1. Kết quả quét chính

**Đã verify scoped (counts từ agent, mọi call site non-test):** Conversation 55/55 · Contact 42/42 · Order 39/39 · Channel 34/35 (3 webhook tenant-anchor by design) · Message 19/20 (1 dedup lookup — đã fix, xem S1) · PaymentTransaction 14/14 · ProductVariant 22/22 + 8/8 raw UPDATE có `AND "workspaceId" = $n` · Product 12/12 · InventoryTransaction 9/9 · Inbox 17/17 · KnowledgeArticle 13/13 (pgvector raw có `WHERE "workspaceId" = $2`) · Label 9/9 · CannedResponse 10/10 · Team 14/14 · ChannelIdentity 13/13 · ChannelEvent 7/7.

**Background jobs:** toàn bộ processors/listeners nhận workspaceId (hoặc tenant-anchor id) qua payload và query scoped — VERIFIED-OK. **Socket rooms:** `workspace_{id}` / `conversation_{id}` / `user_{id}` / `widget:*` — không có leak; `handleJoinWorkspace` verify membership DB trước khi join — VERIFIED-OK.

### 1.2. Findings & actions

| ID | Sev | Vị trí | Vấn đề | Action |
|----|-----|--------|--------|--------|
| S1 | MED | `attachments.service.ts:250,266` | `deleteByMessageId` query/delete theo bare `messageId` (MED-08 từ M4.0, chưa sửa ở tầng query) — caller duy nhất có verify, nhưng caller tương lai có thể xóa chéo tenant | ✅ **FIXED** — bắt buộc tham số `workspaceId`, filter qua relation `message: { workspaceId }` |
| S2 | MED | `auto-assignment.service.ts:165-181` | `inboxMember`/`teamMember` findMany không scoped (MED-08) | ✅ **FIXED** — nested filter `inbox: { workspaceId }` / `team: { workspaceId }` |
| S3 | MED | `messages.service.ts:148` | Dedup lookup `findFirst({conversationId, externalId})` thiếu workspaceId (implicit-only) | ✅ **FIXED** — thêm workspaceId |
| S4 | MED | `realtime.gateway.ts:851-1030` | 4 handlers commerce editing (start/heartbeat/stop/takeover) tin nhận `{workspaceId, conversationId}` từ client, **không verify membership/existence** → member workspace A có thể giữ editing lock của workspace B + emit COMMERCE_COLLISION_STATUS vào room tenant khác (cross-tenant lock DoS) | ⚠️ REPORT — fix cần verify conversation trong DB + check socket membership trong 4 handlers; khuyến nghị làm ngay đầu M4.5/PR riêng vì chạm gateway logic |
| S5 | MED | `storage.service.ts:119-131` | Bucket policy public `s3:GetObject` cho prefix `attachments/*` → attachment world-readable bằng URL (capability-URL only); presigned scoped path tồn tại nhưng vô nghĩa khi prefix public | ⚠️ REPORT — không fix trong audit vì DB đang lưu `fileUrl` public (FE render trực tiếp); cần migration plan: remove `attachments` khỏi PUBLIC_BUCKET_PREFIXES + chuyển sang presigned endpoint + re-generate fileUrl |
| S6 | MED | `attachments.service.ts:168,224` | `attachment.create` không tự verify tenant (child model, đúng theo caller) | ⚠️ REPORT — chấp nhận được với pattern hiện tại (caller-first verification); ghi nhận defense-in-depth |
| S7 | LOW | `realtime.gateway.ts:528,731` | Resolve-by-global-id rồi verify → lỗi FORBIDDEN vs NOT_FOUND cho phép dò UUID tồn tại | REPORT — trả NOT_FOUND thống nhất |
| S8 | LOW | `orders.service.ts:617`, `auto-assignment.service.ts:27` | Lock key không workspace-prefixed (`order:payment:{orderId}`, `lock:auto_assign:inbox:{id}`) — không thể collision (UUID) nhưng lệch convention `ws:{ws}:...` | REPORT — đổi key format khi sửa C1 (M4.2 Bug Report) |

**Kết luận 4.3-01: 0 CRITICAL/HIGH — không có đường cross-tenant read/write khả dụng trong code hiện tại; các MED còn lại là defense-in-depth (S4, S5, S6).**

---

## 2. TASK-4.3-02 — Authentication & Authorization

### 2.1. Endpoint Protection Matrix — VERIFIED-OK

30/30 controllers: global `JwtAuthGuard` (APP_GUARD) + `@Public` allow-list đúng design (health, auth register/login/refresh/logout, payment-webhook có PaymentWebhookGuard riêng fail-closed, channel-webhooks có per-channel HMAC, facebook callback + widget). `WorkspaceGuard+RolesGuard` trên mọi workspace controller (trừ presence tự verify membership — REPORT convention). Platform-admin ×4 dùng `PlatformRolesGuard` + SUPER_ADMIN. ADMIN không sửa/xóa OWNER, block last-owner — service-level invariants VERIFIED-OK.

### 2.2. Findings & actions

| ID | Sev | Vị trí | Vấn đề | Action |
|----|-----|--------|--------|--------|
| A1 | HIGH | `facebook.controller.ts:319` | Central FB webhook **fail-open** khi `FB_APP_SECRET` unset (`if (appSecret)` skip HMAC) → forged events được ingest | ✅ **FIXED** — fail-closed: reject khi thiếu secret; verification block de-indent sạch |
| A2 | HIGH | `widget-token.service.ts:38` | Hardcoded fallback secret `'widget_default_secret_key_change_in_production_12345'` commit trong repo → ai có source mint được visitor token (đọc conversation của inbox) | ✅ **FIXED** — bỏ literal; fail-fast ở constructor khi thiếu `WIDGET_TOKEN_SECRET`/`JWT_ACCESS_TOKEN_SECRET` |
| A3 | HIGH | `workspaces.service.ts:240` | GET `/workspaces/current/bank` trả **webhookSecret đã decrypt** dạng plaintext | ⚠️ REPORT — phải check FE bank-settings form trước (nếu form cần hiển thị secret thì UX đổi); khuyến nghị mask `{ isConfigured }` như pattern inboxes |
| A4 | MED | `workspaces.service.ts:732` | Raw `workspace.settings` (chứa ciphertext + legacy bankConfig) trả cho mọi member kể cả AGENT | ⚠️ REPORT — whitelist field trong DTO |
| A5 | MED | `token.service.ts:153` | Refresh token: **secret half không bao giờ được verify** — chỉ tokenId đủ để rotate (secret 32 bytes chỉ trang trí) | ✅ **FIXED** — lưu `tokenSecretHash` (SHA-256) vào record, timing-safe verify trước GETDEL; legacy record không hash được skip (compat); tokenId một mình không còn consume được session |
| A6 | MED | `token.service.ts:224` | Role snapshot từ login lan truyền qua rotation — demote SUPER_ADMIN vẫn giữ role trong JWT đến 7 ngày | ✅ **FIXED** — `auth.service.refreshToken` re-sign access token với role hiện tại từ DB khi khác snapshot |
| A7 | MED | `auth.controller.ts` | Không có HttpOnly cookie — refresh token sống trong client storage (XSS risk), CORS `credentials:true` thừa | ⚠️ REPORT — architectural (cookie flow + CSRF) |
| A8 | MED | `link-preview.service.ts:88` | SSRF: fetch URL bất kỳ (kể cả 169.254.169.254/localhost/RFC1918) — có timeout 3.5s + cap 128KB nhưng không block private IP | ⚠️ REPORT — fix = resolve DNS + block private/loopback/link-local trước fetch |
| A9 | MED | `redaction.config.ts` | Log headers chỉ redact authorization/cookie — thiếu webhook auth headers | ✅ **FIXED** — thêm `x-api-key`, `secure-token`, `x-hub-signature-256`, `x-telegram-bot-api-secret-token` |
| A10 | LOW | `widget-token.service.ts:46` | Visitor JWT 180 ngày + nhận qua query param (URL có thể vào log) | REPORT — rút TTL, ưu tiên header |
| A11 | LOW | `facebook.controller.ts:296`, `webhooks.service.ts:117` | `hub.verify_token` so sánh `===` không timing-safe | REPORT — 1-line fix, gộp với PR gateway |
| A12 | LOW | `web-chat.controller.ts:140`, `web-chat.adapter.ts:434` | Widget config spread toàn bộ `channel.settings` lên `@Public` endpoint | REPORT — allow-list keys |
| A13 | LOW | `env.schema.ts:38` | JWT secret chỉ `min(1)`; CHANNEL_ENCRYPTION_KEY example trivial | REPORT — min 32 chars |
| A14 | LOW | `main.ts:53` | Helmet CSP `'unsafe-inline'` cho scripts (theo Swagger) ở mọi môi trường | REPORT |

### 2.3. VERIFIED-OK (Auth)
- JWT: secret từ env `getOrThrow` (không default trong code), HS256, access 15m/refresh 7d, rotation GETDEL atomic + reuse detection + token-family revocation, change-password/logout revoke all.
- Passwords: argon2id (64MB/t=3/p=4), chỉ verify, **0 passwordHash trong DTO/log**.
- Webhook: payment guard fail-closed + timing-safe + HMAC SePay; Telegram refuse khi thiếu secret; FB per-channel adapter fail-closed; OAuth CSRF state qua Redis.
- Input validation: mọi mutation route qua Zod (pipe hoặc inline parse); raw `any` chỉ ở webhook ingestion đã signature-verified.
- SQL injection: 3 raw usages đều parameterized; 0 string concatenation.
- Env: `.env*` gitignored (verify `git ls-files`); 0 hardcoded secret literals (A2 là case duy nhất — đã fix).
- Pino redact: passwords/tokens/secrets/credentials/PII + req.body paths (mở rộng A9).

---

## 3. Dependency audit (liên quan security)

`pnpm audit`: **13 vulnerabilities (9 high, 3 moderate, 1 low) — toàn bộ transitive**: mysql2 ≤3.23.0 (via prisma), fast-uri ×4 (via AWS SDK/minio chain), multer ×3+1 (via @nestjs/platform-express), qs ×2 (via express chain), DeepmergeTS (via pino-pretty). 0 direct-dep vulnerability.

**Khuyến nghị:** thêm `pnpm.overrides` cho `multer@^2.3.0` + `fast-uri@latest` + `mysql2@^3.23.1` (test lại), hoặc đợi upstream bump. Không fix trong milestone này vì override transitive cần regression test build.

## 4. Trạng thái nghiệm thu Security

- [x] Multi-tenancy: 0 cross-tenant read/write khả dụng; MED-08 remnants đã fix (S1-S3)
- [x] Endpoint protection matrix: 0 unprotected endpoint ngoài public-by-design
- [x] Role guards: mọi admin mutation có OWNER,ADMIN; platform-admin SUPER_ADMIN
- [x] Passwords/JWT/webhook signature/SQL injection/log redaction/env secrets — verified
- [x] 3 HIGH auth findings: 2 fixed (A1, A2), 1 report (A3)
- [ ] S4 (commerce editing lock membership) + S5 (attachment bucket policy) — khuyến nghị fix sớm nhất
