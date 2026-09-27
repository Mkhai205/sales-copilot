# Phase 4: Kiểm Toán Toàn Diện Codebase (Comprehensive Codebase Audit)

> **Phân kỳ:** Phase 4 (Sau khi hoàn tất Phase 3B — Core Feature Completion)
> **Mục tiêu:** Audit toàn diện backend, frontend, packages — phát hiện và loại bỏ dead code, bugs, security gaps, architectural inconsistencies tích lũy qua nhiều iteration phát triển bằng AI coding agent
> **Lý do:** Codebase đã trải qua nhiều vòng phát triển tính năng, thay đổi kiến trúc và định hướng sản phẩm. Cần một đợt kiểm toán triệt để trước khi đưa vào production
> **Công cụ:** `ponytail-audit` (over-engineering scan), `/teamwork-preview` (multi-agent parallel execution), `knip`/`depcheck` (unused code detection)
> **Ước lượng:** 4 Milestones, 8–12 giờ với parallelism

---

## Bối Cảnh & Baseline

### Audit trước đó (v2.0)
- Điểm kiến trúc: **85/100** (tăng từ 64/100)
- 5/5 CRITICAL đã fix, nhưng còn **8 partially resolved** + **9 outstanding items**
- Nhiều features đã bị loại bỏ sau audit v2.0 (Shipping, Automation Rules, Outbound Webhooks, VIEWER role, multi-workspace)
- Nhiều features mới được thêm (Dashboard, Contacts CRM UI, Reconciliation UI, AI hardening)

### Thống kê Codebase hiện tại

| Khu Vực | Số File | Chi tiết |
|---------|---------|----------|
| Backend (`apps/server/src`) | 319 | 30 controllers, 43 services, 38 modules, 97 spec files |
| Frontend (`apps/web/src`) | 386 | 245 TSX, 138 TS, 42 UI components, 7 feature slices |
| Shared Contracts | 79 | Zod schemas, types, DTOs, Socket events |
| Email Templates | 4 | React Email templates + renderer |
| Widget SDK | 8 | Embeddable Web Chat SDK |
| Database Schema | 832 dòng | 27 models, 20 enums |

### Chiến lược thực hiện
- **Phân pha:** 4 Milestones tuần tự, mỗi milestone dùng `/teamwork-preview` với nhiều agents song song
- **Cleanup policy:** Mạnh tay — xóa thẳng, git revert nếu cần. Pre-production không cần backward compatibility
- **Auto-fix:** Dead code, unused imports, formatting → fix tự động. Logic/architecture → chỉ báo cáo
- **Verification:** `pnpm lint && pnpm typecheck && pnpm test:all` sau mỗi milestone

---

## Tổng Quan Các Milestone

| ID | Tên Milestone | Độ Ưu Tiên | Agents | Phụ Thuộc |
|:---|:---|:---:|:---:|:---:|
| `M4.0` | Baseline & Triage | P0 | Solo (1 agent) | Không |
| `M4.1` | Dead Code Cleanup & Simplification | P0 | Team (6 agents) | `M4.0` |
| `M4.2` | Bug Hunting & Architecture Consistency | P0 | Team (7 agents) | `M4.1` |
| `M4.3` | Security, Schema & Performance Audit | P1 | Team (6 agents) | `M4.2` |

---

## Milestone 4.0: Baseline & Triage (Solo)

> **Mục tiêu:** Thiết lập trạng thái xuất phát, xác nhận prior audit findings
> **Thực hiện:** 1 agent, conversation thường (không cần teamwork)
> **Ước lượng:** ~30 phút

### Danh sách nhiệm vụ

| ID | Nhiệm Vụ | Chi tiết |
|:---|:----------|:---------|
| `TASK-4.0-01` | Chạy CI baseline | `pnpm lint`, `pnpm typecheck`, `pnpm test:all` — ghi nhận số errors/warnings/pass/fail |
| `TASK-4.0-02` | Re-verify prior audit findings | Kiểm tra 17 outstanding items từ audit v2.0 (xem bảng bên dưới) |
| `TASK-4.0-03` | Tạo baseline tag | Git tag `audit-v3-baseline` trước khi bắt đầu thay đổi |

### Prior Audit Outstanding Items cần re-verify

| ID gốc | Severity | Vấn đề | Nơi kiểm tra |
|---------|----------|--------|---------------|
| HIGH-01 | HIGH | `orders.service.ts:updateOrder` quên assign `paymentMethod` vào DB column | `apps/server/src/modules/commerce/orders/orders.service.ts` |
| HIGH-02 | HIGH | 3 mutation schemas dùng `z.coerce.number()` gây silent coercion | `packages/shared-contracts/src/commerce/` (createProduct, updateProduct, updateOrder) |
| HIGH-04 | HIGH | BullMQ reconciliation worker thiếu `P2002` try/catch | `payment-reconciliation.service.ts` |
| HIGH-08 | HIGH | 16 God Services >300 LOC | `orders.service.ts` (1160), `inventory-ledger.service.ts` (949), `conversations.service.ts` (788) |
| HIGH-10 | HIGH | Dual routing chỉ áp dụng cho Commerce/Dashboard, chưa cho Omnichannel | Router config |
| MED-01 | MED | Realtime event enums chưa merge (`DomainEvent` vs `WsServerEvent`) | `packages/shared-contracts/src/realtime/` |
| MED-02 | MED | `broadcastSafe` thiếu `workspaceId`/`timestamp`; 8 commerce event payloads typed `Record<string, unknown>` | Realtime gateway |
| MED-04 | MED | Query Keys Factory 0% adoption | `apps/web/src/lib/query-keys.ts` vs tất cả hooks |
| MED-05 | MED | 25 raw `<button>` elements, direct Radix Dialog import, 3 hardcoded color classes | Components |
| MED-06 | MED | Module singleton cache `vietnam-address.ts` | `recipient-info-form.tsx` |
| MED-07 | MED | Facebook DTOs split giữa server và web, chưa vào shared-contracts | Facebook-related files |
| MED-08 | MED | Secondary queries thiếu `workspaceId` | `attachments.service.ts:deleteByMessageId`, `inboxes.service.ts:deleteMember` |
| MED-09 | MED | `inventory-ledger.service.ts` thiếu pessimistic locking | `previousStock` read without `FOR UPDATE` |
| LOW-01 | LOW | Leaked queue constants trong shared-contracts | `shared-contracts/src/` |
| LOW-02 | LOW | Direct Radix imports bypass Shadcn wrapper | `image-lightbox-dialog.tsx` |
| LOW-03 | LOW | Phone regex divergence (E.164 vs `09...`) | Contacts vs Orders |
| LOW-04 | LOW | Loose union types trong response DTOs | `price: number | string`, `any[]` |

### Tiêu chí nghiệm thu
- [ ] CI baseline report tạo xong với số liệu cụ thể (errors, warnings, pass/fail counts)
- [ ] 17 prior findings đánh dấu trạng thái: ✅ Fixed / ⚠️ Partial / ❌ Still Open
- [ ] Git tag `audit-v3-baseline` đã tạo

---

## Milestone 4.1: Dead Code Cleanup & Simplification (Teamwork)

> **Mục tiêu:** Loại bỏ tất cả dead code, ghost code từ features đã xóa, over-engineering
> **Thực hiện:** `/teamwork-preview` với 6 agents song song
> **Branch:** `audit/m4.1-dead-code-cleanup`
> **Ước lượng:** ~2–3 giờ

### Agent Assignment

| Role | Agent | Nhiệm vụ |
|------|-------|----------|
| Explorer 1 | Ponytail Auditor | Chạy `ponytail-audit` trên toàn repo → danh sách over-engineering |
| Explorer 2 | Ghost Code Hunter | Grep remnants từ features đã xóa |
| Explorer 3 | Unused Code Scanner | Scan unused exports, imports, dependencies, orphan files |
| Worker 1 | Dead Code Remover | Xóa dead code + ghost code dựa trên findings |
| Worker 2 | Simplification Worker | Simplify over-engineered code dựa trên ponytail findings |
| Reviewer | Verification Reviewer | Review changes, chạy lint + typecheck + tests |

### Danh sách nhiệm vụ

---

### Task 4.1-01: Ghost Code từ Features đã xóa

#### 1. Mục tiêu & Trải nghiệm Người dùng
Quét và loại bỏ toàn bộ remnants (code, imports, references, configs) của các features/modules đã bị loại khỏi định hướng sản phẩm trong Phase 3A.

#### 2. Quy tắc nghiệp vụ & Bất biến
Grep toàn bộ source code (trừ `node_modules`, `docs`, `dist`, `.git`) cho từng nhóm keywords:

| Feature đã xóa | Keywords grep | Lưu ý |
|-----------------|---------------|-------|
| Shipping Module | `shipping`, `ShippingAddress`, `CarrierProvider`, `GHN`, `GHTK`, `waybill`, `fulfillment`, `calculate_shipping`, `dispatch_order` | Giữ `shippingFee` trên Order nếu đang dùng |
| Automation Rules | `AutomationRule`, `automation-rules`, `automation/rules` | Cẩn thận không xóa nhầm `auto-assignment` |
| Outbound Webhooks | `WebhookSubscription`, `WebhookDelivery`, `webhook-dispatcher`, `outbound-webhook` | Giữ nguyên payment webhooks (SePay/Casso) |
| VIEWER Role | `VIEWER`, `'viewer'`, `"viewer"` | Kiểm tra guards, DTOs, UI role selectors, shared-contracts enums |
| Multi-Workspace Picker | `workspace-picker`, `workspace-selector`, `switchWorkspace`, `invite-token`, `workspace-invite` | Giữ workspace management trong settings |
| Analytics Placeholders | `/analytics`, `AnalyticsPage`, `analytics-overview`, `analytics-channels`, `analytics-agents` | Kiểm tra route files |
| Zalo / Email channels | `ZALO`, `ChannelType.EMAIL` (chỉ trong code xử lý, không phải enum definition) | Enum values trong schema → báo cáo riêng (Phase Schema Audit) |

#### 3. Ranh giới & Điều cấm
- KHÔNG xóa enum values trong Prisma schema (xử lý ở Milestone 4.3 — Schema Audit)
- KHÔNG xóa nội dung trong `docs/` và `docs/backlog/archive/` — đây là tài liệu lịch sử
- Khi không chắc code có đang dùng hay không → báo cáo, không xóa

#### 4. Tiêu chí nghiệm thu
- [ ] Grep trả về 0 results cho tất cả keywords ghost code (trừ docs/, schema enum definitions)
- [ ] Không còn file/thư mục nào liên quan đến features đã xóa trong `apps/` và `packages/src/`
- [ ] `pnpm typecheck` pass — không broken imports

---

### Task 4.1-02: Ponytail Audit — Over-engineering Scan

#### 1. Mục tiêu & Trải nghiệm Người dùng
Chạy `ponytail-audit` skill trên toàn bộ codebase để phát hiện code over-engineered: abstractions dư thừa, dependencies thay thế được bằng stdlib/native, dead flexibility, wrappers chỉ delegate.

#### 2. Quy tắc nghiệp vụ & Bất biến
- Ponytail tags cần tìm: `delete:`, `stdlib:`, `native:`, `yagni:`, `shrink:`
- Ponytail scope: CHỈ over-engineering & complexity. KHÔNG fix bugs, security, performance
- Mỗi finding phải có format: `<tag> <what to cut>. <replacement>. [path]`
- Kết thúc bằng: `net: -<N> lines, -<M> deps possible.`

#### 3. Ranh giới & Điều cấm
- KHÔNG áp dụng fixes — chỉ liệt kê findings
- KHÔNG đánh dấu validation, RBAC, error handling, `$transaction` là bloat (theo AGENTS.md)
- KHÔNG đánh dấu Strategy/Adapter Pattern cho đa kênh/đa đối tác là yagni (theo AGENTS.md)

#### 4. Tiêu chí nghiệm thu
- [ ] Report ponytail-audit hoàn tất với findings ranked theo `biggest cut first`
- [ ] Mỗi finding có `tag`, `what to cut`, `replacement`, `path`
- [ ] Tổng hợp `net: -N lines, -M deps possible`

---

### Task 4.1-03: Unused Exports, Imports & Dependencies

#### 1. Mục tiêu & Trải nghiệm Người dùng
Quét và loại bỏ toàn bộ exports không ai import, imports không sử dụng, dependencies cài nhưng không dùng, và orphan files không ai reference.

#### 2. Quy tắc nghiệp vụ & Bất biến

| Hạng mục | Tool/Method | Scope |
|----------|-------------|-------|
| Unused exports | `knip` hoặc `ts-prune` | `packages/shared-contracts`, `apps/server`, `apps/web` |
| Unused imports | ESLint `no-unused-imports` hoặc TypeScript `--noUnusedLocals` | Toàn bộ `.ts/.tsx` |
| Unused dependencies | `depcheck` hoặc `knip` | `package.json` của mỗi app/package |
| Orphan files | `knip` (unreferenced files) | Files không được import bởi bất kỳ module/route nào |
| Commented-out code | Grep `// `, multiline `/* */` blocks | Xóa toàn bộ — git history là backup |
| `console.log` / debug | Grep `console.log`, `console.warn`, `console.error` | Chuyển thành Pino logging hoặc xóa |
| TODO/FIXME/HACK | Grep `TODO`, `FIXME`, `HACK` | Thu thập danh sách, đánh giá relevance |
| Skipped tests | Grep `.skip`, `xit`, `xdescribe` | Xóa hoặc enable |

#### 3. Ranh giới & Điều cấm
- KHÔNG xóa `devDependencies` mà CI/build cần (eslint, prettier, nx, typescript...)
- Test files cho features đã xóa → xóa
- `console.error` trong catch blocks → giữ lại nếu chưa có Pino logger

#### 4. Tiêu chí nghiệm thu
- [ ] `knip` hoặc `ts-prune` trả về 0 unused exports (hoặc danh sách justified exceptions)
- [ ] 0 unused imports trong toàn bộ source
- [ ] 0 unused production dependencies
- [ ] 0 `console.log` trong production code (trừ development-only guards)
- [ ] 0 commented-out code blocks
- [ ] `pnpm lint && pnpm typecheck && pnpm test:all` pass

---

### Task 4.1-04: Test Hygiene

#### 1. Mục tiêu & Trải nghiệm Người dùng
Dọn dẹp test suite: xóa tests cho features đã loại bỏ, fix broken imports trong tests, enable hoặc xóa skipped tests.

#### 2. Quy tắc nghiệp vụ & Bất biến
- Test files import modules không tồn tại → xóa toàn bộ test file
- `.skip` / `xit` / `xdescribe` tests → evaluate: nếu feature tồn tại thì enable, nếu không thì xóa
- Test file không match convention naming (`*.spec.ts` cho unit, `*.e2e-spec.ts` cho E2E) → rename hoặc di chuyển

#### 3. Tiêu chí nghiệm thu
- [ ] 0 test files import modules không tồn tại
- [ ] 0 permanently skipped tests (mọi `.skip` phải có lý do tracked)
- [ ] `pnpm test:all` — 100% pass, 0 skip

---

### Gate Milestone 4.1
```bash
pnpm lint && pnpm typecheck && pnpm test:all
# So sánh với baseline: lines removed, files removed, deps removed
```

---

## Milestone 4.2: Bug Hunting & Architecture Consistency (Teamwork)

> **Mục tiêu:** Phát hiện bugs tiềm ẩn trong business logic và đảm bảo toàn bộ codebase follow cùng patterns
> **Thực hiện:** `/teamwork-preview` với 7 agents song song
> **Branch:** `audit/m4.2-bugs-and-architecture`
> **Ước lượng:** ~3–4 giờ
> **Lưu ý:** Milestone này chủ yếu là **báo cáo**. Chỉ auto-fix những bugs rõ ràng, safe. Bugs phức tạp → báo cáo để quyết định

### Agent Assignment

| Role | Agent | Nhiệm vụ |
|------|-------|----------|
| Explorer 1 | Commerce Auditor | Audit business logic Commerce (Orders, Inventory, Payment, VietQR) |
| Explorer 2 | Omnichannel Auditor | Audit logic Omnichannel (Contacts, Conversations, Messages, Channels) |
| Explorer 3 | AI Agent Auditor | Audit AI Agent (Tools, Guardrails, Takeover, Rate Limiting) |
| Explorer 4 | Cross-Layer Auditor | Audit Frontend patterns, cross-layer consistency, contract mismatches |
| Worker 1 | Bug Fixer | Fix confirmed bugs (safe changes only) |
| Worker 2 | Pattern Normalizer | Fix architecture violations, normalize patterns |
| Reviewer | Verification Reviewer | Review changes, run full test suite |

### Danh sách nhiệm vụ

---

### Task 4.2-01: Audit Business Logic — Commerce (HIGH RISK)

#### 1. Mục tiêu & Trải nghiệm Người dùng
Kiểm tra tính chính xác của toàn bộ logic nghiệp vụ thương mại: tính toán đơn hàng, quản lý tồn kho, đối soát thanh toán, state machine đơn hàng, VietQR.

#### 2. Quy tắc nghiệp vụ & Bất biến

| # | Kiểm tra | Nơi kiểm tra | Risk |
|---|----------|---------------|------|
| 1 | **Order calculation** — subtotal, discount, shipping fee, total. Edge: discount > subtotal, negative qty, zero-price | `orders-calculator.ts` | 💰 Sai tiền |
| 2 | **Inventory ledger** — Available = Total − Committed − Reserved. Race condition khi 2 agents đặt cùng lúc | `inventory-ledger.service.ts` | 💰 Âm kho |
| 3 | **Payment reconciliation** — amount matching, duplicate detection, partial payment | `payment-reconciliation.service.ts` | 💰 Gạch nhầm |
| 4 | **Order status transitions** — state machine DRAFT→PENDING→CONFIRMED→... Có transition illegal? | `order-status-guard.ts` | Sai trạng thái |
| 5 | **VietQR generation** — chuẩn NAPAS 247, amount encoding, merchant info | `vietqr.service.ts` | 💰 QR sai |
| 6 | **`$transaction` coverage** — mọi operation Order+Inventory+Payment PHẢI trong `$transaction` | Grep `prisma.order.create/update` ngoài transaction | 💰 Data inconsistency |

#### 3. Ranh giới & Điều cấm
- KHÔNG thay đổi business rules — chỉ fix implementation bugs
- Bugs phức tạp (race condition, locking) → báo cáo chi tiết, KHÔNG tự fix

#### 4. Tiêu chí nghiệm thu
- [ ] Report liệt kê mọi bugs phát hiện, rated theo severity (CRITICAL/HIGH/MED/LOW)
- [ ] Mỗi bug có: mô tả, root cause, file + line number, suggested fix, impact assessment
- [ ] Không có CRITICAL bug nào bị bỏ sót trong các operation liên quan đến tiền

---

### Task 4.2-02: Audit Business Logic — Omnichannel

#### 1. Mục tiêu & Trải nghiệm Người dùng
Kiểm tra tính chính xác của logic đa kênh: contact resolution/merge, auto-assignment, message delivery, webhook idempotency.

#### 2. Quy tắc nghiệp vụ & Bất biến

| # | Kiểm tra | Nơi kiểm tra |
|---|----------|---------------|
| 1 | **Contact resolution/merge** — customer liên hệ từ nhiều kênh, merge đúng? Data loss? | `contact-resolution.service.ts` |
| 2 | **Auto-assignment** — Round-robin fair? Edge: all agents offline, 1 agent only | `auto-assignment.service.ts` |
| 3 | **Message delivery flow** — webhook → queue → adapter → outbound. Message bị nuốt? | Toàn bộ pipeline |
| 4 | **Channel adapter consistency** — Facebook vs Web Chat: cùng interface, behavior nhất quán? | `channel-adapter.registry.ts` |
| 5 | **Webhook idempotency** — cùng webhook gửi 2 lần → duplicate message? | Queue deduplication logic |

#### 3. Tiêu chí nghiệm thu
- [ ] Report với findings rated theo severity
- [ ] Mỗi message flow path đã được trace từ đầu đến cuối

---

### Task 4.2-03: Audit Business Logic — AI Agent

#### 1. Mục tiêu & Trải nghiệm Người dùng
Kiểm tra tính chính xác và an toàn của hệ thống AI Agent: 10 tools, guardrails, takeover/handoff, rate limiting, address parser.

#### 2. Quy tắc nghiệp vụ & Bất biến

| # | Kiểm tra | Nơi kiểm tra |
|---|----------|---------------|
| 1 | **10 AI tools** — mỗi tool trả format đúng, error handling khi tool fail | `ai-agent/tools/` |
| 2 | **Guardrails** — `ai-guardrail.service.ts`, `discount-guard.service.ts` có bypass được không? | Guardrail services |
| 3 | **Takeover/Handoff** — khi nào AI dừng, bàn giao human? Edge: AI và human cùng reply | `ai-takeover.listener.ts` |
| 4 | **Rate limiting** — Redis sliding window 5 msgs/min, verify implementation | Rate limit logic |
| 5 | **Address parser** — test với địa chỉ thực VN, edge cases (quận/huyện trùng tên) | `address-parser.util.ts` |
| 6 | **Prompt injection** — XML tag wrapping có đủ chống injection? | `ai-context.builder.ts` |

#### 3. Tiêu chí nghiệm thu
- [ ] Report với findings rated theo severity
- [ ] Mỗi AI tool đã verified input/output format
- [ ] Guardrails đã tested với adversarial inputs

---

### Task 4.2-04: Audit Error Handling & Data Flow

#### 1. Mục tiêu & Trải nghiệm Người dùng
Phát hiện lỗ hổng error handling và contract mismatches giữa backend ↔ shared-contracts ↔ frontend.

#### 2. Quy tắc nghiệp vụ & Bất biến

| # | Kiểm tra | Chi tiết |
|---|----------|----------|
| 1 | **Unhandled promise rejections** | async functions thiếu try/catch, đặc biệt event listeners và queue processors |
| 2 | **Null/undefined access** | Optional chaining thiếu, `.data.items` without null check |
| 3 | **Error propagation** | Errors bị swallowed (catch rỗng) hoặc re-throw mất context |
| 4 | **Frontend error boundaries** | Error Boundary cho mỗi route segment? API error → UI hiển thị gì? |
| 5 | **Request/Response shape mismatches** | Backend shape A, frontend expect shape B (CRIT-01 pattern) |
| 6 | **Zod schema vs Prisma model drift** | Fields added/removed in one but not other |
| 7 | **Enum consistency** | Prisma enums vs shared-contracts enums vs frontend hardcoded strings |
| 8 | **Pagination contract** | Backend pagination format vs frontend parsing — nhất quán? |

#### 3. Tiêu chí nghiệm thu
- [ ] 0 unhandled promise rejections trong event listeners và queue processors
- [ ] 0 catch blocks rỗng (swallowed errors)
- [ ] Report contract mismatches giữa backend ↔ shared-contracts ↔ frontend

---

### Task 4.2-05: Audit Architecture & Pattern Consistency

#### 1. Mục tiêu & Trải nghiệm Người dùng
Đảm bảo toàn bộ codebase tuân thủ cùng patterns và conventions theo AGENTS.md.

#### 2. Quy tắc nghiệp vụ & Bất biến

**Backend patterns (theo AGENTS.md):**

| # | Rule | Kiểm tra |
|---|------|----------|
| 1 | Skinny Controller, Rich Service | Controllers CHỈ: routing, auth guards, gọi service, trả response |
| 2 | No PrismaService in Controllers | 0 controllers inject PrismaService trực tiếp |
| 3 | Consistent error/success responses | Tất cả qua `HttpExceptionFilter` và `TransformInterceptor` |
| 4 | Module structure consistency | Mỗi module: `*.module.ts`, `*.controller.ts`, `*.service.ts` |
| 5 | God Services | List services >300 LOC, đề xuất split thành private helpers |
| 6 | Naming conventions | File: `kebab-case`, class: `PascalCase`, method: `camelCase` |

**Frontend patterns (theo AGENTS.md):**

| # | Rule | Kiểm tra |
|---|------|----------|
| 1 | Feature-Sliced consistency | Mỗi slice: `api/`, `components/`, `hooks/` |
| 2 | TanStack Query only | KHÔNG `useEffect` fetch API, tất cả qua `useQuery`/`useMutation` |
| 3 | Query Keys Factory | `lib/query-keys.ts` phải dùng trong 100% hooks (hiện 0%) |
| 4 | Shadcn UI only | Không raw `<button>`, `<input>`, `<dialog>` khi có Shadcn equivalent |
| 5 | Server vs Client Components | Layout = Server Component. `'use client'` chỉ ở leaf components |
| 6 | API client centralized | Tất cả qua `api-client.ts`, không `fetch()` trực tiếp |
| 7 | Forms = react-hook-form + zod | Không `useState` cho form state |

**Cross-layer:**

| # | Rule | Kiểm tra |
|---|------|----------|
| 1 | Shared contracts coverage | Mọi API endpoint có Zod schema tương ứng? |
| 2 | Socket event consistency | `WsServerEvent` enum → handler ở cả backend emit và frontend listen? |
| 3 | Route consistency | Frontend routes match backend endpoints? |
| 4 | Role/permission consistency | Backend guards vs Frontend UI conditional rendering |

#### 3. Tiêu chí nghiệm thu
- [ ] Report liệt kê pattern violations với location và suggested fix
- [ ] God Services listed với LOC count và refactoring recommendations
- [ ] Query Keys Factory adoption plan (từ 0% → 100%)

---

### Gate Milestone 4.2
```bash
pnpm lint && pnpm typecheck && pnpm test:all
# Bug report artifact tạo xong
# Architecture consistency report tạo xong
```

---

## Milestone 4.3: Security, Schema & Performance Audit (Teamwork)

> **Mục tiêu:** Audit 3 khía cạnh song song: security, database schema, performance
> **Thực hiện:** `/teamwork-preview` với 6 agents — 3 explorers chạy song song vì scope độc lập
> **Branch:** `audit/m4.3-security-schema-performance`
> **Ước lượng:** ~3–4 giờ

### Agent Assignment

| Role | Agent | Nhiệm vụ |
|------|-------|----------|
| Explorer 1 | Security Auditor | Multi-tenancy isolation, auth, input validation, data exposure |
| Explorer 2 | Schema Auditor | Unused models/enums, missing indexes, data integrity |
| Explorer 3 | Performance Auditor | Slow queries, bundle size, dependency audit |
| Worker 1 | Security Fixer | Fix confirmed security issues (thêm `workspaceId`, auth guards) |
| Worker 2 | Schema & Perf Fixer | Thêm indexes, cleanup deps |
| Reviewer | Verification Reviewer | Verify all fixes |

### Danh sách nhiệm vụ

---

### Task 4.3-01: Security — Multi-Tenancy Isolation (CRITICAL)

#### 1. Mục tiêu & Trải nghiệm Người dùng
Đảm bảo 100% DB queries cho tenant resources có `workspaceId` trong `where` clause. Không có cross-tenant data leak.

#### 2. Quy tắc nghiệp vụ & Bất biến

| # | Kiểm tra | Chi tiết |
|---|----------|----------|
| 1 | **Mọi DB query có `workspaceId`** | Grep `findUnique`, `findFirst`, `findMany`, `update`, `delete` → verify `workspaceId` trong `where` |
| 2 | **Background jobs tenant scoping** | Queue processors, event listeners, scheduled tasks — truyền đúng `workspaceId`? |
| 3 | **Socket room isolation** | WebSocket events chỉ broadcast trong `workspace:{workspaceId}` room? |
| 4 | **File storage tenant isolation** | S3/MinIO paths có prefix `workspaceId`? |
| 5 | **Redis key tenant scoping** | Cache keys, rate limit keys có prefix workspace? |

#### 3. Ranh giới & Điều cấm
- Queries cho system-level resources (User, SystemSetting, PlatformAuditLog) KHÔNG cần `workspaceId`
- `findUnique` trên `@@unique([workspaceId, ...])` composite key là đủ — không cần thêm `workspaceId` riêng

#### 4. Tiêu chí nghiệm thu
- [ ] 0 tenant-scoped queries thiếu `workspaceId` (trừ system-level resources)
- [ ] Socket broadcasts verified: chỉ trong đúng workspace room
- [ ] Report với danh sách mọi violation found + fixed

---

### Task 4.3-02: Security — Authentication & Authorization

#### 1. Mục tiêu & Trải nghiệm Người dùng
Đảm bảo mọi endpoint protected, role guards chính xác, JWT implementation an toàn.

#### 2. Quy tắc nghiệp vụ & Bất biến

| # | Kiểm tra | Chi tiết |
|---|----------|----------|
| 1 | **All endpoints protected** | Mọi route (trừ public: health, webhook, widget) có `JwtAuthGuard` |
| 2 | **Role guards** | `@Roles()` decorator đúng: Agent không access admin endpoints |
| 3 | **JWT security** | Token expiry, refresh flow, cookie flags (HttpOnly, Secure, SameSite) |
| 4 | **Password handling** | Argon2, no plaintext, no password in logs/responses |
| 5 | **Webhook security** | Payment webhooks: API key verify. Facebook: signature verify |
| 6 | **Input validation** | Mọi POST/PUT/PATCH body qua `ZodSchemaValidationPipe` |
| 7 | **No SQL injection** | Check `$queryRaw`, `$executeRaw` usage |
| 8 | **Data exposure** | No password hash, tokens, internal IDs in API responses |
| 9 | **Log redaction** | Pino redaction covers passwords, tokens, credit cards, phones |
| 10 | **Environment secrets** | `.env` in `.gitignore`, no hardcoded secrets in source |

#### 3. Tiêu chí nghiệm thu
- [ ] 0 unprotected endpoints (trừ explicitly public ones)
- [ ] 0 missing role guards trên admin endpoints
- [ ] Report với security findings rated CRITICAL/HIGH/MED/LOW

---

### Task 4.3-03: Database Schema Audit

#### 1. Mục tiêu & Trải nghiệm Người dùng
Đảm bảo Prisma schema sạch, tối ưu, không chứa remnants từ features đã xóa.

#### 2. Quy tắc nghiệp vụ & Bất biến

**Schema Hygiene:**

| # | Kiểm tra | Chi tiết |
|---|----------|----------|
| 1 | **Unused models** | Models không có service/controller nào query |
| 2 | **Unused enum values** | `ChannelType.ZALO`, `.EMAIL`, `.TELEGRAM` — có code xử lý? |
| 3 | **Unused fields** | Columns không được read/write bởi application code |
| 4 | **Migration history** | Migrations có clean? Migration tạo rồi drop cùng table? |

**Index & Performance:**

| # | Kiểm tra | Chi tiết |
|---|----------|----------|
| 5 | **Missing indexes** | Columns thường xuyên trong `where` mà chưa có index |
| 6 | **Composite indexes** | `workspaceId + status`, `workspaceId + createdAt` — có composite index? |
| 7 | **N+1 patterns** | `include`/`select` usage — load quá nhiều relations? |
| 8 | **Cascade delete safety** | `onDelete: Cascade` nào nguy hiểm? |

**Data Integrity:**

| # | Kiểm tra | Chi tiết |
|---|----------|----------|
| 9 | **Required vs Optional** | Fields nên `NOT NULL` nhưng đang nullable? |
| 10 | **Unique constraints** | `(workspaceId, slug)`, `(workspaceId, orderCode)` — đủ chưa? |
| 11 | **Foreign key integrity** | Mọi relation có FK constraint? Orphaned records? |

#### 3. Ranh giới & Điều cấm
- KHÔNG tự động tạo migration — chỉ báo cáo và đề xuất
- Enum values removal cần cân nhắc backward compatibility với data đã tồn tại

#### 4. Tiêu chí nghiệm thu
- [ ] Report với danh sách schema issues, missing indexes, optimization suggestions
- [ ] Mỗi issue có: severity, description, suggested SQL/migration
- [ ] `prisma validate` pass

---

### Task 4.3-04: Performance & Bundle Audit

#### 1. Mục tiêu & Trải nghiệm Người dùng
Phát hiện performance bottlenecks ở backend và frontend, tối ưu bundle size, audit dependencies.

#### 2. Quy tắc nghiệp vụ & Bất biến

**Backend Performance:**

| # | Kiểm tra | Chi tiết |
|---|----------|----------|
| 1 | **Slow queries** | Queries không có `select` (select *), deep `include` nesting |
| 2 | **Memory leaks** | Event listeners không cleanup, growing caches |
| 3 | **Queue config** | BullMQ concurrency, job TTL, stale job cleanup |
| 4 | **Redis usage** | TTL appropriate? Cache invalidation correct? |
| 5 | **WebSocket payload** | Broadcast scope quá rộng? Payload quá lớn? |

**Frontend Performance:**

| # | Kiểm tra | Chi tiết |
|---|----------|----------|
| 6 | **Bundle size** | `@next/bundle-analyzer` — largest chunks |
| 7 | **`'use client'` boundary** | Client components quá lớn? Nên split? |
| 8 | **Image optimization** | `next/image` usage, responsive sizes |
| 9 | **TanStack Query caching** | `staleTime`, `gcTime` appropriate? Over-fetching? |

**Dependency Audit:**

| # | Kiểm tra | Chi tiết |
|---|----------|----------|
| 10 | **Outdated deps** | `pnpm outdated` — security patches? |
| 11 | **Duplicate deps** | Multiple versions of same package? |
| 12 | **Unnecessary deps** | Replace bằng stdlib/native? |
| 13 | **License compliance** | GPL/copyleft in production? |

#### 3. Tiêu chí nghiệm thu
- [ ] Backend: report slow queries, missing `select`, deep includes
- [ ] Frontend: bundle analysis report với largest chunks identified
- [ ] Dependencies: report outdated, duplicate, unnecessary deps
- [ ] `pnpm audit` output documented

---

### Gate Milestone 4.3
```bash
pnpm lint && pnpm typecheck && pnpm test:all
# Security report artifact tạo xong — 0 CRITICAL open
# Schema report artifact tạo xong
# Performance report artifact tạo xong
```

---

## Post-Audit: Ponytail Debt Ledger

> Sau khi tất cả milestones hoàn tất, chạy `ponytail-debt` để thu thập mọi `ponytail:` comment mà quá trình audit/fix để lại.

```bash
# Chạy trong conversation mới:
# Prompt: "ponytail-debt"
```

---

## Execution Playbook

### Trước mỗi Milestone
```bash
# 1. Tạo branch riêng
git checkout -b audit/m4.<N>-<name>

# 2. Ghi nhận baseline metrics
pnpm lint 2>&1 | tee lint-before.txt
pnpm typecheck 2>&1 | tee typecheck-before.txt
pnpm test:all 2>&1 | tee test-before.txt
```

### Sau mỗi Milestone
```bash
# 1. Verify không regression
pnpm lint && pnpm typecheck && pnpm test:all

# 2. So sánh với baseline
# 3. Review report → Approve → merge branch → next milestone
```

### Automation Tools

| Tool | Mục đích | Command |
|------|----------|---------|
| `knip` | All-in-one unused finder | `npx knip` |
| `depcheck` | Unused dependencies | `npx depcheck apps/server` |
| `ts-prune` | Unused exports | `npx ts-prune --project apps/server/tsconfig.json` |
| `madge` | Circular dependencies | `npx madge --circular apps/server/src` |
| `@next/bundle-analyzer` | Bundle analysis | Configure trong `next.config.ts` |

### Mẫu Prompt cho `/teamwork-preview`

```
Audit Milestone 4.<N> — <Tên Milestone>.

## Bối cảnh
Dự án Sales Copilot (Nx monorepo: NestJS backend + Next.js frontend + 3 shared packages).
Đọc docs/backlog/phase-4-codebase-audit.md để hiểu scope và checklist.

## Nhiệm vụ
Thực hiện tất cả Tasks trong Milestone 4.<N>:
- TASK-4.<N>-01: ...
- TASK-4.<N>-02: ...

## Verification
Sau khi hoàn tất: pnpm lint && pnpm typecheck && pnpm test:all
```

---

## Expected Outcomes

| Metric | Mục tiêu |
|--------|----------|
| Dead code removed | 5–15% codebase reduction |
| Bugs discovered | 10–30 bugs across severity levels |
| Type errors | 0 (clean typecheck) |
| Lint errors | 0 errors, <10 warnings |
| Test pass rate | 100% pass, 0 skip, 0 flaky |
| Security — CRITICAL | 0 open |
| Security — HIGH | 0 open |
| Architecture score | Target 95/100 (from 85/100) |
| Unused dependencies removed | 3–8 packages |
