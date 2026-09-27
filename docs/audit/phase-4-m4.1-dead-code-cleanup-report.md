# Phase 4 — Milestone 4.1: Dead Code Cleanup & Simplification Report

> **Ngày:** 2026-09-28
> **Branch:** `audit/m4.1-dead-code-cleanup` (từ `main` @ `3de95ec`, tag `audit-v3-baseline`)
> **Scope:** TASK-4.1-01 Ghost Code · TASK-4.1-02 Ponytail Audit · TASK-4.1-03 Unused Exports/Imports/Deps · TASK-4.1-04 Test Hygiene
> **Tooling:** 3 Explore agents (ghost-code grep, hygiene scan, ponytail signals) + `npx knip` + 2 cleanup workers (web / server+packages)

---

## 1. Kết quả tổng hợp

| Metric | Before (M4.0 baseline) | After | Δ |
|--------|------------------------|-------|---|
| Tracked files | 933 | 923 | **−10 files** |
| File `.ts/.tsx` | 791 | 784 | −7 files |
| LOC `.ts/.tsx` | 139,828 | 138,918 | **−910 LOC** (−0.65%) |
| Dependencies removed | — | — | **−4 packages** |
| `pnpm lint` | 0 errors / 0 warnings | **0 / 0** | = |
| `pnpm typecheck` | 0 errors (5 projects) | **0 errors** | = |
| `pnpm test:all` | 1452 pass / 0 fail / 0 skip | *(xem §6)* | |

> Ghi chú: mức giảm 0.65% LOC thấp hơn mục tiêu 5–15% trong Expected Outcomes — điều đó là đúng ý: phần lớn "bloat" tiềm năng (god services, barrels, write-only settings UI) là **cắt giảm kiến trúc cần quyết định sản phẩm**, được liệt kê ở §4 Ponytail Findings thay vì tự ý xóa. Mọi thứ chết *chắc chắn* (0 references repo-wide) đã bị xóa sạch.

---

## 2. TASK-4.1-01 — Ghost Code từ Features đã xóa

### 2.1. Shipping Module — pipeline `ORDER_SHIPPED` chết hoàn toàn

Xác định: không còn module shipping/carrier, nhưng **toàn bộ event pipeline `ORDER_SHIPPED` còn sót lại mà không có emitter nào** (payload yêu cầu `trackingCode`/`shippingCarrier` — field đã bị prune khỏi Order model). Đã xóa:

| File | Đã xóa |
|------|--------|
| `packages/shared-contracts/src/realtime/events/event-payloads.ts` | `DomainEvent.ORDER_SHIPPED`, interface `OrderShippedEventPayload`, sửa comment stale "WebhookDispatcher" |
| `packages/shared-contracts/src/realtime/events/schemas.ts` | `WsServerEvent.ORDER_SHIPPED`, `orderShippedEventPayloadSchema` + type |
| `apps/server/src/modules/realtime/realtime-event.dispatcher.ts` | handler `handleOrderShipped` + import |
| `apps/server/src/modules/commerce/listeners/commerce-event.listener.ts` | handler `handleOrderShipped` (~52 dòng) |
| `apps/web/src/lib/socket/use-realtime-sync.ts` | subscription `ORDER_SHIPPED` |
| `apps/web/src/features/commerce/shared/hooks/use-commerce-realtime-sync.ts` | toast "đã xuất kho" + import payload |
| 3 spec files (dispatcher, listener, realtime.schemas) | các test block cho event chết |

**Giữ lại (live code theo đúng ghi chú "Giữ shippingFee trên Order"):** `shippingFee`/`shippingAddress` trên Order, `OrderStatus.SHIPPING`, `FulfillmentStatus` enum + status machine, `shippedAt`, tính shippingFee trong `orders-calculator.ts`, e2e assert DELIVERED.

### 2.2. Automation Rules — dead audit-log listeners

Không còn `AutomationRule` model/module, nhưng 3 listener audit-log còn sót trong `audit-logs.service.ts` (`@OnEvent('automation_rule.created'|'updated'|'deleted')`) — **không có emitter nào tồn tại**. Đã xóa cả 3 handler + test block tương ứng. Fixture `'AUTOMATION_RULE'` trong `conversations.service.spec.ts` đổi thành `'AGENT'`.

### 2.3. Outbound Webhooks — dead audit-log listeners

Tương tự, 3 handler `@OnEvent('webhook_subscription.*')` không có emitter/model nào. Đã xóa cả 3 + test block. **Giữ nguyên:** payment webhooks (SePay/Casso), channel inbound webhooks, `rawWebhookPayload` trên PaymentTransaction.

### 2.4. VIEWER Role / Multi-Workspace Picker / Analytics

**0 remnant** — grep toàn bộ source trả về rỗng (VIEWER đã purge sạch khỏi guards/DTOs/UI/contracts; không còn workspace-picker/switchWorkspace/invite-token; không còn `/analytics` route hay `AnalyticsPage`).

### 2.5. Zalo / Email channel (không đụng enum trong schema.prisma)

Server chỉ có 3 adapters (facebook/telegram/web-chat) — không có code xử lý ZALO/EMAIL. Đã dọn UI remnants:

- `contacts-view.tsx`: xóa 2 `<SelectItem>` filter cho ZALO/EMAIL (kênh không thể kết nối).
- Sửa stale copy: `login-form.tsx` ("Facebook, Telegram và Web Chat"), `quotas-tab.tsx` (bỏ "Zalo OA"), `feature-flags-tab.tsx` (comment-guard là Facebook-only), `queue/README.md` (viết lại đúng thực tế: bỏ Outbound Webhooks bullet, kênh Facebook/Telegram/Web Chat).
- Xóa 3 icon không còn ai reference: `public/channels/{gmail,instagram,tik-tok}.png`.

**Cố tình giữ lại (báo cáo, chờ M4.3 Schema Audit):** `ChannelType.ZALO`/`EMAIL` trong `schema.prisma` + enum mirror trong `shared-contracts/omnichannel/inboxes/enums.ts`; theo đó `lib/channels.ts` meta entries + 2 icon `zalo.png`/`email.png` + `unsupported-channel-placeholder.tsx` ("coming soon" roadmap UI) phải sống cùng enum — xóa enum thì xóa tiếp cả cụm. Các fixture `ChannelType.ZALO/EMAIL` trong unit specs (channel-adapter registry, inboxes, contact schemas, `lib/__tests__/channels.spec.ts`) là data test cho logic channel-agnostic, không phải code xử lý kênh — giữ cùng số phận với enum.

---

## 3. TASK-4.1-03 — Unused Exports, Imports & Dependencies

### 3.1. knip triage (knip raw: 33 unused files, 123 unused exports, 71 unused types, 17 duplicates)

**False positives đã loại khỏi danh sách xóa (có bằng chứng sử dụng):**

| knip nói | Thực tế |
|----------|---------|
| 8 file e2e + helpers + `jest-e2e.config.ts` | chạy bởi e2e jest config riêng (knip không parse `testRegex`) |
| 9 spec files shared-contracts/widget-sdk | chạy bởi `node --test` trong project.json |
| `pino-pretty` | dùng làm transport target string trong `app.module.ts` |
| `swagger-ui-express` | peer runtime của `@nestjs/swagger` |
| `@prisma/client` | generated client import `@prisma/client/runtime/client` |
| `supertest`/`@types/supertest`/`@nestjs/testing`/`socket.io-client` (server) | dùng trong `test/e2e/**` |
| `@types/multer`→đã xóa nhưng `ts-node`/`tsconfig-paths`/`tslib`/`@nx/*` giữ | `tsconfig-paths` dùng trong `project.json` (serve/test), `tslib` cần cho `importHelpers: true`, `ts-node` cho seeds/prisma.config, `@nx/*` là plugins nx |

**Đã xóa — 10 files:**

1. `apps/server/prisma/seeds/types.ts` (0 importers)
2. `apps/server/src/infrastructure/queue/queue.constants.ts` (duplicate chết của queue constants trong shared-contracts — mọi module import từ `@sales-copilot/shared-contracts`)
3. `apps/server/test/conversation-intelligence/conversation-intelligence-pipeline.integration.spec.ts` (**orphan broken test** — 1 dòng re-export trỏ tới module `conversation-intelligence` không tồn tại; không jest config nào chạy)
4. `apps/web/src/components/placeholder/feature-placeholder.tsx` (0 references, kể cả dynamic import)
5. `apps/web/src/components/ui/collapsible.tsx` + 6. `toggle.tsx` (shadcn components 0 usage)
7. `apps/web/src/features/contacts/components/contact-detail-sheet.tsx` (chỉ tồn tại để re-export alias chết)
8–10. 3 icon png không reference (trên)

**Đã xóa — dead POS-era aliases (rename POS→Commerce cũ, ~12 aliases):**
`PosModule`, `PosListenersModule`, `PosEventListener`, `PosReconciliationModule`, `PosReconciliationProcessor` (const + type) + test "backward compatibility" của nó; `PosDetailTab`/`PosDetailTabProps`, `PosOrderForm`/`PosOrderFormProps`, `usePosOrders`, `usePosProducts`, `usePosRealtimeSync`/`UsePosRealtimeSyncOptions`, `ContactDetailSheet`, 3× `commerceApi` (alias của `inventoryApi`/`ordersApi`/`productsApi`).

**Đã xóa / un-export — ~40 unused exports + 71 unused types (sau verify từng item repo-wide, bao gồm e2e + node--test specs):**

- Server: `ZodParam` (xóa), `EMBEDDING_DIMENSIONS` (xóa), 3 facebook dto schemas + 3 types (xóa, ~33 dòng), `NAPAS_BANKS`, `AI_MODEL_PRICING`+`ModelPricingConfig`, 10 tool input schemas + 10 `*Input` types (un-export — chỉ dùng nội bộ tool file), `ALLOWED_MESSAGE_*` ×3, `ALLOWED_MIME_TYPES`, health types ×3, `WorkspaceContextData`, `GuardrailBlockReason`, `InboundEventKind`, `DeliveryStatusInfo`, 14 `Facebook*` + 17 `Telegram*` + 3 `WebChat*` adapter payload interfaces (un-export — data shapes nội bộ).
- Web: `useCommerceOrdersList`, `useCommerceOrder`, `usePlatformAuditLogDetail`, `useKnowledgeArticle`, `useTeam`, `useWorkspacePresence`, `ADMIN_NAV_ITEMS`+`AdminNavItem`, `RecipientInfoFormValues`, `queryKeys` (object gộp — 13 factory lẻ vẫn dùng), `WS_BASE_URL`, `getApiUrl` (xóa); un-export: `normalizePaginatedResponse`, `usePaginatedContacts`, `formatMessageDateLabel`, `groupMessagesByDate`, `isStickerAttachment`, `CHANNEL_DEFINITIONS`, `INBOX_TIMELINE_STEPS`, 4× `Settings*Skeleton`, `playNotificationSound`, `getWsBaseUrl`, `REALTIME_NAMESPACE`, `ApiResponseMeta`, `getApiBase`, `VariantFormRow`, `PosLineItem`; method chết `auditLogsApi.getAuditLogById`, `knowledgeApi.getById`.
- Shared-contracts: `vietQrPayloadResponseSchema` (duplicate của `vietQrResponseSchema`), `normalizeVietnamesePhoneNumber` (alias — 2 call sites được canonicalize sang `normalizeVietnamesePhone`).

**Unused imports:** 0 — `pnpm lint` (typescript-eslint) đã sạch từ baseline và giữ nguyên 0/0 sau cleanup.

### 3.2. Commented-out code / console.log / TODO

- **Commented-out code:** 0 block trong handwritten source (scan heuristic + verify tay).
- **console.log production:** 0 trong `apps/server/src` runtime và `apps/web/src`. Các chỗ còn console đều hợp lệ: seeds/scripts (tooling CLI), `widget-sdk` (browser SDK không có Pino — console.error trong catch + 1 warn guard), error boundaries Next.js, react-query `onError`. **Không xóa gì** theo đúng rule "giữ console.error trong catch nếu chưa có Pino".
- **TODO/FIXME/HACK:** 0 occurrence trong handwritten source. `@ts-ignore`/`@ts-expect-error`: 0. `eslint-disable`: chỉ trong Prisma generated (exclude khỏi audit) + 1 `no-console` trong seed + 1 `no-useless-assignment` trong token.service.

### 3.3. Dependencies đã remove (4)

| Package | Nơi | Lý do |
|---------|-----|-------|
| `@react-email/ui` ^6.9.5 | packages/email-templates (dev) | 0 imports |
| `@types/ioredis` ^5.0.0 | apps/server (dev) | ioredis ^6 self-typed; @types v5 còn lệch version |
| `@types/multer` ^2.1.0 | apps/server (dev) | 0 type references (`Express.Multer` không dùng) |
| `@types/qrcode.react` ^3.0.0 | apps/web (dev) | qrcode.react ^4 self-typed |

**Khuyến nghị thêm (cần code change, để lại quyết định):** gộp `jsonwebtoken` → `@nestjs/jwt` JwtService (2 JWT libs trong 1 app); gỡ `@shadcn/react` (1 vendored wrapper `message-scroller.tsx`) và `framer-motion` (1 file). `vite` là unlisted binary cho `widget-sdk:build` (chạy được nhờ hoisting) — nên khai báo vào devDeps widget-sdk.

---

## 4. TASK-4.1-02 — Ponytail Audit (whole-repo, ranked biggest cut first)

> Scope: CHỈ over-engineering. Không flag validation/RBAC/error handling/`$transaction`/Strategy-Adapter đa kênh (theo AGENTS.md). Đã fix những item dead-code thuần (§3); các item dưới đây là **findings để quyết định**, chưa áp dụng.

1. `delete:` Write-only announcements/maintenance settings — 3 keys `system.maintenance_mode|banner_message|banner_level` + cả tab UI `announcements-tab.tsx` (~259 LOC): UI ghi, **không có gì render banner hay enforce maintenance mode** trong app shell. Replacement: xóa cả cụm, hoặc wire-up thật. [apps/server/src/modules/platform-admin/settings/system-settings.service.ts:93-110, apps/web/src/features/platform-admin/settings/components/announcements-tab.tsx] → **~270 LOC**
2. `delete:` Write-only feature/llm settings — 8 keys `feature.pos_vietqr_enabled|ai_autopilot_enabled|comment_masking_enabled|thermal_print_enabled`, `llm.default_provider|default_model|temperature_default|max_tokens_limit`: có UI đọc/ghi (feature-flags-tab, ai-defaults-tab) nhưng **0 code áp dụng** — AI dùng constants/env, không đọc settings. Replacement: wire settings vào behavior, hoặc xóa keys + 2 tab. [system-settings.service.ts:21-67 + 2 tab web] → **~90 LOC + 2 tab**
3. `shrink:` `formatDateTime`/`formatDate` duplicate ở **8 components** (Rule of Three vượt xa) — date-fns đã có sẵn. Replacement: 1 util dùng chung. [orders-table, order-detail-sheet, stock-ledger-drawer, reconciliation-ledger-table, contact-detail-dialog, contacts-table, audit-log-helpers, workspace-helpers] → **~65 LOC**
4. `delete:` 31 internal barrel `index.ts` trong `packages/shared-contracts/src` (3 tầng, chỉ 5 import sites prod + 9 spec dùng) — commit `b86b186` đã xóa barrels apps nhưng sót packages này. Replacement: re-export trực tiếp từ root barrel. → **31 files**
5. `shrink:` BYOK/Vertex/Gemini key-resolver copy-paste verbatim ~30 LOC giữa `ai-agent.service.ts:55-90` và `knowledge-embedding.service.ts:55-90`. Replacement: extract 1 helper. → **~30 LOC**
6. `yagni:` `ApiResponse<T>` khai báo lại locally trong `apps/web/src/lib/api/client.ts:57-61` trong khi shared-contracts đã có `ApiSuccessResponse`/`ApiErrorResponse`. → **~10 LOC**
7. `delete:` Chatwoot compat shim `window.chatwootSDK` trong `packages/widget-sdk/src/index.ts:18-29` — consumer duy nhất là trang test thủ công `test-chat.html`. → **~12 LOC**
8. `delete:` deps cần code change: `jsonwebtoken` (→ JwtService), `@shadcn/react`, `framer-motion` (xem §3.3). → **−3 deps**

**Tổng tiềm năng còn lại: `net: −~480 lines, −3 deps possible.`** (Đã thực hiện phần chắc chắn chết: −910 LOC, −4 deps — xem §1.)

Các vùng **sạch** bất ngờ: không single-implementation interface (duy nhất `ChannelAdapter` có 3 impls — mandated), không wrapper-only delegation, không hand-rolled stdlib (sleep/chunk/groupBy/deepClone đều 0).

---

## 5. TASK-4.1-04 — Test Hygiene

| Hạng mục | Kết quả |
|----------|---------|
| Test files import module không tồn tại | 1 phát hiện, đã xóa: `test/conversation-intelligence/...integration.spec.ts` (re-export tới `src/modules/conversation-intelligence/*` không tồn tại — module giờ là `intelligence`; file này không jest config nào chạy) |
| Skipped tests (`.skip`/`xit`/`xdescribe`/`it.todo`) | **0** — không có gì để enable/xóa |
| Test cho API/aliases đã xóa | Xóa test block tương ứng: `getAuditLogById`, `knowledgeApi.getById`, backward-compat `PosReconciliationProcessor` |
| Naming convention | 109 test files đều đúng: 97 unit `*.spec.ts` (jest), 3 integration `*.integration.spec.ts`, 8 e2e `*.e2e-spec.ts`, web/packages `__tests__/*.spec.ts` (node --test). 0 vi phạm |

---

## 6. Verification — So sánh Before/After

| Gate | Before (M4.0) | After (M4.1) | Δ |
|------|---------------|--------------|---|
| `pnpm lint` | 0 errors / 0 warnings | **0 errors / 0 warnings** | = |
| `pnpm typecheck` | 0 errors / 5 projects | **0 errors / 5 projects** | = |
| `pnpm test:all` — Unit | 97 suites / 1224 tests | **97 suites / 1219 tests** | −5 (test của dead features/aliases) |
| `pnpm test:all` — Integration | 3 suites / 26 tests | **3 suites / 26 tests** | = |
| `pnpm test:all` — E2E | 8 suites / 202 tests | **8 suites / 202 tests** | = (T1.5.4 cập nhật theo cleanup `getApiUrl`) |
| **Tổng** | **1452 pass / 0 fail / 0 skip** | **1447 pass / 0 fail / 0 skip** | **−5 test chết** |

Chi tiết 5 test bị xóa (đều test dead code): 1 listener `ORDER_SHIPPED`, 1 dispatcher broadcast `ORDER_SHIPPED`, 1 audit-log `automation_rule.*`, 1 audit-log `webhook_subscription.*`, 1 backward-compat alias `PosReconciliationProcessor`. Ngoài ra node --test suites (web/packages, ngoài gate test:all) cũng đã dọn test cho API đã xóa (`getAuditLogById`, `knowledgeApi.getById`) và 2 test schema `ORDER_SHIPPED` trong shared-contracts.

---

## 7. Trạng thái nghiệm thu M4.1

- [x] Grep ghost code trả về 0 remnant (trừ docs/, enum schema.prisma — cố ý giữ, chờ M4.3)
- [x] Không còn file/thư mục của features đã xóa trong `apps/` và `packages/src/`
- [x] `pnpm typecheck` pass — 0 broken imports
- [x] Ponytail-audit report hoàn tất, ranked biggest cut first, đủ tag/what/replacement/path
- [x] knip: 0 unused exports còn lại ngoài justified exceptions (shadcn `components/ui/*` kit exports; adapters/DTO shapes đã un-export thay vì xóa)
- [x] 0 unused imports · 0 unused production deps (4 dev/type deps removed) · 0 console.log production mới · 0 commented-out code
- [x] 0 test file broken · 0 skip · naming convention đúng 100%
- [x] `pnpm lint && pnpm typecheck && pnpm test:all` — **final gate PASS 100%** (0/0/1447 pass, 0 skip — xem §6)
