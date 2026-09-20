# BÁO CÁO KIỂM TOÁN KIẾN TRÚC TOÀN DIỆN HỆ THỐNG SALES COPILOT
## Comprehensive Master Architecture Audit Report

- **Dự án:** Sales Copilot (Omnichannel Conversational Commerce Monorepo)
- **Ngày lập báo cáo:** 2026-09-20
- **Phiên bản tài liệu:** 1.0.0-FINAL
- **Phạm vi kiểm toán:** `packages/shared-contracts`, `apps/server`, `apps/web`
- **Chế độ kiểm toán:** READ-ONLY (Tuân thủ nghiêm ngặt tính toàn vẹn mã nguồn, không sửa đổi source code)
- **Tài liệu quy chuẩn đối chiếu:** `AGENTS.md`, `ORIGINAL_REQUEST.md`, NestJS / Next.js 16 App Router / Prisma ORM / TanStack Query v5 / Shadcn UI Best Practices

---

## 1. Tóm tắt Điều hành & Điểm số Sức khỏe Kiến trúc (Executive Summary & Architecture Health Score)

### 1.1 Đánh giá Chung

Hệ thống **Sales Copilot** được xây dựng trên một ngăn xếp công nghệ hiện đại và có tiềm năng mở rộng cao: Monorepo quản lý qua Nx/pnpm, Core Backend dùng NestJS 11 kết hợp Prisma ORM và Redis/BullMQ, Frontend Web ứng dụng Next.js 16.3 (App Router), React 19, Tailwind CSS v4, TanStack Query v5 và Shadcn UI primitives, cùng gói dùng chung `packages/shared-contracts` với Zod để định nghĩa schema.

Tuy nhiên, đợt kiểm toán kiến trúc chuyên sâu toàn diện trên toàn bộ 4 trụ cột đã phát hiện ra **nhiều vết rạn nứt cấu trúc nghiêm trọng (structural fissures)**, bao gồm **1 lỗi blocker cấp độ Critical làm tê liệt hoàn toàn giao diện Commerce**, **4 lỗ hổng rò rỉ Multi-Tenancy trong background processing và contact merge**, **nguy cơ nghẽn connection pool và mất dữ liệu thanh toán do race condition**, cùng **tình trạng phân mảnh routing và vi phạm các nguyên tắc thiết kế cốt lõi trong AGENTS.md (Anti-Over-Engineering, KISS & YAGNI)**.

### 1.2 Bảng điểm Sức khỏe Kiến trúc theo 4 Trụ cột

| Trụ cột Kiến trúc (Pillar) | Trọng số | Điểm số (Thang 100) | Trạng thái Đánh giá | Tóm lược Đánh giá Rủi ro |
|---|:---:|:---:|:---:|---|
| **Trụ cột 1: Shared-Contracts & Chuẩn hóa Type (R1)** | 25% | **65 / 100** | ⚠️ Nguy cơ cao | Schema drift giữa Prisma và Zod (`Order.paymentMethod`), cạm bẫy `z.coerce.number()` trong mutation body làm âm thầm biến `null` thành `0`, rò rỉ logic runtime và queue names vào shared package. |
| **Trụ cột 2: Core Backend & Strict Multi-Tenancy (R2)** | 30% | **61 / 100** | 🚨 Rất nghiêm trọng | Lỗ hổng Multi-tenancy do gọi `update`/`delete` theo `id` đơn lẻ; MinIO/S3 upload nằm trong database transaction; BullMQ `jobId` trùng lặp giữa các tenant; 17 God Services (>300 LOC). |
| **Trụ cột 3: Frontend Web & Quản lý State (R3)** | 25% | **68 / 100** | ⚠️ Cần tái cấu trúc | Thiếu Query Keys Factory dẫn đến phân mảnh cache; lệch prefix làm vô hiệu hóa realtime invalidation; lạm dụng `'use client'` ở root layouts; 73+ nút bấm tự chế bỏ qua Shadcn UI. |
| **Trụ cột 4: Giao tiếp Hệ thống & Routing (R4)** | 20% | **62 / 100** | 🚨 Blocker sản xuất | **Critical Blocker:** Response envelope mismatch giữa `TransformInterceptor` và `commerceApi` khiến toàn bộ bảng Orders/Products/Inventory bị rỗng (`[]`); phân mảnh 4 kiểu routing và xung đột Slug vs UUID. |
| **ĐIỂM TỔNG HỢP HỆ THỐNG (SYSTEM OVERALL)** | **100%** | **64 / 100** | ⚠️ **CẦN TẬP TRUNG TÁI CẤU TRÚC THEO GIAI ĐOẠN** |

### 1.3 Điểm mạnh Cốt lõi (Core Strengths)
1. **Phân vùng Module rõ ràng:** Kiến trúc phân rã rõ rệt giữa Identity, Omnichannel, Commerce và Realtime.
2. **Cơ chế Cô lập WebSocket Room vững chắc:** `RealtimeGateway` kiểm tra tư cách thành viên tenant (`join_workspace`) rất chặt chẽ, xử lý chủ động sự kiện đình chỉ workspace (`handleWorkspaceSuspended`) để thu hồi quyền truy cập.
3. **Thư viện UI Primitives phong phú:** `apps/web/src/components/ui/` tích hợp đầy đủ 40 primitives chất lượng cao của Shadcn UI theo quy chuẩn Tailwind v4.

### 1.4 Rủi ro Cấu trúc Bao trùm (Overarching Structural Risks)
1. **Lỗi Rỗng Dữ liệu Thương mại (Silent UI Breakdown):** Toàn bộ giao diện Thương mại (Orders, Products, Inventory, Stock Ledger) không thể hiển thị dữ liệu vì client đọc `data?.items` trong khi backend interceptor đã unwrap thành `data: items`.
2. **Vi phạm Nguyên tắc Bất biến Multi-Tenancy (AGENTS.md Rule 3):** Nhiều câu lệnh cập nhật/xóa dữ liệu chạy ngầm trong queue hoặc service không gắn kèm `workspaceId`, tiềm ẩn nguy cơ thao tác nhầm trên dữ liệu của tenant khác.
3. **Nghẽn Tài nguyên Cơ sở Dữ liệu do Side-effects:** Tiến trình upload file qua mạng tới MinIO/S3 được thực thi trực tiếp bên trong Prisma `$transaction`, chiếm giữ kết nối database pool trong nhiều giây.
4. **Vi phạm Nguyên tắc Đơn giản hóa (Anti-Over-Engineering):** Xuất hiện 7 file DTO Mapper trung gian vô nghĩa và 17 God Services cồng kềnh (điển hình `OrdersService` 1,208 dòng, `InventoryLedgerService` 949 dòng).

---

## 2. Bảng Ma trận Vấn đề Toàn diện theo Mức độ Nghiêm trọng (Master Issue Matrix)

Dưới đây là bảng tổng hợp toàn bộ 27 vấn đề kiến trúc được phân loại theo thứ tự ưu tiên: **Critical (Blocker/Bảo mật/Rò rỉ dữ liệu)**, **High (Sai lệch hợp đồng/Hiệu năng/God Services)**, **Medium (Vi phạm KISS/Phân mảnh mã nguồn)**, và **Low (Quy ước/Clean code)**.

| Mã Vấn đề (ID) | Mức độ (Severity) | Phân loại | Vị trí Vi phạm (File & Dòng) | Bản chất Vấn đề | Tác động Hệ thống |
|---|:---:|:---:|---|---|---|
| **CRIT-01** | **Critical** | IPC / UI | `apps/server/src/common/interceptors/transform.interceptor.ts:37-44`<br>`apps/web/src/features/commerce/api/commerce-client.ts:128`<br>`apps/web/src/features/commerce/components/orders-view.tsx:90` | `TransformInterceptor` unwrap `{ items, meta }` thành `data: items`. `commerce-client.ts` lại gán type `{ items, meta }`, khiến `orders-view`, `products-view`, `inventory-view`, `stock-ledger-drawer` đọc `data?.items` bị `undefined`. | **BLOCKER SẢN XUẤT:** Toàn bộ bảng Orders, Products, Inventory, Stock Ledger trên Web UI bị rỗng (`[]`), tê liệt nghiệp vụ bán hàng. |
| **CRIT-02** | **Critical** | Multi-Tenancy | `apps/server/src/modules/omnichannel/contacts/contacts.service.ts:540-553` | Cập nhật `Conversation` khi giải quyết trùng lặp contact (`contact_merge_collision`) chỉ dùng `where: { id: older.id }` mà không có `workspaceId`. | **Rò rỉ dữ liệu chéo tenant:** Có thể update nhầm hội thoại của workspace khác nếu ID bị trùng hoặc giả mạo. |
| **CRIT-03** | **Critical** | Multi-Tenancy | `apps/server/src/infrastructure/queue/channel-ingestion.processor.ts:229-234` | Background Worker cập nhật trạng thái tin nhắn `deliveryStatus` qua lệnh `message.update({ where: { id: existingMessage.id } })` không có `workspaceId`. | **Rò rỉ dữ liệu chéo tenant:** Tiến trình nền sửa đổi bản ghi ngoài phạm vi tenant. |
| **CRIT-04** | **Critical** | Concurrency | `apps/server/src/modules/omnichannel/messages/messages.service.ts:238`<br>`apps/server/src/modules/omnichannel/messages/attachments.service.ts:155` | Gọi upload file qua mạng tới MinIO/S3 (`storageService.upload`) ngay bên trong khối Prisma `$transaction`. | **Nghẽn Pool Database:** Khóa hàng và giữ kết nối DB hàng giây; nếu S3 lỗi thì file bị mồ côi và DB bị rollback lãng phí. |
| **CRIT-05** | **Critical** | Multi-Tenancy | `apps/server/src/modules/omnichannel/integrations/facebook/facebook.service.ts:633-635` | Khi ngắt kết nối kênh Facebook, gọi `channel.delete({ where: { id } })` và `inbox.delete({ where: { id } })` mà không dùng compound key `workspaceId_id`. | **Rò rỉ bảo mật:** Xóa nhầm tài nguyên của workspace khác nếu ID không được kiểm chứng phạm vi. |
| **HIGH-01** | **High** | Contract / DB | `apps/server/prisma/schema.prisma:604-667`<br>`packages/shared-contracts/src/commerce/orders/order.schemas.ts:82, 175`<br>`apps/server/src/modules/commerce/orders/orders.service.ts:154, 487, 1307` | `model Order` trong PostgreSQL không có cột `paymentMethod`, trong khi Shared-Contracts định nghĩa bắt buộc. Backend phải lưu tạm vào `metadata` JSON hoặc đọc từ transaction con. | **Mất toàn vẹn dữ liệu:** Không thể đánh index hoặc lọc đơn hàng theo phương thức thanh toán; nguy cơ crash hoặc mất dữ liệu khi metadata bị ghi đè. |
| **HIGH-02** | **High** | Contract / Logic | `packages/shared-contracts/src/commerce/**/*.schemas.ts`<br>(inventory:7, payment:8, product:29-31, order:45-47, 83, 86, 142) | Sử dụng `z.coerce.number()` trong JSON Mutation Request Body (POST/PUT). | **Sai lệch dữ liệu tài chính:** `Number(null)`, `Number("")`, `Number(false)` bị ép ngầm thành `0`, `Number(true)` thành `1`. Bỏ lọt lỗi validation, làm sai giá tiền và tồn kho. |
| **HIGH-03** | **High** | Concurrency | `apps/server/src/modules/commerce/webhooks/payment-webhooks.controller.ts:108` | BullMQ deduplication key `jobId = `${gateway}:${txId}`` trên Redis dùng chung không có tiền tố `workspaceId`. | **Mất dữ liệu đối soát:** Hai workspace nhận thanh toán có cùng mã giao dịch ngân hàng sẽ khiến job của workspace thứ hai bị BullMQ hủy bỏ. |
| **HIGH-04** | **High** | Concurrency | `apps/server/src/modules/commerce/reconciliation/payment-reconciliation.service.ts:76-80, 158` | Kiểm tra tồn tại qua `findFirst`, sau đó gọi `create`. Hai webhook đồng thời vượt qua check sẽ làm `create` ném lỗi `P2002` mà không được catch. | **Lỗi 500 Unhandled:** Server crash trả về HTTP 500 cho cổng thanh toán thay vì phản hồi idempotency an toàn. |
| **HIGH-05** | **High** | Error Handling | `apps/server/src/common/filters/http-exception.filter.ts:32-73`<br>`apps/server/src/main.ts:39` | Hệ thống thiếu Filter chuyên biệt cho Prisma. Lỗi `P2025` (Record not found) rơi vào nhánh generic `Error`, trả về 500 và làm lộ câu lệnh SQL nội bộ ở chế độ dev. | **Lỗ hổng bảo mật & Trải nghiệm tồi:** Lộ cấu trúc database; trả về mã 500 cho lỗi người dùng thông thường (404/409). |
| **HIGH-06** | **High** | State / Socket | `apps/web/src/lib/socket/use-realtime-sync.ts:463-471`<br>`apps/web/src/features/commerce/hooks/use-active-conversation-order.ts:18` | Socket listener gọi `invalidateQueries({ queryKey: ['active-conversation-order', conversationId] })`, trong khi query key thực tế là `[..., workspaceId, conversationId, contactId]`. | **Mất đồng bộ Realtime:** Prefix match của TanStack Query tại vị trí index 1 so sánh `conversationId` với `workspaceId` luôn ra `false`. Đơn hàng chat không tự cập nhật. |
| **HIGH-07** | **High** | State / Cache | `apps/web/src/features/commerce/hooks/use-commerce-orders.ts:18-28`<br>`apps/web/src/lib/socket/use-realtime-sync.ts:481-484` | Tạo đơn hàng mới hoặc nhận event `INVENTORY_UPDATED` không hề invalidate `inventory-variants`, `inventory-summary`, hay `inventory-transactions`. | **Dữ liệu Tồn kho Bị Cũ (Stale State):** Nhân viên tạo đơn hàng xong nhưng màn hình Tồn kho vẫn hiển thị số lượng cũ cho tới khi F5 lại trang. |
| **HIGH-08** | **High** | Kiến trúc KISS | `apps/server/src/modules/**` (17 service files vượt 300 LOC) | Tồn tại 17 "God Services" nhồi nhét quá nhiều trách nhiệm (tiêu biểu `orders.service.ts` 1,208 LOC, `inventory-ledger.service.ts` 949 LOC, `conversations.service.ts` 789 LOC). | **Khó bảo trì & Rủi ro hồi quy:** Vi phạm nghiêm trọng Single Responsibility Principle, dễ phát sinh lỗi chéo khi sửa đổi logic. |
| **HIGH-09** | **High** | Kiến trúc KISS | `apps/server/src/modules/commerce/payments/vietqr.controller.ts:48-76`<br>`web-chat.controller.ts:216-320`<br>`facebook.controller.ts:447-535` | 3 Controllers trực tiếp inject `PrismaService` và thực hiện các câu truy vấn database và điều phối tin nhắn phức tạp. | **Vi phạm AGENTS.md Mục 2:** Phá vỡ mô hình Controller -> Service -> Prisma, làm bypass các tầng guard và validate của service. |
| **HIGH-10** | **High** | Routing / IPC | `apps/server/src/modules/identity/workspaces/guards/workspace.guard.ts:89`<br>`apps/server/src/modules/**` (Controllers) | Backend phân mảnh 4 kiểu routing khác nhau; `WorkspaceGuard` chỉ chấp nhận UUID, trong khi Web UI định tuyến bằng `workspaceSlug`. | **Xung đột định tuyến:** Mọi trang frontend phải thực hiện round-trip tìm UUID từ slug; chặn việc dùng URL trực tiếp. |
| **HIGH-11** | **High** | Render SSR | `apps/web/src/app/(workspace)/layout.tsx:1`<br>`apps/web/src/app/(platform-admin)/platform-admin/layout.tsx:1`<br>`apps/web/src/app/(workspace)/[workspaceSlug]/(overview)/dashboard/page.tsx:1-24` | Đặt `'use client'` ở root workspace layout và platform admin layout; kiểm tra role và điều hướng trong `useEffect` ở trang dashboard. | **Suy giảm hiệu năng Next.js:** Mất khả năng Server-side streaming và fetch dữ liệu tại server; gây giật layout (layout shift) và chớp trắng khi redirect. |
| **MED-01** | **Medium** | Socket / IPC | `packages/shared-contracts/src/realtime/events/schemas.ts:11-12, 45-46`<br>`apps/server/src/modules/realtime/realtime-event.dispatcher.ts:507` | Enum `DomainEvent` và `WsServerEvent` trùng lặp và xung đột alias; `RealtimeEventDispatcher.broadcastSafe` phát thiếu `workspaceId` và `timestamp` trong envelope. | **Sai lệch giao thức Realtime:** Client phải viết code bóc tách fallback (`use-socket.ts:38-44`); nguy cơ nghe nhầm event bị đổi tên. |
| **MED-02** | **Medium** | Contract / Type | `packages/shared-contracts/src/realtime/events/event-payloads.ts:157-262` | Các event thương mại (`OrderCreatedEventPayload`, `OrderUpdatedEventPayload`, v.v.) định nghĩa `order: Record<string, unknown>`. | **Mất Type Safety:** Client nhận event không thể đọc `order.id` hay `order.status` mà không phải ép kiểu mù quáng (`as any`). |
| **MED-03** | **Medium** | Kiến trúc KISS | `apps/server/src/modules/*/*.mapper.ts` (7 files mapper độc lập) | Tạo 7 tầng mapper thủ công sao chép 1:1 thuộc tính từ Prisma sang DTO và chuyển Date thành string. | **Vi phạm AGENTS.md Mục 2:** Tạo layer thừa thãi không cần thiết (Over-Engineering), gây tốn bộ nhớ và công sức bảo trì. |
| **MED-04** | **Medium** | State / Cache | `apps/web/src/features/**/hooks/*` (Toàn bộ hooks) | Thiếu Query Keys Factory tập trung, dẫn đến việc các feature khác nhau đặt key bất nhất cho cùng một resource (`canned-responses`, `teams`, `members`). | **Phân mảnh Cache:** Sửa đổi dữ liệu ở trang Settings không làm mới dữ liệu trên thanh công cụ chat hay thông tin chi tiết. |
| **MED-05** | **Medium** | UI / Shadcn | `apps/web/src/features/conversations/conversation-filter-popover.tsx`<br>`image-lightbox-dialog.tsx`<br>`conversation-active-chips.tsx` | Sử dụng 73+ thẻ `<button>` trần, tự tạo wrapper cho thẻ `<input>`, import trực tiếp Radix Dialog thay vì dùng component Shadcn đã có. | **Vi phạm AGENTS.md Mục 4:** Mất đồng bộ giao diện, thiếu hiệu ứng focus-visible và khả năng hỗ trợ bàn phím/a11y chuẩn mực. |
| **MED-06** | **Medium** | State / React | `apps/web/src/features/conversations/message-thread.tsx:795-822`<br>`apps/web/src/features/commerce/components/address-cascader.tsx:50-103` | Gọi API `resetUnread` và gọi fetch 3 cấp địa giới hành chính bằng `useEffect` + `useState`, tự viết cache module singleton trong `vietnam-address.ts`. | **Vi phạm AGENTS.md Mục 4:** Tự phát minh lại cache, không quản lý được vòng đời, dễ sinh race condition khi chuyển đổi nhanh hội thoại. |
| **MED-07** | **Medium** | Contracts | `apps/server/src/modules/omnichannel/integrations/facebook/facebook.dto.ts`<br>`apps/web/src/features/settings/api/facebook.ts` | Tự định nghĩa DTO và interface Facebook ở 2 đầu server và web riêng lẻ, không đưa vào `packages/shared-contracts`. | **Phá vỡ Single Source of Truth:** Khi backend sửa tham số, frontend không báo lỗi lúc build mà âm thầm gãy lúc chạy. |
| **MED-08** | **Medium** | Multi-Tenancy | `apps/server/src/modules/omnichannel/messages/attachments.service.ts:214`<br>`inboxes.service.ts:626`<br>`auto-assignment.service.ts:165` | Xóa attachment theo `messageId`, xóa `inboxMember` theo `id`, lấy danh sách agent theo `inboxId` thiếu join kiểm tra `workspaceId`. | **Nguy cơ rò rỉ tenant tiềm ẩn:** Dữ liệu có thể bị rò rỉ nếu đầu vào hàm service nhận ID ngoài phạm vi. |
| **MED-09** | **Medium** | Concurrency | `apps/server/src/modules/commerce/inventory/inventory-ledger.service.ts:481-525, 692-768` | Đọc `previousStock` bằng `findFirst` thông thường trước khi chạy raw SQL `$executeRaw`, không có khóa dòng `FOR UPDATE`. | **Lệch số liệu sổ cái (Ledger Skew):** Khi nhiều giao dịch diễn ra đồng thời, số liệu snapshot ghi nhận trong lịch sử có thể bị lệch so với tồn kho thực tế. |
| **LOW-01** | **Low** | Clean Code | `packages/shared-contracts/src/commerce/enums.ts:77`<br>`inboxes/schemas.ts:54-60`<br>`intelligence/index.ts:3` | Tên BullMQ queue (`*_QUEUE`), thuật toán regex bóc tách số điện thoại, và mẫu câu trả lời tin nhắn mặc định bị nhét vào Shared Contracts. | **Rò rỉ hạ tầng:** Gói hợp đồng dùng chung cho trình duyệt bị phình to và dính líu đến chi tiết triển khai phía máy chủ. |
| **LOW-02** | **Low** | Styling | `apps/web/src/features/conversations/conversation-active-chips.tsx:144`<br>`message-thread-header.tsx:127`<br>`vietqr-dialog.tsx:82` | Sử dụng mã màu cứng `text-slate-400`, `bg-slate-400`, `text-gray-500` thay vì semantic tokens (`text-muted-foreground`, `bg-muted`). | **Lỗi giao diện Dark Mode:** Các thành phần này không tự động đổi sắc thái mượt mà theo cấu hình theme. |
| **LOW-03** | **Low** | Validation | `packages/shared-contracts/src/omnichannel/contacts/schemas.ts:11`<br>`packages/shared-contracts/src/commerce/orders/order.schemas.ts:20` | `createContactSchema` bắt buộc chuẩn quốc tế E.164 (`+84...`), trong khi `order.schemas` chấp nhận đầu số `09...`. | **Không nhất quán:** Số điện thoại nhập ở đơn hàng hợp lệ nhưng tạo liên hệ khách hàng lại bị từ chối. |
| **LOW-04** | **Low** | Type Quality | `packages/shared-contracts/src/commerce/products/product.schemas.ts:64`<br>`packages/shared-contracts/src/commerce/orders/order.schemas.ts:204-205` | DTO viết tay dùng kiểu union `price: number | string`, `createdAt: Date | string`, và mảng `any[]`. | **Suy giảm trải nghiệm lập trình:** Lập trình viên frontend phải liên tục parse `Number(variant.price)` để phòng ngừa lỗi. |

---

## 3. Phân tích Chi tiết Từng Phát hiện (Detailed Findings R1 - R4)

---

### Trụ cột 1 (R1): Kiểm toán Shared-Contracts (`packages/shared-contracts`)

#### [ISSUE-R1-01 / HIGH-01]: Sai lệch Cấu trúc Schema (Schema Drift) giữa Prisma và Shared-Contracts đối với `Order.paymentMethod`
- **Vị trí tệp & Dòng vi phạm:**
  - `apps/server/prisma/schema.prisma` (Dòng 604–667)
  - `packages/shared-contracts/src/commerce/orders/order.schemas.ts` (Dòng 82, 104, 175)
  - `apps/server/src/modules/commerce/orders/orders.service.ts` (Dòng 154–155, 483–487, 879–880, 1056–1058, 1307–1309)
- **Chuỗi Bằng chứng & Phân tích Kỹ thuật:**
  Trong file schema hợp đồng `order.schemas.ts`:
  ```typescript
  // Dòng 82: Bắt buộc trong DTO tạo đơn
  paymentMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.COD),
  // Dòng 175: Bắt buộc trong DTO trả về cho client
  export interface OrderResponseDto {
    ...
    paymentMethod: PaymentMethod;
  }
  ```
  Tuy nhiên, khi kiểm tra `model Order` trong cơ sở dữ liệu `schema.prisma`:
  Bảng `Order` hoàn toàn **KHÔNG CÓ CỘT `paymentMethod`**. Kiểu enum `PaymentMethod` chỉ tồn tại duy nhất ở bảng con `PaymentTransaction` (Dòng 703).
  Hệ quả là lập trình viên backend đã phải viết một loạt các đoạn mã "chữa cháy" (workaround) cực kỳ nguy hiểm trong `orders.service.ts`:
  ```typescript
  // Dòng 154-155: Ép kiểu thô bạo từ metadata
  dto.paymentMethod || ((dto.metadata as any)?.paymentMethod as PaymentMethod) || PaymentMethod.COD

  // Dòng 1307-1309: Đọc chắp vá từ metadata hoặc giao dịch con đầu tiên
  paymentMethod:
    ((order.metadata as Record<string, any>)?.paymentMethod as PaymentMethod) ||
    (order.paymentTransactions?.[0]?.paymentMethod as PaymentMethod) ||
    PaymentMethod.COD,
  ```
- **Phân tích Rủi ro:**
  1. Không thể đánh index `[workspaceId, paymentMethod]` trong cơ sở dữ liệu. Bất kỳ truy vấn lọc đơn hàng theo phương thức thanh toán (COD vs Chuyển khoản VietQR) đều buộc phải quét toàn bảng hoặc join phức tạp.
  2. Dữ liệu trong trường JSON `metadata` không được đảm bảo ràng buộc toàn vẹn. Nếu `metadata` bị ghi đè trong các thao tác cập nhật đơn hàng khác, thông tin phương thức thanh toán sẽ biến mất hoặc trả về giá trị mặc định sai lệch (`COD`).
- **Giải pháp Đề xuất theo KISS & AGENTS.md:**
  Bổ sung trực tiếp cột `paymentMethod PaymentMethod @default(COD)` vào `model Order` trong `schema.prisma`. Đánh index `@@index([workspaceId, paymentMethod])`. Loại bỏ toàn bộ các dòng ép kiểu từ `metadata` trong `orders.service.ts`.

---

#### [ISSUE-R1-02 / HIGH-02]: Cạm bẫy `z.coerce.number()` trong JSON Mutation Request Bodies
- **Vị trí tệp & Dòng vi phạm:**
  - `packages/shared-contracts/src/commerce/inventory/inventory.schemas.ts` (Dòng 7)
  - `packages/shared-contracts/src/commerce/payments/payment.schemas.ts` (Dòng 8)
  - `packages/shared-contracts/src/commerce/products/product.schemas.ts` (Dòng 29, 30, 47, 48, 49, 85, 86, 103, 104)
  - `packages/shared-contracts/src/commerce/orders/order.schemas.ts` (Dòng 45, 46, 47, 83, 86, 105, 108, 142)
- **Chuỗi Bằng chứng & Phân tích Kỹ thuật:**
  Trong các Zod schema cho các phương thức POST/PUT nhận JSON body, xuất hiện việc dùng `z.coerce.number()`:
  ```typescript
  // inventory.schemas.ts:7
  export const stockAdjustmentSchema = z.object({
    quantity: z.coerce.number().int(), ...
  });
  // product.schemas.ts:29-31
  export const createProductVariantSchema = z.object({
    price: z.coerce.number().min(0),
    costPrice: z.coerce.number().min(0).optional(),
    stockQuantity: z.coerce.number().int().min(0).default(0),
  });
  // order.schemas.ts:83, 86
  discountAmount: z.coerce.number().min(0).default(0),
  shippingFee: z.coerce.number().min(0).default(0),
  ```
  Trong đặc tả của JavaScript và Zod: hàm ép kiểu `Number(val)` hoạt động như sau:
  - `Number(null) === 0`
  - `Number("") === 0`
  - `Number(false) === 0`
  - `Number([]) === 0`
  - `Number(true) === 1`
- **Phân tích Rủi ro:**
  Nếu một client gửi request JSON chứa `costPrice: null` hoặc `discountAmount: ""` hoặc truyền nhầm boolean `isFreeShipping: true` vào trường số, Zod sẽ **không báo lỗi validate**. Thay vào đó, nó âm thầm biến `null` thành số `0` hoặc biến `true` thành số `1`. Điều này dẫn đến nguy cơ sai lệch số liệu kế toán, tính toán sai chiết khấu và thất thoát tồn kho mà hệ thống không hề ghi nhận cảnh báo.
- **Giải pháp Đề xuất theo KISS & AGENTS.md:**
  Tuân thủ quy tắc phân lập nghiêm ngặt:
  - Đối với JSON Request Body: Tuyệt đối chỉ dùng `z.number()`. Nếu trường là tùy chọn cho phép rỗng, định nghĩa rõ ràng `z.number().nullable().optional()`.
  - Đối với URL Query/Param (chuỗi string): Chỉ ở đây mới được phép dùng `z.coerce.number()` cho các tham số như `page`, `limit`.

---

#### [ISSUE-R1-03 / MED-01 & LOW-01]: Rò rỉ Logic Runtime, Queue Names và Phân mảnh Enum trong Shared Contracts
- **Vị trí tệp & Dòng vi phạm:**
  - `packages/shared-contracts/src/commerce/enums.ts` (Dòng 77)
  - `packages/shared-contracts/src/intelligence/index.ts` (Dòng 3)
  - `packages/shared-contracts/src/omnichannel/inboxes/schemas.ts` (Dòng 54–60)
  - `packages/shared-contracts/src/common/phone.ts` (Dòng 22–61)
  - `packages/shared-contracts/src/realtime/events/schemas.ts` (Dòng 11–12, 45–46)
- **Chuỗi Bằng chứng & Phân tích Kỹ thuật:**
  1. Hằng số tên hàng đợi xử lý ngầm (BullMQ Queues) của backend bị xuất khẩu trong shared-contracts:
     `COMMERCE_RECONCILIATION_QUEUE = 'commerce-reconciliation'`, `AI_AUTOPILOT_QUEUE = 'ai-autopilot'`, `COMMENT_GUARD_QUEUE = 'comment-guard'`.
  2. Mẫu tin nhắn chat trả lời tự động mặc định (`DEFAULT_COMMENT_GUARD_PRIVATE_REPLY`, `DEFAULT_COMMENT_GUARD_PUBLIC_REPLY`) bị hardcode trong hợp đồng schema.
  3. Thuật toán chuẩn hóa chuỗi và số điện thoại phức tạp (`normalizeVietnamesePhone`, `extractVietnamesePhoneNumbers`, `normalizeSku`) nằm trong shared contract.
  4. Trùng lặp và lệch alias trong sự kiện realtime:
     Tồn tại song song cả `DomainEvent` và `WsServerEvent`; trong đó `schemas.ts` định nghĩa cả `CONVERSATION_STATUS_CHANGED = 'conversation.status_changed'` lẫn `CONVERSATION_STATUS_UPDATED = 'conversation.status_updated'`; `PRESENCE_UPDATE = 'presence.update'` lẫn `PRESENCE_UPDATED = 'presence.updated'`.
- **Phân tích Rủi ro:**
  Làm phình kích thước bundle tải về của Web client; tạo sự gắn kết lỏng lẻo nguy hiểm giữa browser và cấu trúc hạ tầng ngầm phía server; các client socket lắng nghe nhầm alias sự kiện dẫn đến việc giao diện người dùng không nhận được tín hiệu cập nhật.
- **Giải pháp Đề xuất theo KISS & AGENTS.md:**
  - Chuyển toàn bộ hằng số Queue sang `apps/server/src/infrastructure/queue/queue.constants.ts`.
  - Hợp nhất `WsServerEvent` vào một enum duy nhất là `DomainEvent`, loại bỏ các chuỗi alias trùng lặp.
  - Giữ `packages/shared-contracts` ở trạng thái "tinh khiết" (pure type declarations & validation schemas).

---

### Trụ cột 2 (R2): Kiểm toán Core Backend (`apps/server`) & Strict Multi-Tenancy

#### [ISSUE-R2-01 / CRIT-02, CRIT-03, CRIT-05]: Các Điểm Vi phạm Trực tiếp Strict Multi-Tenancy
- **Vị trí tệp & Dòng vi phạm:**
  1. `apps/server/src/modules/omnichannel/contacts/contacts.service.ts` (Dòng 540–553)
  2. `apps/server/src/infrastructure/queue/channel-ingestion.processor.ts` (Dòng 129–133, 229–234)
  3. `apps/server/src/modules/omnichannel/integrations/facebook/facebook.service.ts` (Dòng 633–635)
  4. `apps/server/src/modules/omnichannel/messages/attachments.service.ts` (Dòng 214–232, 273–275)
- **Chuỗi Bằng chứng & Phân tích Kỹ thuật:**
  Quy chuẩn bất biến tại `AGENTS.md` Mục 3 đã nêu rõ:
  > *"Hệ thống áp dụng Strict Multi-tenancy. TẤT CẢ các truy vấn database (từ findUnique, findFirst, update, đến delete) cho các resource của tổ chức ĐỀU PHẢI có workspaceId trong điều kiện where."*
  
  Tuy nhiên, trong `schema.prisma`, các bảng tenant đều có khóa chính `@id @default(uuid())` và ràng buộc duy nhất `@@unique([workspaceId, id])`. Khi lập trình viên gọi lệnh qua Prisma Client, Prisma vẫn sinh ra interface cho phép truyền duy nhất `{ where: { id } }`.
  
  **Các đoạn mã vi phạm thực tế được phát hiện:**
  - *Vi phạm 1:* Trong `contacts.service.ts:540`, khi xử lý merge 2 liên hệ bị trùng lặp, hội thoại cũ được cập nhật bằng câu lệnh:
    ```typescript
    await tx.conversation.update({
      where: { id: older.id }, // THIẾU WORKSPACE_ID!
      data: { status: ConversationStatus.RESOLVED, ... }
    });
    ```
  - *Vi phạm 2:* Trong `channel-ingestion.processor.ts:229`, tiến trình nền cập nhật trạng thái tin nhắn:
    ```typescript
    await client.message.update({
      where: { id: existingMessage.id }, // THIẾU WORKSPACE_ID!
      data: { deliveryStatus: newStatus }
    });
    ```
  - *Vi phạm 3:* Trong `facebook.service.ts:633-634`, khi hủy kết nối Fanpage:
    ```typescript
    await tx.channel.delete({ where: { id: channelId } }); // THIẾU WORKSPACE_ID!
    await tx.inbox.delete({ where: { id: channel.inboxId } }); // THIẾU WORKSPACE_ID!
    ```
  - *Vi phạm 4:* Trong `attachments.service.ts:214-230`, phương thức `deleteByMessageId(messageId)` nhận duy nhất `messageId` và thực hiện `findMany` / `deleteMany` mà không nhận hay kiểm tra `workspaceId`.
- **Phân tích Rủi ro:**
  Đây là **lỗ hổng bảo mật cấp độ Thảm họa (Catastrophic Risk)** trong hệ thống đa người thuê (SaaS Multi-tenant). Nếu một đối tượng độc hại đoán được UUID hoặc khai thác lỗi logic truyền nhầm ID của một tenant khác vào các API này, họ có thể ghi đè trạng thái hội thoại, xóa sạch hộp thư, hoặc sửa tin nhắn của khách hàng khác mà hệ thống cơ sở dữ liệu không hề ngăn chặn.
- **Giải pháp Đề xuất theo KISS & AGENTS.md:**
  Áp dụng nhất quán cú pháp định danh phức hợp (compound unique key) đã được khai báo trong Prisma schema cho mọi lệnh `update`, `delete`, `findUnique`:
  ```typescript
  // ĐÚNG theo chuẩn Strict Multi-Tenancy:
  await tx.conversation.update({
    where: { workspaceId_id: { workspaceId, id: older.id } },
    data: { status: ConversationStatus.RESOLVED, ... }
  });
  await tx.channel.delete({
    where: { workspaceId_id: { workspaceId, id: channelId } }
  });
  ```

---

#### [ISSUE-R2-02 / CRIT-04]: Tác vụ Ngoại vi S3/MinIO Nằm Bên trong Giao dịch Cơ sở Dữ liệu (`$transaction`)
- **Vị trí tệp & Dòng vi phạm:**
  - `apps/server/src/modules/omnichannel/messages/messages.service.ts` (Dòng 214–240, 323)
  - `apps/server/src/modules/omnichannel/messages/attachments.service.ts` (Dòng 152–156)
- **Chuỗi Bằng chứng & Phân tích Kỹ thuật:**
  Trong `messages.service.ts`, hàm gửi tin nhắn mở một transaction cơ sở dữ liệu:
  ```typescript
  // messages.service.ts:214, 236-238
  const executeInTransaction = async (trx: any) => {
    ...
    if (hasFiles && files) {
      for (const file of files) {
        await this.attachmentsService.uploadAndCreate(workspaceId, message.id, file, trx);
      }
    }
  };
  ...
  await client.$transaction(executeInTransaction);
  ```
  Đi sâu vào bên trong `attachmentsService.uploadAndCreate`:
  ```typescript
  // attachments.service.ts:155
  await this.storageService.upload(file.buffer, validated.contentType, storageKey);
  ```
  `storageService.upload` là một tác vụ I/O mạng giao thức HTTP gửi dữ liệu nhị phân (lên tới 25MB mỗi file) tới MinIO hoặc AWS S3.
- **Phân tích Rủi ro:**
  1. Trong suốt thời gian upload file qua mạng (thường mất từ vài trăm mili-giây tới hàng chục giây tùy dung lượng và băng thông mạng), kết nối cơ sở dữ liệu (Database Connection) của PostgreSQL bị chiếm giữ hoàn toàn trong trạng thái mở giao dịch (open transaction).
  2. Bể kết nối (Connection Pool) của NestJS server cấu hình mặc định tối đa 10 kết nối. Chỉ cần 10 người dùng cùng gửi file đính kèm cùng lúc, toàn bộ hệ thống API backend sẽ bị cạn kiệt kết nối (Connection Pool Starvation), dẫn đến việc toàn bộ hệ thống tê liệt hoàn toàn.
  3. Nếu việc upload file cuối cùng bị lỗi mạng, transaction database rollback nhưng các file đã upload trước đó vẫn nằm trôi nổi trên S3 (orphaned files).
- **Giải pháp Đề xuất theo KISS & AGENTS.md:**
  Tuân thủ nguyên tắc vàng trong xử lý cơ sở dữ liệu: **Tuyệt đối không đưa Network I/O vào trong Transaction**.
  Thực hiện refactor theo 2 bước rõ ràng:
  1. *Bước 1:* Upload toàn bộ files lên Storage Service bên ngoài giao dịch để lấy về metadata (`storageKey`, `fileSize`, `contentType`).
  2. *Bước 2:* Mở giao dịch `$transaction` nhanh (<5ms) chỉ để ghi các bản ghi vào PostgreSQL (`message.create`, `attachment.createMany`, `conversation.update`).

---

#### [ISSUE-R2-03 / HIGH-03 & HIGH-04]: Trùng lặp Job ID trên Hàng đợi Thanh toán & Lỗi Race Condition Không Bắt `P2002`
- **Vị trí tệp & Dòng vi phạm:**
  - `apps/server/src/modules/commerce/webhooks/payment-webhooks.controller.ts` (Dòng 107–126)
  - `apps/server/src/modules/commerce/reconciliation/payment-reconciliation.service.ts` (Dòng 76–80, 158–175)
- **Chuỗi Bằng chứng & Phân tích Kỹ thuật:**
  1. Trong `payment-webhooks.controller.ts:108`:
     ```typescript
     // Native BullMQ deduplication: jobId = `${gateway}:${txId}`
     const jobId = `${gateway}:${txId}`;
     await this.reconciliationQueue.add('reconcile', { ... }, { jobId, ... });
     ```
     Hàng đợi Redis của BullMQ là dùng chung cho toàn bộ server (shared across tenants). Nếu Cửa hàng A và Cửa hàng B cùng nhận được giao dịch chuyển khoản từ khách hàng với số tham chiếu ngân hàng ngẫu nhiên trùng nhau (ví dụ Vietcombank `FT123456`), BullMQ sẽ coi job của Cửa hàng B là trùng lặp (duplicate) và âm thầm loại bỏ.
  2. Trong `payment-reconciliation.service.ts`:
     Hàm xử lý đối soát thực hiện kiểm tra `existingTx = await tx.paymentTransaction.findFirst({ where: { workspaceId, idempotencyKey } })`.
     Nếu có 2 webhook từ cổng thanh toán bắn tới cùng một tích tắc (concurrency): cả 2 tiến trình đều kiểm tra thấy chưa có giao dịch, và cùng đi tới dòng 158 để gọi `tx.paymentTransaction.create(...)`.
     Bản ghi thứ hai sẽ kích hoạt lỗi ràng buộc duy nhất `P2002` của cơ sở dữ liệu. Do không có khối `try/catch` bắt mã lỗi `P2002`, tiến trình ném ra ngoại lệ không được xử lý và trả về HTTP 500 cho cổng thanh toán.
- **Phân tích Rủi ro:**
  Nguy cơ mất tiền và thất thoát đối soát đơn hàng của khách hàng. Cổng thanh toán (như SePay hay Casso) khi nhận mã 500 sẽ liên tục retry hoặc tạm khóa webhook do lỗi endpoint.
- **Giải pháp Đề xuất theo KISS & AGENTS.md:**
  1. Sửa `jobId` thành: `const jobId = `${workspaceId}:${gateway}:${txId}`;`.
  2. Trong `payment-reconciliation.service.ts`, bọc lệnh `create` trong khối `try/catch`: nếu bắt được lỗi `P2002` từ Prisma thì trả về kết quả thành công dưới dạng `{ processed: false, status: 'DUPLICATE' }` thay vì làm sập tiến trình.

---

#### [ISSUE-R2-04 / HIGH-05]: Thiếu Prisma Exception Filter Gây Rò rỉ Thông tin Cơ sở Dữ liệu
- **Vị trí tệp & Dòng vi phạm:**
  - `apps/server/src/common/filters/http-exception.filter.ts` (Dòng 32–73)
  - `apps/server/src/main.ts` (Dòng 39)
- **Chuỗi Bằng chứng & Phân tích Kỹ thuật:**
  Trong `main.ts:39`, ứng dụng chỉ đăng ký duy nhất `app.useGlobalFilters(new HttpExceptionFilter());`.
  Kiểm tra file `http-exception.filter.ts`: filter chỉ xử lý `ZodError`, `HttpException`, và fallback về `Error` thông thường. **Hoàn toàn không có logic xử lý cho `PrismaClientKnownRequestError`**.
  Hậu quả là khi Prisma ném ra các mã lỗi phổ biến:
  - `P2025` ("An operation failed because it depends on one or more records that were required but not found"): Rơi vào nhánh 500.
  - `P2002` (Unique constraint failed): Rơi vào nhánh 500.
  - Ở môi trường development/staging, nhánh 500 này trả thẳng `exception.message` ra ngoài HTTP response, phơi bày toàn bộ tên bảng, tên cột và câu truy vấn SQL thô cho người dùng.
- **Phân tích Rủi ro:**
  Vi phạm nghiêm trọng tiêu chuẩn an toàn bảo mật OWASP (Information Leakage). Đồng thời làm sai lệch mã trạng thái HTTP: lỗi do client yêu cầu một tài nguyên không tồn tại lại bị báo thành lỗi máy chủ nội bộ 500.
- **Giải pháp Đề xuất theo KISS & AGENTS.md:**
  Bổ sung trực tiếp bộ chuyển đổi lỗi Prisma vào `HttpExceptionFilter`:
  - `P2025` -> `HttpStatus.NOT_FOUND` (404) với message "Tài nguyên yêu cầu không tồn tại trong không gian làm việc".
  - `P2002` -> `HttpStatus.CONFLICT` (409) với message "Tài nguyên với thông tin này đã tồn tại".
  - `P2003` -> `HttpStatus.BAD_REQUEST` (400) với message "Vi phạm ràng buộc dữ liệu liên kết".
  - Ở chế độ production, tuyệt đối che giấu chi tiết kỹ thuật của lỗi database.

---

#### [ISSUE-R2-05 / HIGH-08, HIGH-09, MED-03]: Vi phạm Nguyên tắc KISS & Anti-Over-Engineering trong AGENTS.md
- **Vị trí tệp & Dòng vi phạm:**
  - 17 God Services (>300 LOC): `orders.service.ts` (1208 LOC), `inventory-ledger.service.ts` (949 LOC), `conversations.service.ts` (789 LOC), v.v.
  - 3 Controllers inject trực tiếp Prisma: `vietqr.controller.ts:48`, `web-chat.controller.ts:216`, `facebook.controller.ts:447`.
  - 7 DTO Mappers thừa thãi: `apps/server/src/modules/*/*.mapper.ts`.
- **Chuỗi Bằng chứng & Phân tích Kỹ thuật:**
  `AGENTS.md` Mục 2 quy định rất rõ:
  > *"Tối giản cấu trúc (Backend): Ưu tiên lối viết trực tiếp, idiomatic. NestJS Controller gọi đến Service, và Service gọi trực tiếp qua Prisma ORM. Không tạo Layer dư thừa: Tuyệt đối KHÔNG tạo các interface thừa hoặc mapping qua nhiều tầng DTO."*
  
  Thực tế codebase đang tồn tại 2 thái cực vi phạm:
  1. *Thừa thãi layer:* 7 file `*.mapper.ts` được tạo ra chỉ để lặp qua các thuộc tính của model Prisma và convert ngày `Date` thành string dạng thủ công.
  2. *Thiếu phân rã & Controller ôm đồm:* Controller như `vietqr.controller.ts` lại tự gọi `this.prisma.getClient().order.findFirst` và tự tạo tin nhắn; trong khi các service như `orders.service.ts` phình to tới 1,208 dòng mã, ôm đồm từ tính toán giỏ hàng, áp mã khuyến mãi, cập nhật trạng thái đơn, tính toán hoàn tiền COD, tới thống kê doanh số.
- **Giải pháp Đề xuất theo KISS & AGENTS.md:**
  - Chuyển toàn bộ các lệnh truy vấn database trong 3 controller về đúng service tương ứng.
  - Xóa bỏ 7 file `*.mapper.ts`. Trả về trực tiếp bản ghi Prisma từ service, để `TransformInterceptor` hoặc serializer của NestJS tự động format ngày tháng.
  - Tách các sub-domain logic độc lập ra khỏi God Service (ví dụ: tách `OrderCalculationHelper` và `OrderStatusStateMachine` ra khỏi `orders.service.ts`).

---

### Trụ cột 3 (R3): Kiểm toán Frontend Web (`apps/web`)

#### [ISSUE-R3-01 / HIGH-06 & MED-04]: Phân mảnh Server State do Thiếu Query Keys Factory & Lệch Prefix Cache Invalidation
- **Vị trí tệp & Dòng vi phạm:**
  - `apps/web/src/lib/socket/use-realtime-sync.ts` (Dòng 454–472)
  - `apps/web/src/features/commerce/hooks/use-active-conversation-order.ts` (Dòng 18)
  - `apps/web/src/features/settings/hooks/use-canned-responses.ts` (Dòng 15) vs `apps/web/src/features/conversations/composer/hooks/use-canned-responses.ts` (Dòng 27)
  - `apps/web/src/features/settings/hooks/use-teams.ts` (Dòng 9) vs `apps/web/src/features/conversations/hooks/use-detail-metadata.ts` (Dòng 53)
- **Chuỗi Bằng chứng & Phân tích Kỹ thuật:**
  1. **Lỗi Realtime Invalidation bị vô hiệu hóa:**
     Trong hook lấy đơn hàng đang xử lý của hội thoại `useActiveConversationOrder`:
     `queryKey: ['active-conversation-order', workspaceId, conversationId, contactId]` (Dòng 18)
     Tại đây, phần tử thứ 0 là `'active-conversation-order'`, phần tử thứ 1 là `workspaceId`.
     Tuy nhiên, trong bộ lắng nghe sự kiện WebSocket realtime `use-realtime-sync.ts`:
     ```typescript
     // use-realtime-sync.ts:464
     queryClient.invalidateQueries({
       queryKey: ['active-conversation-order', conversationId],
     });
     ```
     Trong TanStack Query v5, thuật toán so khớp tiền tố (`prefix matching`) thực hiện so sánh theo từng chỉ mục mảng:
     Nó kiểm tra `queryKey[0] === 'active-conversation-order'` (Đúng) và `queryKey[1] === conversationId`.
     Vì `queryKey[1]` thực tế là `workspaceId`, mà `conversationId` không bao giờ bằng `workspaceId`, biểu thức luôn trả về `false`!
     **Kết quả:** Khi có đơn hàng mới được tạo hoặc cập nhật qua WebSocket, khung chat bên cạnh vẫn giữ nguyên dữ liệu cũ, không hề tự động làm mới!
  2. **Xung đột Khóa Cache giữa các Màn hình:**
     - Tin nhắn mẫu (Canned responses): Màn hình Settings dùng key `['workspaces', workspaceId, 'canned-responses', query]`. Nhưng khung chat soạn thảo lại dùng key `['canned-responses', resolvedWorkspaceId, search]`.
     - Nhóm làm việc (Teams): Settings dùng `['workspaces', workspaceId, 'teams']`. Chi tiết hội thoại lại dùng `['teams', resolvedWorkspaceId]`.
     Khi người dùng thêm mới hoặc sửa tin nhắn mẫu trong cài đặt, thao tác mutation chỉ invalidate key của Settings. Khung chat soạn thảo vẫn giữ nguyên danh sách cũ trong suốt phiên làm việc.
- **Phân tích Rủi ro:**
  Dữ liệu hiển thị không đồng nhất trên cùng một phiên làm việc của người dùng; mất toàn bộ sức mạnh của giao tiếp thời gian thực (realtime sync).
- **Giải pháp Đề xuất theo KISS & AGENTS.md:**
  Xây dựng một tệp Query Keys Factory duy nhất, đơn giản và phẳng tại `apps/web/src/lib/query-keys.ts`:
  ```typescript
  export const queryKeys = {
    commerce: {
      activeOrder: (wsId?: string, convId?: string, contactId?: string) =>
        ['commerce', wsId, 'active-order', convId, contactId] as const,
    },
    cannedResponses: {
      list: (wsId?: string, query?: string) =>
        ['workspaces', wsId, 'canned-responses', query ?? ''] as const,
    },
    teams: {
      list: (wsId?: string) => ['workspaces', wsId, 'teams'] as const,
    },
  };
  ```
  Tại `use-realtime-sync.ts`, sửa lại câu lệnh invalidate dùng `predicate` hoặc truyền đúng `workspaceId`:
  ```typescript
  queryClient.invalidateQueries({
    predicate: (query) =>
      query.queryKey[0] === 'commerce' &&
      query.queryKey[2] === 'active-order' &&
      (!conversationId || query.queryKey[3] === conversationId),
  });
  ```

---

#### [ISSUE-R3-02 / HIGH-07 & MED-06]: Bỏ quên Invalidation Tồn kho & Gọi API Thủ công trong `useEffect`
- **Vị trí tệp & Dòng vi phạm:**
  - `apps/web/src/features/commerce/hooks/use-commerce-orders.ts` (Dòng 18–28)
  - `apps/web/src/lib/socket/use-realtime-sync.ts` (Dòng 481–484)
  - `apps/web/src/features/conversations/message-thread.tsx` (Dòng 795–822)
  - `apps/web/src/features/commerce/components/address-cascader.tsx` (Dòng 50–103)
- **Chuỗi Bằng chứng & Phân tích Kỹ thuật:**
  1. Khi một đơn hàng được tạo hoặc chuyển trạng thái sang đã xác nhận, backend sẽ trừ tồn kho hoặc khóa tồn kho tạm tính (stock reservation). Tuy nhiên, hàm `invalidateOrderQueries` chỉ làm mới `commerce-orders` và `commerce-products`. Các truy vấn quản lý tồn kho (`inventory-variants`, `inventory-summary`, `inventory-transactions`) hoàn toàn không được làm mới.
  2. Trong `message-thread.tsx:795-822`: Lập trình viên sử dụng `React.useEffect` để gọi `conversationsApi.resetUnread(...)` kèm theo việc chỉnh sửa trực tiếp cache bằng `queryClient.setQueriesData`. Cách làm này vi phạm quy chuẩn `AGENTS.md Mục 4`, không có cơ chế xử lý hủy request (cancellation) và dễ gây race condition khi chuyển nhanh giữa các cuộc hội thoại.
  3. Trong `address-cascader.tsx:50-103`: Thay vì dùng TanStack Query `useQuery`, component dùng 3 tầng `useEffect` lồng nhau với biến `useState` để tải tỉnh/thành, quận/huyện, phường/xã, và tự viết bộ nhớ đệm module singleton trong `vietnam-address.ts`.
- **Phân tích Rủi ro:**
  Nhân viên quản lý kho nhìn thấy số lượng tồn kho sai lệch; hệ thống gọi API dư thừa và không tận dụng được cơ chế deduplication của React Query.
- **Giải pháp Đề xuất theo KISS & AGENTS.md:**
  - Bổ sung việc invalidate các key tồn kho vào `invalidateOrderQueries` và sự kiện socket `INVENTORY_UPDATED`.
  - Chuyển đổi `resetUnread` thành một mutation chuẩn của TanStack Query (`useResetUnreadMutation`).
  - Thay thế toàn bộ logic trong `address-cascader.tsx` bằng `useQuery({ queryKey: ['geo', 'provinces'], queryFn: fetchProvinces, staleTime: Infinity })`. Xóa bỏ file cache tự tạo `vietnam-address.ts`.

---

#### [ISSUE-R3-03 / MED-05 & LOW-02]: Tự Chế lại Giao diện, Bỏ qua Primitives của Shadcn UI và Dùng Mã Màu Cứng
- **Vị trí tệp & Dòng vi phạm:**
  - `apps/web/src/features/conversations/conversation-filter-popover.tsx` (24 thẻ `<button>` và 3 thẻ `<input>`)
  - `apps/web/src/features/conversations/image-lightbox-dialog.tsx` (Dòng 113–122, 128–227)
  - `apps/web/src/features/conversations/conversation-active-chips.tsx` (Dòng 105, 144)
  - `apps/web/src/features/conversations/message-thread-header.tsx` (Dòng 127)
- **Chuỗi Bằng chứng & Phân tích Kỹ thuật:**
  Trong khi thư mục `apps/web/src/components/ui/` đã trang bị đầy đủ 40 components Shadcn UI chuẩn mực (`Button`, `Input`, `InputGroup`, `Badge`, `Dialog`), nhiều tệp màn hình lại tự triển khai lại bằng mã HTML thô:
  - Trong `conversation-filter-popover.tsx`: Sử dụng 24 thẻ `<button>` thô để làm action rows và reset filters; tự nhúng thẻ `<input>` với icon search bọc trong thẻ `div` thay vì dùng `<InputGroup>`.
  - Trong `image-lightbox-dialog.tsx`: Import trực tiếp `* as DialogPrimitive from '@radix-ui/react-dialog'` và tự tạo portal, backdrop thay vì dùng `<DialogContent>`. Dùng 6 thẻ `<button>` thô với inline class cực dài để làm các nút zoom/rotate.
  - Sử dụng các mã màu cứng như `text-slate-400`, `bg-slate-500/10`, `text-gray-500` thay vì dùng token ngữ nghĩa Tailwind (`text-muted-foreground`, `bg-muted`).
- **Phân tích Rủi ro:**
  Giao diện mất tính đồng bộ về typography, khoảng cách (spacing), và hiệu ứng tương tác (hover/active/focus-visible). Khi người dùng chuyển đổi theme sáng/tối (Light/Dark mode), các mã màu cứng sẽ gây lỗi tương phản màu sắc nghiêm trọng.
- **Giải pháp Đề xuất theo KISS & AGENTS.md:**
  Thay thế toàn bộ thẻ `<button>` bằng `<Button variant="ghost" size="icon">` hoặc `<CommandItem>`. Dùng `<Badge>` cho filter chips và đưa toàn bộ màu sắc về Semantic Design Tokens của Tailwind (`bg-background`, `text-foreground`, `text-muted-foreground`).

---

#### [ISSUE-R3-04 / HIGH-11]: Lạm dụng `'use client'` ở Root Layout và Kiểm tra Quyền Hạn ở Client
- **Vị trí tệp & Dòng vi phạm:**
  - `apps/web/src/app/(workspace)/layout.tsx` (Dòng 1–15)
  - `apps/web/src/app/(platform-admin)/platform-admin/layout.tsx` (Dòng 1–15)
  - `apps/web/src/app/(workspace)/[workspaceSlug]/(overview)/dashboard/page.tsx` (Dòng 1–24)
  - `apps/web/src/components/layout/workspace-header.tsx` (Dòng 50–55)
- **Chuỗi Bằng chứng & Phân tích Kỹ thuật:**
  1. Cả `(workspace)/layout.tsx` và `platform-admin/layout.tsx` đều được khai báo `'use client'` ngay tại dòng 1 chỉ để bọc các Context Provider (`<SocketProvider>`, `<SidebarProvider>`). Điều này vô hiệu hóa hoàn toàn cơ chế Server Components của Next.js cho toàn bộ cây thư mục bên dưới.
  2. Tại `dashboard/page.tsx`, việc kiểm tra quyền hạn của người dùng (nếu là AGENT thì chuyển hướng sang trang hội thoại) lại được thực hiện trong client-side `useEffect`:
     ```typescript
     // dashboard/page.tsx:17-23
     React.useEffect(() => {
       if (!isLoading && currentWorkspace?.role === WorkspaceRole.AGENT) {
         router.replace(`/${workspaceSlug}/conversations`);
       }
     }, [isLoading, currentWorkspace, router, workspaceSlug]);
     ```
     Hậu quả là người dùng AGENT khi vào dashboard sẽ bị nháy màn hình (flash skeleton) của trang dashboard khoảng 1 giây trước khi bị đẩy sang trang hội thoại.
  3. Vì `workspaceId` không được resolve ở phía server, hơn 15 components ở client phải liên tục gọi `useWorkspaces().find(...)`. Trong `workspace-header.tsx:50-55`, khi danh sách đang tải, mã nguồn gán giá trị stub nguy hiểm: `{ id: 'current', role: 'ADMIN' as const }`.
- **Phân tích Rủi ro:**
  Làm phình kích thước bundle JavaScript gửi xuống trình duyệt; gây hiện tượng Cumulative Layout Shift (CLS) và trải nghiệm người dùng kém; cấp quyền giả định `role: 'ADMIN'` ở phía UI trong thời gian chờ load.
- **Giải pháp Đề xuất theo KISS & AGENTS.md:**
  1. Tách các Context Provider client vào một component bao bọc riêng (`src/providers/workspace-client-providers.tsx`), giữ cho `layout.tsx` là Server Component thuần túy.
  2. Thực hiện kiểm tra quyền và redirect trực tiếp tại Server Component trong `dashboard/page.tsx` bằng hàm `redirect(...)` của `next/navigation`.
  3. Cung cấp `workspaceId` đã resolve qua một Server Context hoặc React Context cấp cao, loại bỏ hoàn toàn các đoạn mã gán stub `role: 'ADMIN'`.

---

### Trụ cột 4 (R4): Giao tiếp Liên Thành phần (Inter-Component Communication) & Routing

#### [ISSUE-R4-01 / CRIT-01]: Lỗi Block Sản xuất do Lệch Chuẩn Envelope giữa Backend Interceptor và Frontend API Client
- **Vị trí tệp & Dòng vi phạm:**
  - `apps/server/src/common/interceptors/transform.interceptor.ts` (Dòng 37–44)
  - `apps/web/src/lib/api/client.ts` (Dòng 56–60, 141)
  - `apps/web/src/features/commerce/api/commerce-client.ts` (Dòng 26–32, 79–85, 88–94, 96–102, 127–133)
  - `apps/web/src/features/commerce/components/orders-view.tsx` (Dòng 73–91)
  - `apps/web/src/features/commerce/components/products-view.tsx` (Dòng 77–95)
  - `apps/web/src/features/commerce/components/inventory-view.tsx` (Dòng 65–80)
  - `apps/web/src/features/commerce/components/stock-ledger-drawer.tsx` (Dòng 125–127)
- **Chuỗi Bằng chứng & Phân tích Kỹ thuật:**
  Đây là phát hiện chấn động nhất trong đợt kiểm toán kiến trúc:
  
  1. *Phía Backend:* Các Controller trả về đối tượng phân trang gồm `{ items, meta }`.
     Bộ chặn `TransformInterceptor` bắt gói tin này và unwrap trường `items` ra ngoài:
     ```typescript
     // apps/server/src/common/interceptors/transform.interceptor.ts:37-44
     if (typeof data === 'object' && 'items' in data && 'meta' in data) {
       return {
         success: true,
         data: (data as any).items, // data chính là mảng Array các bản ghi!
         meta: (data as any).meta as PaginationMeta,
       };
     }
     ```
     Như vậy, gói tin JSON thực tế gửi qua HTTP mạng có cấu trúc:
     `{ "success": true, "data": [ ... ], "meta": { ... } }`.
  
  2. *Phía Frontend Client:* Hàm `fetchApi` bọc gói tin trong interface `ApiResponse<T>`:
     ```typescript
     // apps/web/src/lib/api/client.ts:56-60
     export interface ApiResponse<T> {
       success: boolean;
       data: T;
       meta?: ApiResponseMeta;
     }
     ```
  
  3. *Sự lệch pha trong `commerce-client.ts`:*
     Lập trình viên viết API client lại khai báo kiểu trả về giả định rằng backend chưa unwrap:
     ```typescript
     // apps/web/src/features/commerce/api/commerce-client.ts:128
     listOrders: (workspaceId: string, query?: ListOrdersQueryDto) =>
       fetchApi<{ items: OrderResponseDto[]; meta: PaginationMeta }>(
         `/workspaces/${workspaceId}/orders${buildQueryString(query)}`,
         { headers: workspaceHeaders(workspaceId) },
       ),
     ```
     Điều này khiến TypeScript hiểu rằng `res.data` là một đối tượng `{ items: [...], meta: {...} }`. Nhưng trong thời gian chạy (runtime), `res.data` thực chất chính là **Mảng danh sách các đơn hàng (`Array`)**!
  
  4. *Hậu quả tại giao diện View:*
     Trong `orders-view.tsx`:
     ```typescript
     // orders-view.tsx:73-90
     queryFn: async () => {
       const res = await commerceApi.listOrders(workspaceId, ...);
       return res.data; // res.data là MẢNG các đơn hàng!
     }
     ...
     const orders = data?.items || []; // Trên một Mảng Array, data.items là UNDEFINED!
     ```
     Vì `Array.items` là `undefined`, biểu thức `data?.items || []` luôn luôn rơi vào nhánh fallback `[]`!
     Lỗi y hệt 100% xuất hiện tại:
     - `products-view.tsx:94`: `const products = data?.items || [];` -> Luôn ra rỗng!
     - `inventory-view.tsx:79`: `const variants = data?.items || [];` -> Luôn ra rỗng!
     - `stock-ledger-drawer.tsx:127`: `const items = data?.items || [];` -> Luôn ra rỗng!
  
  5. *Tại sao Unit Test không phát hiện được:*
     Trong `apps/web/src/features/commerce/__tests__/orders-oms.spec.ts:24`, người viết test đã mock `fetch` trả về một payload giả lập `{ success: true, data: {} }` thay vì kiểm tra luồng tích hợp thực tế với `TransformInterceptor`.
- **Phân tích Rủi ro:**
  **CRITICAL BLOCKER CẤP ĐỘ CAO NHẤT.** Khách hàng và người dùng truy cập vào toàn bộ phân hệ Bán hàng (Xem danh sách Đơn hàng, Quản lý Sản phẩm, Tra cứu Tồn kho, và Xem Lịch sử biến động kho) đều thấy bảng trắng trơn không một bóng dữ liệu dù trong database có hàng nghìn bản ghi.
- **Giải pháp Đề xuất theo KISS & AGENTS.md:**
  - Sửa lại kiểu trả về trong `commerce-client.ts`:
    `listProducts`: `fetchApi<ProductResponseDto[]>`
    `listOrders`: `fetchApi<OrderResponseDto[]>`
    `listInventoryVariants`: `fetchApi<InventoryVariantItemDto[]>`
    `listInventoryTransactions`: `fetchApi<InventoryTransactionResponseDto[]>`
  - Trong các component View (`orders-view.tsx`, `products-view.tsx`, `inventory-view.tsx`, `stock-ledger-drawer.tsx`):
    Cập nhật lại `queryFn` trả về toàn bộ `res` (gồm cả `data` và `meta`), hoặc truy cập an toàn:
    `const orders = Array.isArray(data) ? data : (data?.items || []);`.

---

#### [ISSUE-R4-02 / HIGH-10]: Phân mảnh 4 Kiểu Routing Backend & Xung đột Mã Định danh Slug vs UUID
- **Vị trí tệp & Dòng vi phạm:**
  - `apps/server/src/modules/identity/workspaces/guards/workspace.guard.ts` (Dòng 34–95)
  - `apps/server/src/modules/**` (Toàn bộ các Controllers)
  - `apps/web/src/app/(workspace)/[workspaceSlug]/layout.tsx` (Dòng 5–18)
- **Chuỗi Bằng chứng & Phân tích Kỹ thuật:**
  1. *Phân mảnh 4 kiểu Route ở Backend:*
     - **Kiểu 1 (Đa hình Dual Polymorphic):** `@Controller(['workspaces/:workspaceId/orders', 'orders'])` trong `orders.controller.ts`, `products.controller.ts`, `inventory.controller.ts`.
     - **Kiểu 2 (Chỉ dùng Path Param):** `@Controller('workspaces/:workspaceId/orders/:id/vietqr')` trong `vietqr.controller.ts`, `presence.controller.ts`.
     - **Kiểu 3 (Chỉ dùng Header `X-Workspace-Id`):** `@Controller('conversations')`, `@Controller('contacts')`, `@Controller('inboxes')`, `@Controller('labels')`, `@Controller('teams')`.
     - **Kiểu 4 (Route tương đối Alias):** `@Controller('workspaces/current/members')` trong `workspace-members.controller.ts`.
  2. *Xung đột Slug vs UUID giữa Web và Server:*
     - Web UI dùng đường dẫn thân thiện theo slug: `/[workspaceSlug]/orders`, `/[workspaceSlug]/conversations`.
     - Nhưng `WorkspaceGuard` ở backend chỉ chấp nhận duy nhất chuỗi **UUID**: nó gọi `workspacesService.findMember(workspaceId, user.userId)` và truy vấn trực tiếp vào database với điều kiện `workspaceId`. Nếu truyền slug (ví dụ `shop-thoi-trang`), truy vấn trả về rỗng và server ném lỗi 403 `WORKSPACE_ACCESS_DENIED`.
     - Hậu quả: Mọi hook và trang trên web buộc phải gọi `useWorkspaces()`, lọc tìm phần tử có `slug === workspaceSlug`, lấy ra `id` (UUID), rồi mới truyền vào API. Nếu mạng chậm hoặc hook chưa nạp xong, toàn bộ các request con đều bị nghẽn.
- **Phân tích Rủi ro:**
  Gây khó khăn và nhầm lẫn cực lớn cho các đối tác tích hợp API bên ngoài; làm phức tạp hóa mã nguồn frontend khi phải liên tục chuyển đổi qua lại giữa Slug và UUID.
- **Giải pháp Đề xuất theo KISS & AGENTS.md:**
  1. Cải tiến `WorkspaceGuard` ở backend: Cho phép nhận diện linh hoạt. Nếu tham số `workspaceId` truyền vào không phải là định dạng UUID, guard sẽ tự động gọi tìm workspace theo `slug` (`findWorkspaceBySlugOrId`) và gán UUID tương ứng vào request context.
  2. Chuẩn hóa đồng nhất mô hình Dual Routing (`['workspaces/:workspaceId/...', '...']`) trên toàn bộ các controller của backend, ưu tiên đọc `X-Workspace-Id` từ header nếu route ngắn được sử dụng.

---

## 4. Lộ trình Khắc phục theo Giai đoạn (Phased Remediation Roadmap)

Để giải quyết triệt để 27 vấn đề nêu trên mà không làm xáo trộn hệ thống hay vi phạm nguyên tắc phát triển, lộ trình khắc phục được chia thành **4 giai đoạn tuần tự**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Phase 1: Ổn định, Bảo mật & Vá Lỗi Blocker (Stabilization, Security & Blockers)        │
│ ➔ Sửa lỗi rỗng bảng Commerce (CRIT-01) & Các vi phạm Multi-tenancy nghiêm trọng       │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
┌───────────────────────────────────────────▼────────────────────────────────────────────┐
│ Phase 2: Đồng bộ Hợp đồng & Xử lý Ngoại lệ (Contract Alignment & Robustness)          │
│ ➔ Thêm Order.paymentMethod vào Prisma, loại bỏ z.coerce, Query Keys Factory, Prisma Filter │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
┌───────────────────────────────────────────▼────────────────────────────────────────────┐
│ Phase 3: Chuẩn hóa Frontend & Tối ưu Render (Frontend Cleanup & Design Tokens)        │
│ ➔ Chuẩn hóa Shadcn UI, đẩy 'use client' xuống lá, tối ưu Server Component SSR          │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
┌───────────────────────────────────────────▼────────────────────────────────────────────┐
│ Phase 4: Tinh gọn Kiến trúc theo KISS (Anti-Over-Engineering & Architecture Hygiene)   │
│ ➔ Xóa 7 Mapper thừa, tách 17 God Services, chuẩn hóa Dual Routing và làm sạch Contract │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### Phase 1: Ổn định, Bảo mật & Vá Lỗi Blocker (Stabilization, Security & Blockers)
*Mục tiêu:* Khôi phục ngay hoạt động cho giao diện bán hàng Commerce và triệt tiêu các lỗ hổng rò rỉ dữ liệu giữa các tenant.

| Mã Nhiệm vụ | Tác vụ Cụ thể | Tệp mục tiêu | Tiêu chí Nghiệm thu (Acceptance Criteria) |
|---|---|---|---|
| **TASK-P1-01** | Khắc phục lỗi Envelope Unwrapping của Commerce API Client | `apps/web/src/features/commerce/api/commerce-client.ts`<br>`apps/web/src/features/commerce/components/*-view.tsx` | Các bảng Orders, Products, Inventory và Stock Ledger hiển thị chính xác danh sách dữ liệu thực tế từ database, không còn bị rỗng (`[]`). |
| **TASK-P1-02** | Khắc phục vi phạm Multi-Tenancy trong Contact Merge Collision | `apps/server/src/modules/omnichannel/contacts/contacts.service.ts` | Câu lệnh `tx.conversation.update` tại dòng 540 dùng `where: { workspaceId_id: { workspaceId, id: older.id } }`. |
| **TASK-P1-03** | Khắc phục vi phạm Multi-Tenancy trong Channel Ingestion Queue & Facebook Disconnect | `apps/server/src/infrastructure/queue/channel-ingestion.processor.ts`<br>`apps/server/src/modules/omnichannel/integrations/facebook/facebook.service.ts` | Cập nhật `message.update`, `channel.delete`, `inbox.delete` đều có tiền tố `workspaceId`. |
| **TASK-P1-04** | Đưa tác vụ Upload S3/MinIO ra ngoài Database Transaction | `apps/server/src/modules/omnichannel/messages/messages.service.ts`<br>`apps/server/src/modules/omnichannel/messages/attachments.service.ts` | File được upload lên storage trước khi mở `$transaction`; thời gian khóa database transaction giảm xuống dưới 10ms. |
| **TASK-P1-05** | Thêm tiền tố `workspaceId` vào BullMQ Job ID cho Webhook Thanh toán | `apps/server/src/modules/commerce/webhooks/payment-webhooks.controller.ts` | `jobId` định dạng `${workspaceId}:${gateway}:${txId}`, ngăn chặn việc nuốt mất job đối soát giữa các tenant. |

---

### Phase 2: Đồng bộ Hợp đồng & Xử lý Ngoại lệ (Contract Alignment & Robustness)
*Mục tiêu:* Khắc phục triệt để tình trạng lệch chuẩn schema, ngăn chặn dữ liệu bẩn và chuẩn hóa cơ chế quản lý cache.

| Mã Nhiệm vụ | Tác vụ Cụ thể | Tệp mục tiêu | Tiêu chí Nghiệm thu (Acceptance Criteria) |
|---|---|---|---|
| **TASK-P2-01** | Bổ sung trường `paymentMethod` vào `model Order` trong Prisma Schema | `apps/server/prisma/schema.prisma`<br>`apps/server/src/modules/commerce/orders/orders.service.ts` | Thêm cột `paymentMethod PaymentMethod @default(COD)` kèm index `@@index([workspaceId, paymentMethod])`. Tạo migration và xóa bỏ toàn bộ mã đọc từ `metadata`. |
| **TASK-P2-02** | Loại bỏ `z.coerce.number()` trong toàn bộ JSON Mutation Schemas | `packages/shared-contracts/src/commerce/**/*.schemas.ts` | Thay bằng `z.number()` cho mọi request body POST/PUT. Thử nghiệm truyền `null` bị từ chối với lỗi 400 thay vì âm thầm thành `0`. |
| **TASK-P2-03** | Xây dựng Query Keys Factory tập trung và Sửa lỗi Socket Prefix Invalidation | `apps/web/src/lib/query-keys.ts`<br>`apps/web/src/lib/socket/use-realtime-sync.ts`<br>`apps/web/src/features/**/hooks/*` | Toàn bộ hooks dùng `queryKeys.*`. Socket realtime `active-conversation-order` làm mới tức thì khi có đơn hàng trong chat. |
| **TASK-P2-04** | Bổ sung Prisma Exception Filter toàn cục | `apps/server/src/common/filters/http-exception.filter.ts` | Lỗi `P2025` tự động ánh xạ thành 404, `P2002` thành 409. Không còn trả về 500 hay lộ chi tiết SQL ở môi trường production. |
| **TASK-P2-05** | Bổ sung Invalidation Tồn kho khi Đơn hàng Biến động | `apps/web/src/features/commerce/hooks/use-commerce-orders.ts`<br>`apps/web/src/lib/socket/use-realtime-sync.ts` | Tạo đơn hàng mới làm mới ngay tức thì các bảng `inventory-variants` và `inventory-summary`. |

---

### Phase 3: Chuẩn hóa Frontend & Tối ưu Render (Frontend Cleanup & Design Tokens)
*Mục tiêu:* Nâng cao trải nghiệm người dùng, tối ưu tốc độ tải trang Next.js App Router và đảm bảo tính nhất quán thiết kế Shadcn UI.

| Mã Nhiệm vụ | Tác vụ Cụ thể | Tệp mục tiêu | Tiêu chí Nghiệm thu (Acceptance Criteria) |
|---|---|---|---|
| **TASK-P3-01** | Thay thế 73+ Thẻ `<button>` và `<input>` Trần bằng Shadcn UI Primitives | `apps/web/src/features/conversations/conversation-filter-popover.tsx`<br>`image-lightbox-dialog.tsx`<br>`conversation-active-chips.tsx` | Tái sử dụng `Button`, `InputGroup`, `Badge`, và `Dialog` từ `src/components/ui/`. Loại bỏ các mã màu cứng `slate-*` / `gray-*`. |
| **TASK-P3-02** | Chuyển đổi Logic Fetching trong `useEffect` sang TanStack Query | `apps/web/src/features/conversations/message-thread.tsx`<br>`apps/web/src/features/commerce/components/address-cascader.tsx` | `resetUnread` chuyển thành mutation; địa giới hành chính dùng `useQuery` với `staleTime: Infinity`. Xóa file cache thủ công `vietnam-address.ts`. |
| **TASK-P3-03** | Đẩy Khai báo `'use client'` từ Root Layout xuống các Leaf Components | `apps/web/src/app/(workspace)/layout.tsx`<br>`apps/web/src/app/(platform-admin)/platform-admin/layout.tsx`<br>`apps/web/src/components/placeholder/feature-placeholder.tsx` | Layouts trở thành Server Components. Tách client providers ra component riêng, giảm kích thước bundle client. |
| **TASK-P3-04** | Chuyển Logic Kiểm tra Quyền Hạn và Điều hướng sang Phía Server | `apps/web/src/app/(workspace)/[workspaceSlug]/(overview)/dashboard/page.tsx` | Điều hướng AGENT sang `/conversations` bằng server-side redirect; triệt tiêu hiện tượng chớp trắng (flicker) và giật giao diện. |

---

### Phase 4: Tinh gọn Kiến trúc theo KISS (Anti-Over-Engineering & Architecture Hygiene)
*Mục tiêu:* Đưa hệ thống về đúng định hướng đơn giản, dễ bảo trì của AGENTS.md, dọn sạch code thừa và tối ưu hiệu năng dài hạn.

| Mã Nhiệm vụ | Tác vụ Cụ thể | Tệp mục tiêu | Tiêu chí Nghiệm thu (Acceptance Criteria) |
|---|---|---|---|
| **TASK-P4-01** | Xóa bỏ 7 File DTO Mapper Thừa thãi | `apps/server/src/modules/*/*.mapper.ts` | Xóa 7 file mapper. Trả về trực tiếp Prisma model từ service, giảm thiểu tầng trung gian theo đúng AGENTS.md Mục 2. |
| **TASK-P4-02** | Di chuyển Truy vấn Cơ sở Dữ liệu từ Controllers về Services | `apps/server/src/modules/commerce/payments/vietqr.controller.ts`<br>`web-chat.controller.ts`<br>`facebook.controller.ts` | 100% controller tuân thủ luồng: Controller nhận request -> gọi Service -> Service truy vấn Prisma. |
| **TASK-P4-03** | Phân rã 17 "God Services" Cồng kềnh | `apps/server/src/modules/commerce/orders/orders.service.ts`<br>`inventory-ledger.service.ts`<br>`conversations.service.ts` | Tách các logic toán học, state machine, và xử lý raw SQL thành các helper/service con có kích thước dưới 300 dòng mã. |
| **TASK-P4-04** | Chuẩn hóa Định tuyến Hỗ trợ Workspace Slug và Dual Routing | `apps/server/src/modules/identity/workspaces/guards/workspace.guard.ts`<br>`apps/server/src/modules/**` | `WorkspaceGuard` tự phân giải slug thành UUID; chuẩn hóa toàn bộ controller hỗ trợ cả path param và header `X-Workspace-Id`. |
| **TASK-P4-05** | Dọn dẹp Rò rỉ Hạ tầng trong Shared Contracts & Chuyển DTO Facebook | `packages/shared-contracts/src/**`<br>`apps/server/src/modules/omnichannel/integrations/facebook/facebook.dto.ts` | Chuyển queue names về backend; đưa DTO Facebook vào shared-contracts; hợp nhất enum sự kiện realtime thành `DomainEvent`. |

---

## 5. Danh mục Kiểm tra Nghiệm thu Độc lập (Verification & Acceptance Checklist)

Đội ngũ kỹ thuật hoặc Giám sát viên có thể độc lập kiểm chứng từng vấn đề và kết quả khắc phục dựa trên các bước kỹ thuật dưới đây:

### 5.1 Kiểm chứng Lỗi Rỗng Bảng Thương mại (CRIT-01)
1. Mở file `apps/server/src/common/interceptors/transform.interceptor.ts`, kiểm tra dòng 38–43: Xác nhận logic biến đổi `{ items, meta }` thành `data: items`.
2. Mở file `apps/web/src/features/commerce/api/commerce-client.ts`, kiểm tra dòng 128: Xác nhận kiểu `fetchApi<{ items: ..., meta: ... }>`.
3. Mở file `apps/web/src/features/commerce/components/orders-view.tsx`, kiểm tra dòng 90: Xác nhận `const orders = data?.items || [];`.
4. *Điều kiện xác nhận lỗi:* Nếu `data` là một Array thì `data.items` luôn trả về `undefined`, chứng minh giao diện luôn hiển thị rỗng `[]`.

### 5.2 Kiểm chứng Lỗ hổng Multi-Tenancy (CRIT-02, CRIT-03)
1. Mở file `apps/server/src/modules/omnichannel/contacts/contacts.service.ts`, kiểm tra dòng 540: Xác nhận câu lệnh `await tx.conversation.update({ where: { id: older.id }, ... })` hoàn toàn thiếu `workspaceId`.
2. Mở file `apps/server/src/infrastructure/queue/channel-ingestion.processor.ts`, kiểm tra dòng 229: Xác nhận `await client.message.update({ where: { id: existingMessage.id }, ... })` hoàn toàn thiếu `workspaceId`.
3. *Điều kiện đạt sau refactor:* Câu lệnh bắt buộc phải sử dụng `where: { workspaceId_id: { workspaceId, id } }`.

### 5.3 Kiểm chứng Tác vụ Ngoại vi trong Database Transaction (CRIT-04)
1. Mở file `apps/server/src/modules/omnichannel/messages/messages.service.ts`, quan sát dòng 214 (`executeInTransaction`) và dòng 238 gọi `this.attachmentsService.uploadAndCreate(...)`.
2. Mở file `apps/server/src/modules/omnichannel/messages/attachments.service.ts`, kiểm tra dòng 155: Xác nhận `this.storageService.upload(...)` thực hiện I/O mạng trong khi transaction database đang mở.
3. *Điều kiện đạt sau refactor:* Hàm upload lên storage phải được thực hiện hoàn tất trước khi mở `$transaction`.

### 5.4 Kiểm chứng Lỗi Socket Realtime Invalidation Prefix (HIGH-06)
1. Mở file `apps/web/src/features/commerce/hooks/use-active-conversation-order.ts`, kiểm tra dòng 18:
   `queryKey: ['active-conversation-order', workspaceId, conversationId, contactId]`.
2. Mở file `apps/web/src/lib/socket/use-realtime-sync.ts`, kiểm tra dòng 464:
   `queryKey: ['active-conversation-order', conversationId]`.
3. *Điều kiện xác nhận lỗi:* TanStack Query so sánh phần tử thứ 1 (`workspaceId` vs `conversationId`) không bao giờ khớp nhau, chứng minh việc invalidate realtime bị vô hiệu hóa hoàn toàn.

### 5.5 Kiểm chứng Tính Toàn vẹn Mã nguồn Hiện tại (Integrity Confirmation)
Chạy lệnh kiểm tra trạng thái Git để xác nhận không có bất kỳ file mã nguồn nào trong `apps/` hoặc `packages/` bị sửa đổi trong đợt kiểm toán này:
```powershell
git status --porcelain
```
*Kết quả hợp lệ duy nhất:* Chỉ ghi nhận file báo cáo mới `docs/architecture-audit-report.md` và các metadata trong `.agents/`.

---
*Báo cáo kết thúc. Toàn bộ các phát hiện và giải pháp đều bám sát triết lý Anti-Over-Engineering, KISS & YAGNI, và Strict Multi-Tenancy của Sales Copilot.*
