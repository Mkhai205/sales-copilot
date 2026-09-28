# Phase 4 — Decision Log (phỏng vấn remediation, 2026-09-28)

> 8 quyết định đã chốt qua phỏng vấn, đối chiếu M4.4 remediation report §2. Kèm kế hoạch thi hành 5 đợt.

## Quyết định đã chốt

| # | Chủ đề | Quyết định | Chi tiết thi hành |
|---|--------|------------|-------------------|
| D1 | Settings "write-only" | **Dọn chọn lọc** | (a) XÓA: announcements/maintenance tab + keys `system.maintenance_mode/banner_*` (~270 LOC); flags `feature.pos_vietqr_enabled` + `feature.thermal_print_enabled` (feature chưa tồn tại); keys `llm.default_provider/default_model/temperature_default/max_tokens_limit` + AI defaults tab (AI đã config per-inbox qua `aiCommercePolicy`). (b) WIRE: `feature.comment_masking_enabled` gate vào comment-guard dispatch (facebook.controller check `channelSettings.commentGuard?.enabled` AND platform flag). (c) Giữ: `feature.ai_autopilot_enabled`? — XÓA theo cùng logic (dispatcher không đọc nó)... ⚠️ đánh giá lại khi làm: nếu muốn giữ as kill-switch thì wire 1 dòng vào ai-dispatcher. |
| D2 | Dual routing | **Short + header** | Collapse dual-route ở 6 controllers (inventory, orders, products, reconciliation, dashboard, knowledge) — giữ short route + `X-Workspace-Id`; sửa FE API base: orders/inventory/products/reconciliation/dashboard/knowledge. 1 PR mechanical. |
| D3 | God services | **Split ngay, PR riêng** | Top-3 theo arch report: orders → OrderLifecycle/OrderWriter/OrderQuery; inventory-ledger → StockMovement/InventoryQuery + runMovementTx helper; payment-reconciliation → AutoReconciliationMatcher/ManualMatch/Query. Bắt buộc full gate + e2e sau từng service. |
| D4 | WS generic stream | **Bỏ generic emit** | Refactor `test/e2e/helpers/ws-client.ts` (68-69, 315-316) nghe trực tiếp typed events, rồi xóa emit `'event'` trong `broadcastSafe`. Halve WS egress. |
| D5 | Transitive vulns | **Override ngay** | `pnpm.overrides`: `multer@^2.3.0` (multer 2.x API — test upload flow), `mysql2@^3.23.1`, `fast-uri@latest`. Kèm job `pnpm audit` trong CI. |
| D6 | Workspace delete | **Soft-delete only** | Không expose hard-delete; workspace "xóa" = `isSuspended` (đã có). Cascade conflict vô hiệu hóa. Map P2003 → 409 cho các FK Restrict còn lại. |
| D7 | Date format | **Unify 1 chuẩn** | `lib/format-date.ts` bổ sung `formatDate` + `formatDateTime` canonical, thay 8 components (orders-table, order-detail-sheet, stock-ledger-drawer, reconciliation-ledger-table, contact-detail-dialog, contacts-table, audit-log-helpers, workspace-helpers). Chấp nhận thay đổi visual nhỏ. |
| D8 | ESLint guardrails | **Bật + grandfather** | Flat-config: `no-restricted-syntax` chặn `JSXElement` name `button` + `no-restricted-imports` chặn `radix-ui`/`@shadcn/react` ngoài `components/ui`, grandfather 86 files hiện hữu (per-file overrides). Mọi file mới vi phạm → CI đỏ. |

## Mặc định đã áp dụng (không hỏi — low-stakes)

- 31 internal barrels shared-contracts: **giữ nguyên** (5 import sites, churn > value).
- Controller webhook logic extraction (facebook fan-out, payment normalize): **PR riêng** khi chạm vùng ingest.
- RSC-ify page shells, refetchOnWindowFocus tuning, raw img → next/image: **defer** theo lộ trình perf riêng.
- SSRF link-preview + attachments bucket policy: **fix theo kế hoạch bảo mật riêng** (bucket cần migration plan cho fileUrl).

## Kế hoạch thi hành — 5 đợt

| Đợt | Nội dung | Ước lượng |
|-----|----------|-----------|
| 1 — Quick wins | D8 ESLint rules grandfathered · D7 date unify · D5 pnpm.overrides + install + regression upload test · D6 document soft-delete + P2003 map | ~nửa ngày |
| 2 — Dọn settings (D1) | Xóa announcements tab + keys, flags, llm.* + AI defaults tab; wire comment_masking; cập nhật specs + seed | ~nửa ngày |
| 3 — Dual routing (D2) | Collapse 6 controllers + 6 FE API bases | ~nửa ngày |
| 4 — WS stream (D4) | Refactor e2e ws-client → bỏ generic emit | ~2-3h |
| 5 — God services (D3) | Split 3 services, PR riêng, gate từng service | 1-2 ngày |

Gate sau mỗi đợt: `pnpm lint && pnpm typecheck && pnpm test:all`.
