# Plan refactor apps/web — nhóm P1 + P2

Nguyên tắc như đợt backend: mỗi nhóm = 1 commit conventional, sau mỗi nhóm chạy `pnpm lint && pnpm typecheck`; cuối đợt chạy `pnpm test:all` + `pnpm nx build web` + docker build. KHÔNG giữ code cũ/compat shim. Không đụng DB.

Chú ý: server sẽ có 1 thay đổi nhỏ (thêm `workspaceId` vào 2 event emit — mục 3) — đó là **align server với contract đã khai báo** (contracts khai `workspaceId` nhưng dispatcher strip đi), kèm cập nhật test server nếu assert payload.

---

## Fix 1 (P1) — Security & auth UX

1. **Gate test credentials**: `features/auth/components/login-form.tsx` — render `QuickTestAccounts` chỉ khi `process.env.NODE_ENV !== 'production'` (build-time inline, pattern đã có ở auth-actions.ts:18).
2. **401 recovery cho queries**: `providers/query-provider.tsx` thêm `QueryCache({ onError })` — `ApiClientError.status === 401` → redirect `/login?redirect=<pathname+search>`. Bỏ qua redirect khi đã ở `/login` (tránh loop — login page không có query nào nên an toàn).
3. **Hoàn thiện `?redirect=` end-to-end**: proxy.ts đã set param nhưng login bỏ qua. `login/page.tsx` (server) await `searchParams` → truyền prop `redirect` vào LoginForm → `loginAction(redirect)` — server action **validate relative path** (bắt đầu `/`, không `//`) chống open-redirect, redirect đến đó sau login.
4. **Edge JWT constraint note**: comment tường minh tại `isSuperAdmin` usage trong proxy.ts + edge-jwt.ts: "UX gate only — authorization enforced server-side".

## Fix 2 (P2) — Data layer hardening

1. **Timeout/AbortSignal cho `fetchApi`** (lib/api/client.ts): mặc định 15s qua `AbortSignal.timeout`, merge với caller `signal` (`AbortSignal.any`), override được qua option; timeout → `ApiClientError(408, { code: 'REQUEST_TIMEOUT' })` (408 là retryable).
2. **Retry classifier**: `retry: (count, error) => error instanceof ApiClientError && [400,401,403,404,409,422].includes(error.status) ? false : count < 2` — 5xx/network mới retry.
3. **`refetchOnWindowFocus: false`** global (staleTime 30s + socket + polling đã đủ; dashboard hook giữ override true riêng).
4. **Query-key factory đủ tầng**: thêm `platformAdminKeys` (settings/auditLogs/metrics/workspaces — prefix phải khớp chính xác literal `['platform-admin','settings']` mà optimistic update đang dựa), `geoKeys`, `currentUserKeys.me`; migrate đúng 16 bypass site (4 hooks platform-admin, use-current-user, address-cascader ×3, settings/page.tsx, use-platform-workspaces ×4).
5. **Không đổi cấu trúc key list/orders** (prefix invalidation đã đúng; fragmentation chỉ là memory, gcTime 5m dọn).

## Fix 3 (P2) — Socket: typed payloads + reconnect

1. **Typed event map trong shared-contracts** (`src/realtime/events/socket-event-map.ts`): `SocketEventPayloadMap` ánh xạ 39 `DomainEvent` → wire shape thật (post-unwrap `{event,data}`): MESSAGE_* → `MessageResponseDto` / `{conversationId,messageId,workspaceId}`, CONVERSATION_* → DTO hoặc union với event payload (CONVERSATION_ASSIGNED union theo wire thật), ORDER_*/INVENTORY/PAYMENT → payload interfaces có sẵn. Thêm interface còn thiếu vào contracts (MessageCreated/DeliveryStatus/Conversation events đã có ở schemas domain — re-export qua map file).
2. **Server align contract** (2 dòng trong `realtime-event.dispatcher.ts`): `message.deleted` (L93) và `presence` broadcast (L369) thêm `workspaceId` vào data — khớp `MessageDeletedEvent`/`PresenceUpdatedEvent` đã khai trong contracts; cập nhật `realtime-event.dispatcher.spec.ts` nếu assert payload cũ.
3. **`useSocketEvent` typed overload**: `<E extends keyof SocketEventPayloadMap>(event: E, handler: (payload: SocketEventPayloadMap[E]) => void)`; unwrap heuristic `{event,data}` giữ lại như runtime net (documented); migrate toàn bộ call sites (17 handler trong use-realtime-sync + vietqr-chat-card + use-commerce-realtime-sync + typing-users + workspace-socket-sync).
4. **Workspace-scoped cache ops**: ORDER__/INVENTORY — thay blanket `commerceKeys.all` bằng scoped theo `payload.workspaceId` (orders + inventory + reconciliation keys); MESSAGE_CREATED list-set và CONVERSATION__ invalidate thêm predicate `workspaceId` (MESSAGE_DELETED + PRESENCE giờ có workspaceId sau mục 2).
5. **Reconnect resilience** (socket-provider): `visibilitychange` + `window online` → nếu disconnected và chưa vượt auth-cap → `connect()`; xử lý `reconnect_failed` (revive + status); **auth refresh cap 2 lần** (reset khi connect thành công) — vượt cap thì status `'error'` + code, dừng vòng refresh→connect; xóa nhánh `connect_error` string-matching (server emit custom `'error'` event — dead code đã verify).

## Fix 4 (P2) — WorkspaceContext

1. `src/providers/workspace-provider.tsx` (client): mount trong `app/(workspace)/[workspaceSlug]/layout.tsx` bao header + children; bên trong dùng `useWorkspaces()` 1 lần; expose `{ workspaceSlug, workspaceId, workspace, role, isLoading }`; hook `useWorkspaceContext()` throw nếu dùng ngoài subtree (an toàn — 0 consumer ngoài (workspace), đã grep verify).
2. **Migrate ~28 consumer files**: 24 file chỉ cần id (toàn bộ commerce/contacts/conversations hooks + views) + role consumers (reconciliation-view, use-settings-rbac, workspace-header) + object consumer (tab-ai-settings) + message-thread (xóa fallback chain L812-817) + workspace-socket-sync. `useWorkspaces` query chỉ còn provider dùng. Drop defensive `workspaces?.[0]?.id`.

## Fix 5 (P2) — DataTable trên TanStack Table

1. Thêm `@tanstack/react-table` vào apps/web.
2. `src/components/data-table/data-table.tsx`: generic trên TanStack `useReactTable` (`getCoreRowModel`, manualPagination); props: `columns: ColumnDef<T>[]`, `data`, `getRowKey`, `isLoading` (skeleton rows), `emptyState {icon,title,description,action}`, `pagination {page,totalPages,total?,onPageChange,isLoading?}`, `renderExpanded?` (cho products-table expandable variants). Cell renderers giữ nguyên JSX hiện có (badge/link/copy/dropdown). Kèm `src/hooks/use-copy-to-clipboard.ts` thay 4-5 bản copy `copiedId + setTimeout`.
3. **Migrate 10 bảng**: orders, reconciliation-ledger, contacts, audit-logs, workspaces, inventory-variants, knowledge-article, canned-responses, labels, members + products-table (renderExpanded). `workspace-detail-view` giữ nguyên (không phải data table).
4. Output render giữ nguyên như cũ — risk kiểm soát bằng typecheck + smoke thủ công.

## Fix 6 (P2) — Split message-thread + load older messages

1. **Split 965 dòng thành 9 file** trong cùng folder `thread/` theo naming `message-*` sẵn có: `message-format.ts` (formatTime/FileSize), `message-text.tsx`, `message-delivery-status.tsx`, `message-file-attachments.tsx`, `message-link-preview.tsx` (nguyên khối, prop-driven), `message-item.tsx` (~360 dòng, 4 variant renderer), `thread-scroll-controller.tsx` (render-null controller, giữ vì phụ thuộc MessageScroller context), `message-thread-loading.tsx`, `hooks/use-lightbox.ts`. `message-thread.tsx` còn ~200 dòng. Props đã prop-shaped sẵn — không đổi behavior.
2. **Load older messages**: `useMessages` đã là infinite query đầy đủ (chỉ chưa dùng `fetchNextPage`). Thêm nút "Tin nhắn cũ hơn" đầu scroller (hiện khi `hasNextPage`), scroll anchoring: bám `scrollHeight` delta khi prepend trong scroll controller.

## Verify cuối

1. `pnpm lint && pnpm typecheck && pnpm nx test shared-contracts && pnpm test:all` (server tests dispatcher cập nhật nếu assert payload).
2. `pnpm nx build web` (Next standalone build bắt lỗi client/server boundary).
3. Docker build local (web Dockerfile đã fix từ đợt trước) — CI docker job chốt.
4. Số liệu verify: typecheck 5/5 projects, không còn inline queryKey ngoài factory, không còn blanket commerceKeys.all invalidate, 0 `useEffect(fetch)`.
5. Ghi chú cho user: smoke thủ công UI (đăng nhập, chat, orders table, admin) sau deploy — vì 12 bảng đổi implementation render.
6. Cập nhật memory.

**Phạm vi loại trừ (backlog, đã thống nhất):** 5 god file còn lại (web-chat-preview, conversation-filter-popover, product-dialog, facebook-config, chat-composer), virtualization dài hạn, i18n, P3 token/consistency sweep.
