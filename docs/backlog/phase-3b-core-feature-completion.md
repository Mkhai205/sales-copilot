# Phase 3B: Hoàn Thiện Tính Năng Lõi (Core Feature Completion)

> **Phân kỳ:** Phase 3B (Sau khi Phase 3A hoàn tất)
> **Mục tiêu:** Xây dựng các tính năng còn thiếu UI, tạo Dashboard, hoàn thiện trải nghiệm
> **Ước lượng:** Tuần 3 – Tuần 5
> **Phụ thuộc:** Phase 3A hoàn tất

## Danh sách Tasks
| Mã Task | Tên Task | Phân hệ |
|---------|----------|----------|
| **TASK-3B-01** | Tạo Dashboard Overview mới | Analytics / Routing |
| **TASK-3B-02** | Hoàn thiện Contacts CRM UI | CRM |
| **TASK-3B-03** | Hoàn thiện UI Đối soát Ngân hàng | Finance / Order |
| **TASK-3B-04** | Luồng đăng ký & Quản lý nhân viên | Auth / Settings |

---

## TASK-3B-01: Tạo Dashboard Overview mới

### 1. Mục tiêu & Trải nghiệm Người dùng (User Journey & Value)
- **Mục tiêu:** Cung cấp cái nhìn tổng quan về tình hình kinh doanh trong ngày và trạng thái hoạt động của AI Copilot cho chủ shop và quản lý.
- **Trải nghiệm:** Khi user đăng nhập vào hệ thống:
  - Nếu là **OWNER** hoặc **ADMIN**: Được điều hướng đến trang `/[slug]/dashboard`. Trang này hiển thị dạng lưới các thẻ (card grid) thống kê các chỉ số trong ngày: số đơn hàng, doanh thu, số cuộc hội thoại mới, khách hàng mới, và trạng thái AI Copilot (đang bật/tắt, số lượng cuộc hội thoại đã xử lý).
  - Nếu là **AGENT**: Hệ thống tự động chuyển hướng (auto-redirect) thẳng vào `/[slug]/conversations` để bắt đầu chat ngay, bỏ qua dashboard vì họ không cần xem số liệu.

### 2. Quy tắc nghiệp vụ & Bất biến (Business Rules & Invariants)
- **Routing & Role:** Logic redirect phải dựa trên role của user (`workspaceId` tương ứng). 
- **Chỉ số:** Các metric hiển thị mặc định là của "Hôm nay" (Today) theo múi giờ của shop.
- **Backend:** Cần thêm endpoint `GET /dashboard/summary` để trả về dữ liệu tổng hợp thay vì Frontend phải gọi nhiều API lẻ tẻ.

### 3. Ranh giới & Điều cấm (Constraints & Out-of-Scope)
- **YAGNI:** Chỉ làm các KPI cards đơn giản (Shadcn Card grid). **KHÔNG** làm các biểu đồ phức tạp (charts, graphs), bộ lọc thời gian nâng cao trong phase này.
- **KHÔNG** hiển thị thông tin tài chính cho AGENT dưới bất kỳ hình thức nào.

### 4. Tài liệu tham chiếu (References)
- Shadcn UI: Card components.
- Routing: `page.tsx` gốc của `[slug]` hoặc Middleware.
- State Management: TanStack Query `useQuery` cho việc fetch dữ liệu dashboard (có thể set polling nếu cần).

### 5. Tiêu chí nghiệm thu (Acceptance Criteria & Definition of Done)
- [ ] Truy cập `/[slug]/dashboard` bằng account OWNER/ADMIN sẽ hiển thị đầy đủ các KPI cards.
- [ ] Truy cập bằng account AGENT sẽ bị redirect sang `/[slug]/conversations`.
- [ ] API `GET /dashboard/summary` hoạt động ổn định và trả về DTO đúng chuẩn Zod schema.
- [ ] Giao diện responsive trên Desktop.

---

## TASK-3B-02: Hoàn thiện Contacts CRM UI

### 1. Mục tiêu & Trải nghiệm Người dùng (User Journey & Value)
- **Mục tiêu:** Chuyển đổi màn hình `/[slug]/contacts` từ trạng thái placeholder hiện tại sang một UI bảng dữ liệu thực tế, giúp quản lý khách hàng từ nhiều kênh.
- **Trải nghiệm:** 
  - Màn hình chính là một Data Table hiển thị danh sách khách hàng.
  - Người dùng có thể tìm kiếm khách hàng (debounce input), lọc theo nguồn kênh (Facebook, Web, Telegram).
  - Click vào một hàng (row) sẽ mở ra `ContactDetailSheet` (slide-over panel) hiển thị chi tiết: thông tin liên hệ, lịch sử hội thoại, lịch sử đơn hàng.
  - Có nút "Add Contact" mở ra `CreateContactDialog`.
  - Tính năng Merge: Cửa sổ "Merge Contacts" cho phép chọn một contact phụ, xem trước các trường dữ liệu và thực thi gộp.
  - Quản lý Identities: Trong chi tiết contact, có card quản lý các danh tính (Facebook PSID, Telegram chat ID) cho phép view/link/unlink.

### 2. Quy tắc nghiệp vụ & Bất biến (Business Rules & Invariants)
- **Dữ liệu:** Backend đã có sẵn 8 endpoints (CRUD, search, merge, identities). Frontend chỉ gọi API.
- **Pagination:** Sử dụng cursor hoặc offset phân trang từ server.
- **State Management:** Toàn bộ hook (như `useContacts`, `useContactDetail`, `useMergeContacts`) phải dùng TanStack Query.
- Bất biến: Khi merge contact, phải hiển thị rõ cho user biết data nào sẽ bị ghi đè.

### 3. Ranh giới & Điều cấm (Constraints & Out-of-Scope)
- **KHÔNG** thay đổi logic backend hiện tại.
- **KHÔNG** load toàn bộ contact về client, bắt buộc phải dùng server-side pagination.

### 4. Tài liệu tham chiếu (References)
- UI: TanStack Table kết hợp với Shadcn DataTable pattern, Sheet component.
- API endpoints hiện tại: `GET /contacts/search`, `POST /contacts`, etc.

### 5. Tiêu chí nghiệm thu (Acceptance Criteria & Definition of Done)
- [ ] Bảng ContactsTable render đúng dữ liệu, có phân trang, search, và filter theo kênh hoạt động.
- [ ] `ContactDetailSheet` hiển thị đúng thông tin khi click vào một row.
- [ ] Flow "Add Contact" hoạt động tạo contact thành công.
- [ ] Flow "Merge Contacts" hoạt động, contact bị merge biến mất khỏi bảng và dữ liệu được gộp.
- [ ] Quản lý Identities (view/link/unlink) hoạt động tốt.

---

## TASK-3B-03: Hoàn thiện UI Đối soát Ngân hàng (Bank Reconciliation)

### 1. Mục tiêu & Trải nghiệm Người dùng (User Journey & Value)
- **Mục tiêu:** Cung cấp giao diện để theo dõi và đối soát tự động/thủ công các giao dịch chuyển khoản VietQR (`/[slug]/reconciliation`).
- **Trải nghiệm:**
  - Thay thế `<FeaturePlaceholder />` bằng `ReconciliationLedgerTable`.
  - Bảng liệt kê các `PaymentTransaction` với các thông tin: mã giao dịch, nội dung (memo), số tiền, đơn hàng được match, và trạng thái (RECONCILED, PENDING, FAILED).
  - Có các bộ lọc: khoảng thời gian, trạng thái, tìm kiếm theo memo/số tiền.
  - Real-time updates qua Socket.io khi có biến động số dư mới báo về.
  - Nếu hệ thống không tự match được (PENDING), OWNER/ADMIN có thể click "Manual Match", mở ra `ManualMatchDialog` để chọn đơn hàng cần gán với giao dịch ngân hàng này.
  - Phía trên cùng có một Summary Bar hiển thị tổng số và tổng tiền: Đã đối soát, Đang chờ, Thất bại.

### 2. Quy tắc nghiệp vụ & Bất biến (Business Rules & Invariants)
- **Backend API mới:** Cần tạo `ReconciliationController` với:
  - `GET /reconciliation/transactions` (list với filter, pagination).
  - `POST /reconciliation/transactions/:id/manual-match` (thực hiện gán thủ công).
  - `GET /reconciliation/stats` (thống kê tổng).
- **Phân quyền (RBAC):** 
  - Chỉ **OWNER** và **ADMIN** mới được thực hiện thao tác Manual Match.
  - **AGENT** chỉ có thể xem (View-only).
- **Audit Logging:** Hành động manual match phải lưu lại lịch sử người thực hiện.

### 3. Ranh giới & Điều cấm (Constraints & Out-of-Scope)
- **KHÔNG** làm tích hợp ngân hàng mới (chỉ dùng VietQR / webhooks hiện có).
- **KHÔNG** cho phép hoàn tác (Undo) manual match trong phase này để giảm thiểu độ phức tạp. 

### 4. Tài liệu tham chiếu (References)
- Model: `PaymentTransaction`, `Order`.
- Websocket: Socket.io events cho giao dịch mới.
- UI: Shadcn DataTable, Badge.

### 5. Tiêu chí nghiệm thu (Acceptance Criteria & Definition of Done)
- [ ] API mới cho Reconciliation hoạt động đúng, trả về DTO Zod schema.
- [ ] Hiển thị Ledger Table với đầy đủ dữ liệu, filter và real-time update.
- [ ] `ManualMatchDialog` cho phép OWNER/ADMIN gắn giao dịch với đơn hàng thành công, đổi trạng thái sang RECONCILED.
- [ ] AGENT không thể thao tác Manual Match.
- [ ] Log thao tác được ghi nhận lại vào DB.

---

## TASK-3B-04: Xây dựng luồng đăng ký Shop mới và tạo tài khoản nhân viên

### 1. Mục tiêu & Trải nghiệm Người dùng (User Journey & Value)
- **Mục tiêu:** Đồng bộ mô hình "1 tài khoản = 1 shop", thay thế hoàn toàn flow invite cũ, giúp onboarding nhanh chóng và quản lý nhân viên khép kín.
- **Trải nghiệm:**
  - **Đăng ký (Register):** Tại trang `/register`, người dùng nhập tên shop, tên chủ shop, email, password. Submit xong hệ thống tự động login và đưa thẳng vào Dashboard.
  - **Quản lý nhân viên (Settings > Members):** 
    - OWNER/ADMIN vào mục quản lý nhân sự, chọn "Add Employee".
    - Điền tên, email và phân quyền (ADMIN hoặc AGENT).
    - Hệ thống tạo luôn tài khoản, thêm vào workspace hiện tại, và gửi email chứa thông tin đăng nhập hoặc link set password.
    - Nhân viên dùng tài khoản này login sẽ vào thẳng shop (không qua bước chọn Workspace nào cả).

### 2. Quy tắc nghiệp vụ & Bất biến (Business Rules & Invariants)
- **Atomicity:**
  - Khi register: Tạo `User` (platformRole: USER), tạo `Workspace` (name = tên shop), tạo `WorkspaceMember` (role: OWNER) trong một database transaction.
  - Khi tạo nhân viên: Tạo `User`, tạo `WorkspaceMember` trong một transaction.
- **RBAC:**
  - OWNER có thể đổi role cho member (ADMIN <-> AGENT).
  - OWNER có thể xoá bất kỳ member nào.
  - ADMIN có thể mời nhân viên, nhưng **KHÔNG THỂ** xoá OWNER.
- **Email/Validation:** Email phải unique trên toàn hệ thống. Tên shop phải có độ dài tối thiểu.

### 3. Ranh giới & Điều cấm (Constraints & Out-of-Scope)
- **Bỏ hẳn:**
  - Flow gửi email invite bằng link token cũ, phải join workspace.
  - Màn hình Workspace Selection (chọn shop).
  - Khả năng 1 user tham gia nhiều workspaces (chặn ở mức DB/logic nếu cần, hoặc bỏ hết UI liên quan).
- **KHÔNG** làm luồng quản lý multi-shop cho 1 account.

### 4. Tài liệu tham chiếu (References)
- Prisma Models: `User`, `Workspace`, `WorkspaceMember`.
- Auth Controller cho `POST /auth/register` và `POST /workspaces/:id/members` mới.

### 5. Tiêu chí nghiệm thu (Acceptance Criteria & Definition of Done)
- [ ] Luồng đăng ký tại `/register` tạo đủ 3 records (User, Workspace, Member) và auto-login thành công.
- [ ] Bỏ hoàn toàn màn hình Workspace Selection khỏi app.
- [ ] Tính năng "Add Employee" trong Settings tạo tài khoản nhân viên thành công và gửi email đúng.
- [ ] Nhân viên login vào thẳng hệ thống, không cần chọn shop.
- [ ] OWNER có thể xoá member, ADMIN không thể xoá OWNER.

---

## Kiểm chứng (Verification)
- Đảm bảo tất cả backend endpoint trả về trực tiếp Prisma Model hoặc DTO thông qua Zod schema (KISS).
- Code frontend lấy dữ liệu qua TanStack Query, tuân thủ UI Shadcn.
- Các điều cấm và giới hạn của Phase 3A (xóa bỏ tính năng đa shop, shipping) đã được phản ánh đúng trong trải nghiệm của Phase 3B.
