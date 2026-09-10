# PRD: Super Admin Portal & System Configuration Engine (Sales Copilot)

| Document Metadata | Value |
| :--- | :--- |
| **Status** | 🟡 APPROVED FOR IMPLEMENTATION |
| **Author** | Antigravity AI Platform Architect |
| **Target Release** | Phase 2 Platform Management Baseline |
| **Target Audience** | Platform Owners, DevOps/System Administrators, Level-2 Support Engineers |
| **Reviewed by** | Lead Architect, Security Officer, Product Owner |

---

## 1. Executive Summary & Problem Statement

### 1.1 Bối cảnh (Background)
Sales Copilot đã hoàn thiện Phase 1 (Nền tảng hội thoại đa kênh Omnichannel) và đang triển khai Phase 2 (Thương mại hội thoại D2C & In-Chat POS). Hệ thống hoạt động theo mô hình **SaaS Đa người thuê (Multi-Tenancy)**, trong đó mỗi doanh nghiệp sở hữu một `Workspace` độc lập, với các kênh kết nối (Facebook, Zalo, Telegram, Webchat), sản phẩm, đơn hàng và kho hàng riêng.

### 1.2 Vấn đề hiện hữu (Problem Statement)
1. **Thiếu công cụ quản trị cấp nền tảng (Lack of Platform-Level Visibility)**:
   - Đội ngũ quản trị hệ sinh thái (Platform Owner / DevOps) không có giao diện trực quan để xem tổng số workspace đang hoạt động, tỷ lệ kích hoạt, phân bổ gói cước (`FREE`, `STANDARD`, `ENTERPRISE`), và mức tiêu thụ tài nguyên.
   - Khi một tenant vi phạm điều khoản dịch vụ (spam tin nhắn, quá tải đơn ảo, chậm thanh toán), quản trị viên phải can thiệp thủ công bằng SQL script trực tiếp vào database production để khóa tài khoản hoặc hạ gói cước — tiềm ẩn rủi ro sai sót dữ liệu cực lớn.
2. **Cấu hình hệ thống tĩnh & Phụ thuộc Redeploy (Static Configuration Bottleneck)**:
   - Các tham số vận hành như: Hạn mức quota mặc định, danh sách Model LLM kích hoạt (Gemini, OpenAI, DeepSeek), các Feature Flags (bật/tắt thử nghiệm POS VietQR, AI Midnight Checkout, Realtime Comment Masking) đang bị gắn cứng (hardcoded) hoặc lưu trong biến môi trường `.env`.
   - Mỗi lần muốn bật một tính năng mới cho hệ thống hoặc điều chỉnh quota, đội ngũ kỹ thuật phải cập nhật file cấu hình và khởi động lại dịch vụ (pod redeploy), gây gián đoạn kết nối WebSocket của hàng ngàn nhân viên bán hàng.
3. **Thiếu cơ chế kiểm toán hành động quản trị (No Platform Audit Trail)**:
   - Các thao tác can thiệp trực tiếp từ cấp nền tảng (nâng cấp gói cước, điều chỉnh quota, khóa shop) chưa có bảng ghi nhận vết (audit log) độc lập, không thể đối soát khi xảy ra tranh chấp hoặc sự cố vận hành.

### 1.3 Mục tiêu giải pháp (Proposed Solution)
Xây dựng phân hệ **Super Admin Portal** và **Dynamic System Settings Engine** được tích hợp sẵn (co-located) trong `apps/web` dưới route `/admin` và backend `apps/server` dưới module `PlatformAdminModule`:
- Cung cấp bảng điều khiển trung tâm giúp quản lý toàn diện vòng đời Workspaces và phân bổ tài nguyên.
- Cho phép quản trị viên điều chỉnh cấu hình hệ thống và bật/tắt Feature Flags động với độ trễ phản hồi `< 1s` nhờ kiến trúc bộ nhớ đệm 2 tầng (PostgreSQL + Redis Cache).
- Đảm bảo an toàn bảo mật tuyệt đối với chính sách **Metadata-Only** (không đọc trộm dữ liệu tin nhắn nhạy cảm của khách hàng) và ghi vết 100% qua `PlatformAuditLog`.

---

## 2. Personas & Use Cases

| Persona | Vai trò | Trách nhiệm chính | Nhu cầu then chốt |
| :--- | :--- | :--- | :--- |
| **Platform Owner** (Chủ sàn SaaS) | Người sở hữu nền tảng Sales Copilot | Định hướng kinh doanh, giám sát tăng trưởng số lượng tenant, tối ưu chi phí hạ tầng AI | Xem Dashboard tổng quan (DAU/MAU, tổng đơn hàng, tổng tenant), điều chỉnh gói cước và giới hạn quota. |
| **DevOps / SysAdmin** | Kỹ sư vận hành hệ thống | Duy trì độ ổn định 99.9% uptime, quản lý kết nối hạ tầng | Bật/tắt Feature Flags khi roll-out tính năng, điều chỉnh LLM fallback model khi nhà cung cấp gặp sự cố, theo dõi nhật ký kiểm toán. |
| **Level-2 Support Lead** | Trưởng bộ phận hỗ trợ kỹ thuật | Xử lý khiếu nại, hỗ trợ khách hàng gặp lỗi vận hành | Tìm kiếm nhanh workspace theo slug/email chủ shop, kiểm tra hạn mức sử dụng (used vs quota), tạm khóa workspace gian lận. |

---

## 3. Core Product Guardrails & Design Principles

1. 🛡️ **Nguyên tắc "Metadata-Only Privacy" (Bảo vệ Riêng tư Tuyệt đối)**:
   - Super Admin **chỉ được xem và quản lý siêu dữ liệu** (metadata: tên shop, gói cước, số lượng kênh, tổng số tin nhắn phát sinh, trạng thái kết nối).
   - Tuyệt đối **không hiển thị nội dung tin nhắn chat**, số điện thoại khách hàng cuối hay chi tiết sản phẩm/doanh thu riêng tư của tenant trên cổng Super Admin.
2. ⚡ **Cấu hình Động Không Cần Khởi Động Lại (Zero-Downtime Hot-Reloading)**:
   - Mọi thay đổi về cấu hình hệ thống, Feature Flags, Quota mặc định lưu vào PostgreSQL và đồng bộ ngay lập tức vào Redis cache (`system:settings:*`).
   - Các worker, chat engine và LLM gateway đọc trực tiếp từ cache trong RAM, nhận diện giá trị mới ngay lập tức mà không cần restart server hay drop WebSocket connection.
3. 🔒 **Phân lập Quyền hạn Nghiêm ngặt (Strict Platform Roles Separation)**:
   - Chỉ tài khoản có `PlatformRole === SUPER_ADMIN` mới được phép truy cập route `/admin` và gọi các API `/platform-admin/*`.
   - Các API Super Admin là **Platform-level (Cross-tenant)**, tách biệt hoàn toàn với `WorkspaceGuard` (vốn đòi hỏi `x-workspace-id`).
4. 📝 **Bất biến Kiểm toán (100% Auditability)**:
   - Mọi thao tác ghi/sửa/xóa từ Super Admin (thay đổi gói cước, chỉnh quota, khóa workspace, sửa cấu hình hệ thống) bắt buộc phải tạo một bản ghi bất biến trong `PlatformAuditLog` lưu kèm ID người thực hiện, địa chỉ IP và giá trị thay đổi (diff).

---

## 4. Functional Requirements (Yêu cầu Chức năng)

### 4.1 Khối A: Quản lý Tenant & Multi-Tenancy (Workspaces Management)

- **FR-SA-1.1: Danh sách & Tìm kiếm Workspaces**:
  - Hiển thị danh sách toàn bộ Workspaces trong hệ thống dưới dạng bảng dữ liệu (Shadcn Table) có phân trang (10/20/50 dòng), sắp xếp theo ngày tạo hoặc tên.
  - Hỗ trợ bộ lọc nhanh:
    - Tìm kiếm từ khóa (Search theo Tên shop, Slug, hoặc Email của Owner).
    - Lọc theo Gói cước (`BillingPlanType`: `FREE`, `STANDARD`, `ENTERPRISE`).
    - Lọc theo Trạng thái (`ACTIVE`, `SUSPENDED`).
  - Cột dữ liệu hiển thị: Tên shop & Logo, Slug, Chủ sở hữu (Owner Email), Gói cước (Badge màu), Số thành viên hiện tại / Tối đa, Số kênh kết nối, Ngày đăng ký, Trạng thái hoạt động, Nút thao tác nhanh.

- **FR-SA-1.2: Chi tiết Workspace (Metadata View)**:
  - Xem thông số kỹ thuật và chỉ số sử dụng tài nguyên của một Workspace:
    - Thông tin chung: ID, Slug, Timezone, Default Language, Ngày tạo, Ngày cập nhật lần cuối.
    - Danh sách thành viên (Tên, Email, `WorkspaceRole`: OWNER, ADMIN, AGENT).
    - Hạn mức Quota hiện tại và mức độ tiêu thụ (Usage vs Quota):
      - Số lượng nhân sự: `currentAgents / maxAgents`.
      - Số kênh tích hợp: `currentChannels / maxChannels`.
      - Dung lượng tệp đính kèm MinIO: `storageUsedMb / storageLimitMb`.
      - AI Tokens tiêu thụ trong tháng: `aiUsedTokens / aiMonthlyTokensCap`.

- **FR-SA-1.3: Cập nhật Gói cước & Điều chỉnh Hạn mức Quota**:
  - Super Admin có thể thay đổi `billingPlan` của Workspace giữa `FREE`, `STANDARD`, `ENTERPRISE`.
  - Hỗ trợ ghi đè (override) hạn mức quota tùy chỉnh trực tiếp cho từng Workspace cụ thể:
    - Số lượng nhân sự tối đa (`maxAgents`).
    - Số kênh liên lạc tối đa (`maxChannels`).
    - Giới hạn lưu trữ tệp (`storageLimitMb`).
    - Giới hạn token AI hàng tháng (`aiMonthlyTokens`).
  - Ghi nhận `PlatformAuditLog` với action `QUOTA_UPDATED` hoặc `PLAN_CHANGED`.

- **FR-SA-1.4: Tạm khóa (Suspend) & Kích hoạt lại (Activate) Workspace**:
  - Cho phép Super Admin tạm khóa một workspace vi phạm điều khoản dịch vụ:
    - Khi bấm "Tạm khóa", hiển thị hộp thoại xác nhận (AlertDialog) bắt buộc nhập **Lý do tạm khóa** (Suspension Reason).
    - Cập nhật trường `isSuspended: true`, `suspendedReason`, `suspendedAt: now()`.
    - Sau khi bị khóa, toàn bộ thành viên trong workspace đó khi thao tác sẽ nhận thông báo lỗi HTTP 403 `WORKSPACE_SUSPENDED` và bị chặn gửi tin nhắn / tạo đơn hàng mới.
  - Cho phép Super Admin "Kích hoạt lại" (`Activate`) để mở khóa workspace khi vấn đề đã được giải quyết.

---

### 4.2 Khối B: Cấu hình Hệ thống & Feature Flags (System Settings Engine)

- **FR-SA-2.1: Quản lý Cấu hình Tập trung theo Phân loại (Categorized Settings)**:
  - Cung cấp giao diện phân tab khoa học để quản lý các nhóm tham số hệ thống:
    1. 🚩 **Feature Flags**: Bật/tắt các module tính năng toàn hệ sinh thái:
       - `feature.pos_vietqr_enabled`: Kích hoạt cổng thanh toán VietQR & Reconcile tự động.
       - `feature.ai_autopilot_enabled`: Cho phép AI tự động chốt đơn và đàm phán giảm giá ban đêm.
       - `feature.comment_masking_enabled`: Kích hoạt module tự động ẩn bình luận chứa số điện thoại.
       - `feature.thermal_print_enabled`: Kích hoạt tính năng in phiếu gửi nhiệt K80/K58.
    2. 🤖 **AI & LLM Defaults**:
       - `llm.default_provider`: Nhà cung cấp LLM mặc định (`GEMINI`, `OPENAI`, `ANTHROPIC`, `DEEPSEEK`).
       - `llm.default_model`: Model mặc định (VD: `gemini-2.5-flash`, `gpt-4o-mini`).
       - `llm.temperature_default`: Độ ngẫu nhiên mặc định cho tác vụ bán hàng (VD: `0.3`).
       - `llm.max_tokens_limit`: Giới hạn tokens phản hồi tối đa.
    3. ⚖️ **Default Quotas (Hạn mức mặc định theo gói)**:
       - Cấu hình hạn mức mặc định khi tạo mới workspace cho từng gói cước `FREE`, `STANDARD`, `ENTERPRISE` (Số agents, số kênh, dung lượng MB).
    4. 📢 **System Announcements (Thông báo toàn hệ thống)**:
       - `system.maintenance_mode`: Bật chế độ bảo trì hệ thống.
       - `system.banner_message`: Nội dung thông báo hiển thị trên đầu thanh điều hướng của toàn bộ người dùng (VD: "Hệ thống sẽ bảo trì nâng cấp vào 01:00 AM ngày 15/09").
       - `system.banner_level`: Mức độ cảnh báo (`INFO`, `WARNING`, `CRITICAL`).

- **FR-SA-2.2: Cập nhật & Kiểm tra Giá trị Tức thì**:
  - Hỗ trợ công tắc bật/tắt (Switch Shadcn) cho các cờ Boolean.
  - Hỗ trợ form nhập liệu có xác thực dữ liệu (Number, String, JSON) bằng Zod Schema.
  - Khi lưu cấu hình:
    - Validate schema nghiêm ngặt trên backend.
    - Cập nhật vào PostgreSQL bảng `system_settings`.
    - Đồng bộ ghi đè vào Redis key `system:settings:{key}` và `system:settings:all`.
    - Ghi nhận `PlatformAuditLog` với action `SYSTEM_SETTING_UPDATED`.
    - Hiển thị thông báo Toast thành công (`sonner`).

---

### 4.3 Khối C: Nhật ký Kiểm toán Nền tảng (Platform Audit Logs)

- **FR-SA-3.1: Ghi nhận Tự động Mọi Hành động của Super Admin**:
  - Mọi thao tác làm thay đổi dữ liệu trên Cổng Super Admin đều được ghi nhận tự động vào bảng `platform_audit_logs`.
  - Thông tin lưu trữ bao gồm:
    - `actorId`, `actorEmail`: Danh tính Super Admin thực hiện.
    - `action`: Hành động (`WORKSPACE_SUSPENDED`, `WORKSPACE_ACTIVATED`, `PLAN_CHANGED`, `QUOTA_UPDATED`, `SYSTEM_SETTING_UPDATED`).
    - `targetType`: Loại đối tượng bị tác động (`WORKSPACE`, `SYSTEM_SETTING`, `USER`).
    - `targetId`: ID của đối tượng bị tác động.
    - `metadata`: Đối tượng JSON lưu chi tiết thay đổi (giá trị cũ `oldValue`, giá trị mới `newValue`, lý do `reason`).
    - `ipAddress`, `userAgent`: Địa chỉ IP và trình duyệt của Super Admin.
    - `createdAt`: Thời điểm chính xác thực hiện hành động.

- **FR-SA-3.2: Giao diện Tra cứu Nhật ký Kiểm toán**:
  - Xem danh sách Audit Logs dưới dạng bảng dòng thời gian (Timeline/Table).
  - Hỗ trợ lọc theo loại hành động (`action`), theo ID đối tượng (`targetId`), hoặc tìm kiếm theo email quản trị viên.
  - Dialog xem chi tiết JSON metadata biểu thị khác biệt trước và sau khi thay đổi (Diff Viewer).

---

### 4.4 Khối D: Tổng quan Vận hành Nền tảng (Dashboard Overview)

- **FR-SA-4.1: Các Thẻ Chỉ số Tổng hợp (KPI Metrics Cards)**:
  - **Tổng số Workspaces**: Tổng số tenant đã đăng ký, tỷ lệ hoạt động (`Active`) và tạm khóa (`Suspended`).
  - **Tổng số Người dùng Nền tảng (Users)**: Số lượng tài khoản nhân sự trên toàn hệ thống.
  - **Tổng số Hội thoại & Đơn hàng**: Tổng số hội thoại đa kênh và đơn hàng được khởi tạo qua hệ thống (chỉ hiển thị con số thống kê tổng lượng, không hiển thị dữ liệu chi tiết).
  - **Trạng thái Dịch vụ Hạ tầng**: Tình trạng kết nối tới PostgreSQL, Redis Cache, và MinIO S3.

---

## 5. Non-Functional Requirements (Yêu cầu Phi chức năng)

1. **NFR-SA-1 (Hiệu năng & Tốc độ Phản hồi)**:
   - Đọc cấu hình hệ thống qua `SystemSettingsService.getSetting()` đạt độ trễ `< 2ms` nhờ Redis in-memory cache.
   - Các API truy vấn danh sách Workspaces và Audit Logs có phân trang trả về trong `< 200ms` với quy mô dữ liệu tới 50.000 workspaces.
2. **NFR-SA-2 (Bảo mật Đa tầng - Defense in Depth)**:
   - Tầng Edge/Next.js Middleware: Ngăn chặn truy cập `/admin/*` ngay tại request đầu tiên nếu cookie không chứa JWT hợp lệ với `role === SUPER_ADMIN`.
   - Tầng Backend API: Tất cả controller `/platform-admin/*` được bảo vệ bằng `@UseGuards(JwtAuthGuard, PlatformRolesGuard)` và `@PlatformRoles(PlatformRole.SUPER_ADMIN)`.
3. **NFR-SA-3 (Bất biến Dữ liệu Kiểm toán - Immutability)**:
   - Bảng `platform_audit_logs` là Append-Only. Backend tuyệt đối không cung cấp bất kỳ API nào để sửa (`UPDATE`) hoặc xóa (`DELETE`) các bản ghi audit log.
4. **NFR-SA-4 (Tương thích & Tái sử dụng UI)**:
   - 100% giao diện sử dụng các primitives có sẵn trong `apps/web/src/components/ui/` (Table, Card, Button, Badge, Switch, Dialog, Tabs, Input).
   - Hỗ trợ đầy đủ Dark Mode và Light Mode đồng bộ với toàn hệ thống qua Tailwind semantic tokens.

---

## 6. Out of Scope (Phạm vi Loại trừ trong Giai đoạn Này)

- ❌ **Không triển khai Impersonation ("Login as Tenant")**: Không cho phép Super Admin đăng nhập mạo danh vào khung chat của cửa hàng khách hàng, tuân thủ nghiêm ngặt chính sách Metadata-only.
- ❌ **Không triển khai Quản lý Thanh toán Cổng ngoài tự động (Billing Payment Gateway Checkout)**: Việc thanh toán phí gói cước SaaS của khách hàng được xử lý thủ công hoặc tích hợp trong phân kỳ sau.
- ❌ **Không can thiệp vào Logic Nghiệp vụ Tenant Core**: Không sửa đổi các contracts và state machines của Phase 1 và Phase 2 POS.
