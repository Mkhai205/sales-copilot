# Phase 3A: Dọn Dẹp & Ổn Định (Cleanup & Stabilization)

> **Phân kỳ:** Phase 3A (Thực hiện đầu tiên, trước khi phát triển tính năng mới)
> **Mục tiêu:** Loại bỏ toàn bộ code thừa, module không cần, đơn giản hóa kiến trúc, vá lỗ hổng bảo mật multi-tenancy
> **Lý do:** Tái cấu trúc sản phẩm từ "SaaS đa workspace phức tạp" thành "SaaS đơn giản: 1 account = 1 shop"
> **Ước lượng:** Tuần 1 – Tuần 2

---

## Tổng Quan Các Nhiệm Vụ

| ID | Tên Nhiệm Vụ | Độ Ưu Tiên | Độ Phức Tạp | Phụ Thuộc |
|:---|:---|:---:|:---:|:---:|
| `TASK-3A-01` | Xoá module Shipping toàn bộ | P1 | Medium | Không |
| `TASK-3A-02` | Xoá module Automation Rules | P1 | Small | Không |
| `TASK-3A-03` | Xoá module Outbound Webhooks | P1 | Small | Không |
| `TASK-3A-04` | Loại bỏ role VIEWER khỏi hệ thống | P1 | Medium | Không |
| `TASK-3A-05` | Đơn giản hóa luồng Workspace (1 user = 1 shop) | P1 | Medium | Không |
| `TASK-3A-06` | Vá lỗ hổng cross-tenant WebChat Gateway (P0) | P0 | Small | Không |
| `TASK-3A-07` | Vá lỗ hổng cross-tenant WebChat Controller | P0 | Small | Không |
| `TASK-3A-08` | Thêm compound unique keys cho 10 Prisma models | P0 | Medium | Không |
| `TASK-3A-09` | Refactor 54 mutations sang compound keys | P0 | Large | `TASK-3A-08` |
| `TASK-3A-10` | Chống va chạm Facebook Page ID cross-tenant | P1 | Small | Không |
| `TASK-3A-11` | Sửa memory leak trong LinkPreviewService | P1 | Small | Không |
| `TASK-3A-12` | Xoá dead code và stub directories | P2 | Small | Không |
| `TASK-3A-13` | Xoá 3 trang Analytics placeholder | P2 | Small | Không |

---

### Feature 3A.01: Xoá module Shipping toàn bộ

#### 1. Mục tiêu & Trải nghiệm Người dùng
Lược bỏ tính năng tích hợp giao hàng do định hướng sản phẩm mới không yêu cầu quản lý vận đơn trực tiếp qua các đối tác giao hàng (GHN, GHTK, Custom). Người dùng sẽ quản lý thông tin giao hàng ngay trên đối tượng `Order` với các trường địa chỉ được đơn giản hoá, giảm độ phức tạp không cần thiết trên giao diện và backend.

#### 2. Quy tắc nghiệp vụ & Bất biến
- Thông tin nhận hàng (recipientName, recipientPhone, recipientAddress) phải được giữ trực tiếp trên `Order`. Có thể sử dụng JSON hoặc các trường riêng biệt.
- Không làm gãy luồng tạo `Order` hiện tại.
- Trường `shippingFee` trên `Order` tạm thời được giữ lại cho mục đích tương thích ngược (nullable).
- Tạo migration: `prisma migrate dev --name remove-shipping-module`.

#### 3. Ranh giới & Điều cấm
- Tuyệt đối không xóa table `Order`.
- Tuân thủ nguyên tắc KISS & YAGNI trong AGENTS.md, chỉ giữ lại những gì đang thực sự cần thiết.

#### 4. Tài liệu tham chiếu
- `schema.prisma`: Xoá model `ShippingAddress`, enum `CarrierProvider`.
- Backend: Xóa `ShippingController`, `ShippingService`, các adapters (GHN, GHTK, Custom).
- AI Copilot: Xoá 2 tools (`calculate_shipping`, `dispatch_order`).
- Frontend: Xóa UI components (`thermal-waybill-k80.tsx`, `thermal-print-dialog.tsx`, `recipient-info-form.tsx` - phần shipping).
- Shared contracts: Xóa thư mục `packages/shared-contracts/src/commerce/shipping/`.

#### 5. Tiêu chí nghiệm thu
- [x] Xoá thành công các files và thư mục backend, frontend, shared contracts liên quan đến Shipping & Thermal Printing (K58/K80).
- [x] Chạy thành công migration xoá `ShippingAddress` và `CarrierProvider`.
- [x] Luồng tạo Order hoạt động bình thường, thông tin recipient được lưu trực tiếp vào `Order`.
- [x] Chạy lệnh `npx prisma validate` thành công.
- [x] Build & Test thành công mà không có lỗi liên quan đến Shipping.

---

### Feature 3A.02: Xoá module Automation Rules

#### 1. Mục tiêu & Trải nghiệm Người dùng
Module Automation Rules không phù hợp với định hướng SaaS đơn giản. Việc gỡ bỏ giúp giảm thiểu tài nguyên tiêu thụ do event listener, dọn dẹp sidebar menu và codebase, mang lại trải nghiệm tinh gọn hơn.

#### 2. Quy tắc nghiệp vụ & Bất biến
- Xoá hoàn toàn Automation Rules khỏi hệ thống mà không ảnh hưởng tới luồng message thông thường.
- Cần tạo Prisma migration để drop table `AutomationRule`.

#### 3. Ranh giới & Điều cấm
- Không xoá nhầm các module automation khác nếu không liên quan tới "Rules" (như Canned Response - giữ nguyên).

#### 4. Tài liệu tham chiếu
- `schema.prisma`: Xoá model `AutomationRule`.
- Thư mục backend: Xoá toàn bộ `apps/server/src/modules/automation/automation-rules/`.
- Frontend: Xoá trang cài đặt automation rules, xoá entry trong `settings-nav-items`.
- Shared contracts: Xoá `packages/shared-contracts/src/automation/rules/`.
- Backend events: Gỡ bỏ toàn bộ EventEmitter2 listeners liên quan tới automation rules.

#### 5. Tiêu chí nghiệm thu
- [x] Xoá thành công model `AutomationRule` và tạo migration.
- [x] Xoá các module, UI, và contracts liên quan.
- [x] Hệ thống không có listener chạy ngầm liên quan tới automation rule.
- [x] Frontend sidebar và routing hoạt động ổn định.

---

### Feature 3A.03: Xoá module Outbound Webhooks

#### 1. Mục tiêu & Trải nghiệm Người dùng
Outbound webhooks được đánh giá là tính năng "overkill" với mô hình 1 account = 1 shop. Bỏ tính năng này giúp giảm chi phí server, dọn dẹp hàng loạt event listeners, BullMQ processors và queue.

#### 2. Quy tắc nghiệp vụ & Bất biến
- Giữ lại các inbound channel webhooks (Facebook, Payment webhooks) vì chúng là một phần lõi của tính năng nhận tin nhắn. Chỉ xoá **Outbound Webhooks**.
- Tạo Prisma migration loại bỏ `WebhookSubscription`, `WebhookDelivery` và `WebhookDeliveryStatus`.

#### 3. Ranh giới & Điều cấm
- Tuyệt đối không chạm vào Facebook webhook handler hay Payment callback handlers.

#### 4. Tài liệu tham chiếu
- `schema.prisma`: Xóa `WebhookSubscription`, `WebhookDelivery`, enum `WebhookDeliveryStatus`.
- Backend services: Xoá `webhook-subscriptions` controller/service.
- Event listeners: Xoá `webhook-dispatcher.listener.ts` (gồm 21 event listeners).
- BullMQ: Xóa `webhook-delivery.processor.ts`, xoá queue liên quan, xoá `webhook-signer.ts`.
- Frontend: Xoá settings page cho webhooks.
- Shared contracts: Xoá `packages/shared-contracts/src/automation/webhooks/`.

#### 5. Tiêu chí nghiệm thu
- [x] Đã drop các bảng liên quan webhooks outbound và apply migration.
- [x] Đã xoá toàn bộ service, controller, worker, processor và UI.
- [x] Gửi thử tin nhắn từ Facebook/Zalo về hệ thống để đảm bảo Inbound webhooks vẫn hoạt động bình thường.

---

### Feature 3A.04: Loại bỏ role VIEWER khỏi hệ thống

#### 1. Mục tiêu & Trải nghiệm Người dùng
Đơn giản hóa hệ thống phân quyền, chỉ giữ lại `OWNER`, `ADMIN`, `AGENT`. Tính năng view-only không được dùng và gây phức tạp cho quá trình filter dữ liệu.

#### 2. Quy tắc nghiệp vụ & Bất biến
- Quyền lợi của OWNER, ADMIN, và AGENT phải được giữ nguyên.
- Phải có script/migration để cập nhật các thành viên có role `VIEWER` thành `AGENT` trước khi xoá enum value.

#### 3. Ranh giới & Điều cấm
- Không sửa logic của OWNER và ADMIN.
- Phải cẩn thận khi xoá giá trị khỏi Enum trong PostgreSQL.

#### 4. Tài liệu tham chiếu
- `schema.prisma`: Xoá `VIEWER` khỏi enum `WorkspaceRole`.
- Shared contracts: Cập nhật `enums.ts` và `schemas.ts` (assignable roles).
- Backend decorators: Xóa `VIEWER` khỏi `@Roles()` trên khoảng 26 endpoints.
- Backend logic: Xoá logic `isViewer`/`isAgent` trong `MessagesService` (phần phân lọc private notes).
- Frontend: Cập nhật `use-settings-rbac.ts` và `settings-nav-items.ts`.

#### 5. Tiêu chí nghiệm thu
- [x] Thực hiện migration nâng cấp VIEWER lên AGENT an toàn.
- [x] Xoá hoàn toàn VIEWER khỏi codebase.
- [x] Frontend không hiển thị tuỳ chọn VIEWER khi thêm/sửa thành viên.
- [x] API decorators chỉ còn lại OWNER, ADMIN, AGENT.

---

### Feature 3A.05: Đơn giản hóa luồng Workspace (1 user = 1 shop)

#### 1. Mục tiêu & Trải nghiệm Người dùng
Loại bỏ thao tác phải chọn workspace, tự động nhận dạng workspace hiện tại dựa vào tài khoản. Người dùng chỉ cần đăng nhập và sẽ được đưa ngay vào không gian làm việc của shop mình.

#### 2. Quy tắc nghiệp vụ & Bất biến
- Dữ liệu `workspaceId` vẫn phải được giữ trong DB và backend để đảm bảo tính cách ly dữ liệu nhiều khách hàng trên chung 1 cơ sở dữ liệu.
- `WorkspaceGuard` tự động resolve workspace từ `WorkspaceMember` của user đăng nhập.
- Luồng đăng ký mới sẽ tạo `User` và `Workspace` trong cùng 1 transaction nguyên tử.
- `OWNER` tạo account cho nhân viên cũng tạo đồng thời `User` và `WorkspaceMember`.

#### 3. Ranh giới & Điều cấm
- Bỏ hoàn toàn khái niệm "Invite to Workspace". Không dùng luồng qua email để join nhiều shop.
- Tuân thủ nghiêm ngặt multi-tenancy như trong AGENTS.md, chỉ ẩn đi khái niệm workspace ở phía UI.

#### 4. Tài liệu tham chiếu
- Frontend: Xoá workspace switcher UI, bỏ Header `X-Workspace-Id` ở API Client, loại bỏ logic chuyển đổi workspace. Vẫn giữ lại workspace slug trong URL cho mục đích routing.
- Backend: Cập nhật `WorkspaceGuard`, sửa đổi luồng Register và luồng thêm nhân viên.

#### 5. Tiêu chí nghiệm thu
- [x] Tự động đăng nhập vào workspace đích mà không cần màn hình chọn.
- [x] API hoạt động trơn tru với `WorkspaceGuard` mới tự lấy `workspaceId`.
- [x] Luồng đăng ký mới và thêm nhân viên hoạt động với transaction nguyên tử.
- [x] UI không còn workspace switcher và tính năng Invite.

---

### Feature 3A.06 & 3A.07: Vá lỗ hổng cross-tenant WebChat Gateway & Controller

#### 1. Mục tiêu & Trải nghiệm Người dùng
Ngăn chặn các nguy cơ bảo mật lộ dữ liệu qua WebChat, nơi một user có thể quét kênh của tenant khác. Đảm bảo dữ liệu chat web được phân mảnh tuyệt đối theo `workspaceId`.

#### 2. Quy tắc nghiệp vụ & Bất biến
- Gateway và Controller không được dùng cách quét toàn bộ channel dựa trên `id` mà không có `workspaceId` / `providerAccountId`.
- Bắt buộc phải thay thế bằng indexed lookup thông qua `providerAccountId` để map chính xác đến `workspaceId`.

#### 3. Ranh giới & Điều cấm
- Không ảnh hưởng đến luồng real-time của chính khách hàng WebChat.
- Chỉ sửa logic truy vấn, không thay đổi signature/response của API Webchat.

#### 4. Tài liệu tham chiếu
- Audit Report `FINDING-SEC-01`: `web-chat.gateway.ts:548` cross-tenant channel scan.
- Audit Report `FINDING-SEC-02`: `web-chat.controller.ts:324` fallback scan.

#### 5. Tiêu chí nghiệm thu
- [x] Loại bỏ hoàn toàn fallback scan, thay bằng truy vấn kèm security constraints.
- [x] Unit tests/Integration tests cho Webchat Gateway và Controller hoạt động bình thường, và chặn truy cập từ tenant chéo.

---

### Feature 3A.08: Thêm compound unique keys cho 10 Prisma models

#### 1. Mục tiêu & Trải nghiệm Người dùng
Việc thêm Compound Unique Keys (chẳng hạn `@@unique([workspaceId, id])`) trong database giúp củng cố kiến trúc Strict Multi-Tenancy (bảo vệ ngay ở cấp độ DB), là bước chuẩn bị quan trọng để fix 106 truy vấn Prisma có lỗ hổng bảo mật.

#### 2. Quy tắc nghiệp vụ & Bất biến
- Không làm thay đổi id chính (vẫn là UUID/cuid), chỉ thêm Compound Key phụ để Prisma có thể sử dụng cấu trúc `where: { workspaceId_id }`.
- Cần chạy Prisma Migration.

#### 3. Ranh giới & Điều cấm
- Không thay đổi Primary Key (PK).
- Bỏ qua các model sắp bị xoá (`AutomationRule`, `WebhookSubscription`).

#### 4. Tài liệu tham chiếu
- `schema.prisma`: Thêm `@@unique([workspaceId, id])` vào các models: `Conversation`, `Message`, `Contact`, `ChannelIdentity`, `Inbox`, `Channel`, `Team`, `Label`, `CannedResponse`.
- Section 3.4 của Comprehensive Audit Report.

#### 5. Tiêu chí nghiệm thu
- [x] `schema.prisma` được cập nhật và migration được tạo.
- [x] Prisma generate chạy tốt.

---

### Feature 3A.09: Refactor 54 mutations sang compound keys

#### 1. Mục tiêu & Trải nghiệm Người dùng
Bịt lỗ hổng cross-tenant khi thực hiện thao tác update hoặc delete. Bằng cách sử dụng compound key, ta đảm bảo một request chỉ có thể sửa dữ liệu nếu `id` đó thực sự thuộc về `workspaceId` đang request.

#### 2. Quy tắc nghiệp vụ & Bất biến
- Phụ thuộc vào `TASK-3A-08`.
- Thay thế toàn bộ các lời gọi `update`/`delete` có dạng `{ where: { id } }` thành `{ where: { workspaceId_id: { workspaceId, id } } }`.

#### 3. Ranh giới & Điều cấm
- Không sửa các models bị xóa trong TASK-3A-02, TASK-3A-03.
- Chỉ sửa những mutation liên quan đến các models đã định nghĩa compound keys ở trên.

#### 4. Tài liệu tham chiếu
- Các services chịu ảnh hưởng: `conversations`, `messages`, `contacts`, `inboxes`, `labels`, `teams`, `canned-responses`.
- Section 3.4 của Comprehensive Audit Report.

#### 5. Tiêu chí nghiệm thu
- [x] Tất cả 54 mutations được refactor.
- [x] Không còn cảnh báo security liên quan đến missing `workspaceId` trong các services được liệt kê.
- [x] Các integration test tương ứng phải pass 100%.

---

### Feature 3A.10: Chống va chạm Facebook Page ID cross-tenant

#### 1. Mục tiêu & Trải nghiệm Người dùng
Fix lỗi một Facebook Page có thể bị gán cho 2 workspace khác nhau (nếu cố tình làm vậy). Đảm bảo mỗi Facebook Page ID chỉ được kết nối với hệ thống 1 lần duy nhất trong toàn hệ thống.

#### 2. Quy tắc nghiệp vụ & Bất biến
- Cần có DB Constraint chống trùng lặp `providerAccountId` đối với Facebook Channel.

#### 3. Ranh giới & Điều cấm
- Phải cẩn trọng vì `providerAccountId` với các channel không phải Facebook (chẳng hạn custom channel) có thể có cấu trúc khác.

#### 4. Tài liệu tham chiếu
- Audit Report `FINDING-SEC-06`.

#### 5. Tiêu chí nghiệm thu
- [x] Có unique constraint cho Facebook Page ID.
- [x] Thêm logic kiểm tra và handle error trả về người dùng "Page này đã được kết nối" thay vì bị lỗi crash ngầm hoặc ghi đè dữ liệu.

---

### Feature 3A.11: Sửa memory leak trong LinkPreviewService

#### 1. Mục tiêu & Trải nghiệm Người dùng
Giữ cho hệ thống ổn định, tránh tình trạng hết bộ nhớ (OOM) trong quá trình hoạt động dài hạn trên server.

#### 2. Quy tắc nghiệp vụ & Bất biến
- Thay thế Map In-memory không có giới hạn bằng công cụ có TTL/LRU.
- Sử dụng `lru-cache` hoặc `Redis SET` với TTL.

#### 3. Ranh giới & Điều cấm
- Đảm bảo hiệu suất không bị ảnh hưởng do parse lại OpenGraph tags liên tục.

#### 4. Tài liệu tham chiếu
- Audit Report `FINDING-CLEAN-01`.
- Vị trí: `link-preview.service.ts` dòng 14.

#### 5. Tiêu chí nghiệm thu
- [x] Xoá bỏ Map cache hiện tại.
- [x] Áp dụng lru-cache với size limit và TTL.
- [x] Unit tests chạy bình thường.

---

### Feature 3A.12: Xoá dead code và stub directories

#### 1. Mục tiêu & Trải nghiệm Người dùng
Dọn dẹp codebase để dễ dàng maintain và đọc hiểu. Xoá các function rác hoặc chưa bao giờ dùng.

#### 2. Quy tắc nghiệp vụ & Bất biến
- Không xoá các methods đang được sử dụng ở chỗ khác (đã verify bằng references / typecheck).

#### 3. Ranh giới & Điều cấm
- Chỉ tập trung xoá code thừa, không refactor logic đang chạy tốt ở những chỗ khác.

#### 4. Tài liệu tham chiếu
- Backend service: Xoá `transferIdentities()` method trong `contacts.service.ts` (lines 846-865).
- Xoá orphan entity `CustomerContact` (nếu có).
- Xoá các stub directories: `integrations/zalo/`, `integrations/email/`.

#### 5. Tiêu chí nghiệm thu
- [x] Codebase sạch sẽ hơn.
- [x] Không có tệp tin rác trong `integrations/`.
- [x] Không phá vỡ build.

---

### Feature 3A.13: Xoá 3 trang Analytics placeholder

#### 1. Mục tiêu & Trải nghiệm Người dùng
Lược bỏ các trang Analytics trống (chưa có chức năng thực) để tập trung làm Dashboard Overview ở Phase 3B, tránh gây hiểu nhầm cho người dùng.

#### 2. Quy tắc nghiệp vụ & Bất biến
- Xoá triệt để UI route và Navigation, không để lại dead link.

#### 3. Ranh giới & Điều cấm
- Không xóa nhầm các trang report chính thức nếu có.

#### 4. Tài liệu tham chiếu
- Frontend pages: Xóa `analytics/overview`, `analytics/channels`, `analytics/agents`.
- Frontend navigation: Xóa các mục này khỏi sidebar menu.

#### 5. Tiêu chí nghiệm thu
- [x] Khi click vào sidebar không còn mục Analytics cũ.
- [x] Routing báo 404 cho các link cũ nếu user vô tình gõ lại.

---

## Kiểm Chứng Sau Phase 3A

```bash
pnpm typecheck --skip-nx-cache    # 0 errors
pnpm nx test server               # All tests pass (update/remove tests for deleted modules)
pnpm nx test web                  # All tests pass
pnpm nx lint server               # 0 warnings
pnpm nx lint web                  # 0 warnings
npx prisma validate               # Schema valid
```
