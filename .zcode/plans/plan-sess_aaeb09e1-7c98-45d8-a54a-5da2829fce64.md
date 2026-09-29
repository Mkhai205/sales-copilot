# Plan refactor: shared-contracts + backend server (7 mục, theo thứ tự phụ thuộc)

Nguyên tắc: mỗi fix = 1 commit riêng (conventional commits, push lên main như convention hiện tại), sau mỗi fix chạy `pnpm lint && pnpm typecheck && pnpm test:all`. KHÔNG giữ compat re-export — xóa sạch code cũ (AGENTS.md). Không chạy lệnh phá dữ liệu DB.

**Sửa giả định từ review:** cycle identity↔omnichannel KHÔNG phải do xóa workspace (không tồn tại API xóa workspace) — gốc là `workspaces.service` dùng `ChannelCredentialService` (crypto utility thuần, chỉ cần ConfigService, 12+ importer) để mã hóa `webhookSecret`. Fix đúng: chuyển service đó về infrastructure, bỏ forwardRef. Không cần WorkspaceDeletedEvent.

---

## Fix 1 (P1) — shared-contracts thành buildable lib + Dockerfile + CI docker job

**File đổi:**

- `packages/shared-contracts/tsconfig.build.json` (mới): `extends ./tsconfig.json`, `module: commonjs`, `outDir: dist`, `rootDir: src`, `declaration: true`, `declarationMap: false`, chỉ include `src/index.ts` graph, exclude `**/__tests__`.
- `packages/shared-contracts/project.json`: thêm target `build` (executor `nx:run-commands`, `tsc -p packages/shared-contracts/tsconfig.build.json`). nx.json `targetDefaults.build.dependsOn: ["^build"]` tự động bảo đảm `server:build` chạy sau `shared-contracts:build`.
- `packages/shared-contracts/package.json`: `main` → `./dist/index.js`, `types` → `./dist/index.d.ts`. (Web không ảnh hưởng — Next import qua tsconfig paths vào `src/` trực tiếp.)
- Xóa rác: `packages/shared-contracts/dist/` (chỉ chứa 1 file stale) + `tsconfig.tsbuildinfo` (untrack nếu đang track).
- Kiểm tra `packages/email-templates` — nếu `main` cũng trỏ `src/` (server dist có compiled email-templates), áp dụng cùng pattern buildable + Dockerfile copy.
- `apps/server/Dockerfile` (stage production): thêm `COPY --from=build /app/packages/shared-contracts/package.json ./packages/shared-contracts/package.json` và `COPY --from=build /app/packages/shared-contracts/dist ./packages/shared-contracts/dist` (tương tự cho email-templates nếu fix).
- `.github/workflows/ci.yml`: thêm job `docker` ("Docker Build") chạy `docker build -f apps/server/Dockerfile .` — dependsOn quality+test, chỉ build không push.

**Verify:** `pnpm nx build shared-contracts && pnpm nx build server`; `docker build` local; chạy thử `node -e "require('@sales-copilot/shared-contracts')"` trong image context (docker run --rm image node -e ...) để chứng minh resolution OK.

## Fix 2 (P2) — Drift-guard test enum shared-contracts ↔ Prisma

- `apps/server/src/__tests__/shared-contracts-enum-parity.spec.ts` (jest, chạy trong `test:all` hiện có): bảng map 20 cặp enum (PlatformRole, WorkspaceRole, BillingPlanType, ChannelType, ConversationStatus, ConversationPriority, MessageType, MessageContentType, DeliveryStatus, SenderType, FileType, OrderStatus, PaymentStatus, FulfillmentStatus, DiscountType, PaymentMethod, PaymentGateway, PaymentTransactionStatus, InventoryTransactionType, KnowledgeEmbeddingStatus) — so tập member + giá trị giữa `@sales-copilot/shared-contracts` (qua moduleNameMapper có sẵn) và `infrastructure/database/generated/enums`. Fail khi thêm enum vào 1 bên mà quên bên kia.
- CI test job: thêm bước `pnpm nx run shared-contracts:test` (hiện node:test của package không chạy trong CI).

## Fix 3 (P3) — Hygiene shared-contracts

- **Enum style thống nhất `as const`**: chuyển 7 file đang dùng TS `enum` (commerce/enums.ts ×8, identity/workspaces ×1, omnichannel/inboxes ×1, omnichannel/conversations ×2, omnichannel/messages ×5, realtime/event-payloads ×2, realtime/schemas ×2) sang `export const X = {...} as const; export type X = ...`. Đã verify TS workspace chấp nhận gán chéo với Prisma const-object. Đổi alias `Priority` → khai thẳng `ConversationPriority`. Chuẩn hóa `KnowledgeEmbeddingStatus` từ const-array sang as-const object. Chạy `pnpm nx test shared-contracts` + `test:all` bắt lỗi chuyển kiểu (nếu có).
- **Queue names về 1 nơi** `src/common/queues.ts`: `COMMERCE_RECONCILIATION_QUEUE`, `COMMENT_GUARD_QUEUE`, `AI_AUTOPILOT_QUEUE`, `CHANNEL_INGESTION_QUEUE` (đưa từ server `queue.module.ts` sang); xóa export cũ tại chỗ cũ; update ~8 importer.
- **Rename file schema** về nhất quán `schemas.ts` (commerce/_, platform-admin/_, dashboard, intelligence, widget) — consumer đều import qua root barrel nên churn nhỏ.
- **`PaymentGatewayType`**: giữ làm union "gateway đã implement" nhưng rename thành `ImplementedPaymentGateway` + comment phân biệt với `PaymentGateway` enum (từ vựng domain đầy đủ). Nếu grep thấy chỉ dùng 1-2 chỗ, cân nhắc xóa hẳn.
- `zod` pin `^3.25.76` (đồng bộ server/web).

## Fix 4 (P1) — Gỡ cycle identity ↔ omnichannel

- Tạo `src/infrastructure/crypto/crypto.module.ts` (@Global) + di chuyển `channel-credential.service.ts` từ `omnichannel/inboxes/` sang `infrastructure/crypto/`. Update 12+ importer (workspaces.service, payment-webhooks.guard, inboxes.service, webhooks.service, outbound-message.listener, telegram/facebook/web-chat lifecycle+controllers+gateways, 2 processors, specs). Bỏ `@Optional()` nơi chỉ optional vì cycle.
- `workspaces.module.ts`: bỏ `forwardRef(() => InboxesModule)`; `inboxes.module.ts`: import thẳng `WorkspacesModule` (một chiều).
- `web-chat.module.ts`: bỏ 3 forwardRef vestigial (reverse edge rỗng — đã verify).
- Facebook↔WebhooksService: tạo `ChannelWebhooksModule` (từ `integrations/channel-webhooks/`) export `WebhooksService` + đăng ký `WebhooksController`; `FacebookModule` + `IntegrationsModule` import nó; bỏ `forwardRef(() => WebhooksService)` trong facebook.controller.

## Fix 5 (P2) — Queue processors về domain, QueueModule về wiring thuần

- `channel-ingestion.processor.ts` → `modules/omnichannel/integrations/`; provider của `IntegrationsModule`. Xóa duplicate `registerQueue(CHANNEL_INGESTION_QUEUE)` tại IntegrationsModule (chỉ giữ ở QueueModule @Global — điểm đăng ký duy nhất, phục vụ @InjectQueue của webhooks.service + health).
- `comment-guard.processor.ts` ở nguyên facebook dir nhưng provider của `FacebookModule`.
- `queue.module.ts`: bỏ 4 import domain module (Contacts/Conversations/Messages/Inboxes) + 2 processor providers; giữ @Global forRootAsync + registerQueue 2 queue name. Cập nhật README.md của thư mục.
- Queue name import từ `@sales-copilot/shared-contracts` (Fix 3 đã chuyển).

## Fix 6 (P2) — SystemSettingsService về common/settings

- Tạo `src/common/settings/system-settings.module.ts` (@Global, imports DatabaseModule + RedisModule) — module NestJS đầu tiên trong common, đúng precedent DatabaseModule/RedisModule @Global.
- Di chuyển `system-settings.service.ts` (+ `DEFAULT_SYSTEM_SETTINGS`, `ActorContext`) từ `platform-admin/settings/` → `common/settings/`.
- `PlatformAdminModule`: bỏ service khỏi providers/exports, giữ `SystemSettingsController` (admin REST surface).
- `AiAgentModule` + `FacebookModule`: bỏ import `PlatformAdminModule` (chỉ còn nhờ @Global).

## Fix 7 (P3) — Authz helpers về common/authz

- Tạo `src/common/authz/`; di chuyển 7 file generic đã verify KHÔNG có dep nghiệp vụ: `current-user.decorator`, `public.decorator`, `current-workspace.decorator`, `roles.decorator`, `roles.guard` (chỉ inject Reflector), `workspace-context.type`, `jwt-payload.type`.
- Tách `StoredRefreshToken` ra `identity/auth/types/stored-refresh-token.type.ts` (nghiệp vụ identity, chỉ token.service dùng) trước khi di chuyển jwt-payload.
- `slug.util.ts` → `common/utils/` (generic, 4 importer).
- Kèm theo: `roles.guard.spec.ts`, `slug.util.spec.ts` chuyển theo.
- Rewrite ~35 file importer (deep relative path, giữ style hiện tại — không thêm tsconfig alias).
- `WorkspaceGuard` (inject WorkspacesService) + `JwtAuthGuard` (inject TokenService) ở lại identity — có DI nghiệp vụ, không bắc cầu giả; các module vẫn import WorkspacesModule/AuthModule cho wiring guard.
- Xóa thư mục rỗng sau khi chuyển.

## Verify cuối

1. `pnpm lint && pnpm typecheck && pnpm test:all && pnpm nx test shared-contracts` — toàn xanh.
2. `pnpm nx build shared-contracts && pnpm nx build server` + `docker build -f apps/server/Dockerfile .` — image build thành công (job CI docker cũng chạy lần đầu).
3. Chạy lại script đếm cross-domain import (node script đã dùng khi review) để chứng minh: `identity → omnichannel` = 0, `infrastructure → modules` = 0, `* → platform-admin` = 0, `modules → identity` giảm từ ~130 còn chỉ còn WorkspaceGuard/JwtAuthGuard wiring.
4. Cập nhật memory `backend-architecture-review.md` trạng thái đã fix.

**Quy mô:** ~70 file, phần lớn là import rewrite. Không đổi behavior, không đổi API, không đụng DB.
