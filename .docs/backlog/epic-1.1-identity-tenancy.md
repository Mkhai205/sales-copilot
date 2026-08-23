# Epic 1.1: Identity & Multi-Tenancy

## 1. Overview
Hiện thực hóa hệ thống xác thực danh tính người dùng độc lập (`User`), phân chia không gian làm việc đa người thuê (`Workspace`), bảo vệ ranh giới dữ liệu qua Tenant Isolation (`WorkspaceGuard` sử dụng header `X-Workspace-Id`), phân quyền thành viên dựa trên vai trò (`WorkspaceMember`, `WorkspaceRole`, `RolesGuard`), và quản lý đội ngũ nhân sự nội bộ (`Team`).

- **ID**: `EPIC-1.1`
- **Status**: ✅ Done
- **Dependencies**: `EPIC-1.0` (Foundation & Database Baseline)
- **References**:
  - `.docs/references/chatwoot/source/app/models/account.rb`
  - `.docs/references/chatwoot/source/app/models/user.rb`
  - `.docs/references/chatwoot/source/app/models/team.rb`
  - `.docs/references/chatwoot/source/app/controllers/api/v1/accounts_controller.rb`
  - `.docs/references/chatwoot/source/app/controllers/api/v1/accounts/account_users_controller.rb`

---

## 2. Features & Tasks Summary

```text
Epic 1.1: Identity & Multi-Tenancy
├── Feature F-1.1.1: Authentication & Token Security
│   ├── Task T-1.1.1.1: Password Hashing Service [IMPLEMENTATION]
│   ├── Task T-1.1.1.2: Authentication Contracts & DTOs [IMPLEMENTATION]
│   ├── Task T-1.1.1.3: JWT Token Engine & Rotation Strategy [IMPLEMENTATION]
│   ├── Task T-1.1.1.4: Login & Token Refresh Application Logic [IMPLEMENTATION]
│   ├── Task T-1.1.1.5: Authentication API & JwtAuthGuard [IMPLEMENTATION]
│   └── Task T-1.1.1.6: Authentication Test Suite [TEST]
│
├── Feature F-1.1.2: Multi-Tenant Workspace & Tenant Isolation
│   ├── Task T-1.1.2.1: Workspace Contracts & DTOs [IMPLEMENTATION]
│   ├── Task T-1.1.2.2: Workspace Persistence Layer [IMPLEMENTATION]
│   ├── Task T-1.1.2.3: Workspace Provisioning & Slug Management [IMPLEMENTATION]
│   ├── Task T-1.1.2.4: Tenant Isolation Guard & Context Injection [IMPLEMENTATION]
│   ├── Task T-1.1.2.5: Workspace Management API [IMPLEMENTATION]
│   └── Task T-1.1.2.6: Workspace Isolation Test Suite [TEST]
│
├── Feature F-1.1.3: Workspace Members & Role-Based Access Control
│   ├── Task T-1.1.3.1: Workspace Member Contracts & RBAC Schema [IMPLEMENTATION]
│   ├── Task T-1.1.3.2: Workspace Member Persistence & Business Logic [IMPLEMENTATION]
│   ├── Task T-1.1.3.3: Role-Based Access Control Guard [IMPLEMENTATION]
│   ├── Task T-1.1.3.4: Member Management API [IMPLEMENTATION]
│   └── Task T-1.1.3.5: RBAC Authorization Test Suite [TEST]
│
└── Feature F-1.1.4: Team Management & Member Assignment
    ├── Task T-1.1.4.1: Team Contracts & DTOs [IMPLEMENTATION]
    ├── Task T-1.1.4.2: Team Persistence & Business Logic [IMPLEMENTATION]
    ├── Task T-1.1.4.3: Team Management API [IMPLEMENTATION]
    └── Task T-1.1.4.4: Team Management Test Suite [TEST]
```

---

# 🚀 FEATURES & TASKS SPECIFICATION

---

## 📦 Feature F-1.1.1: Authentication & Token Security

### Objective
Cung cấp cơ chế xác thực danh tính người dùng an toàn bằng Argon2id, cấp phát JWT Access Token thuần danh tính (Identity-Only JWT) và cơ chế xoay vòng Refresh Token (Token Rotation).

### Scope
- Password authentication (Argon2id)
- Identity-only JWT Access token (15m, chứa `userId`, `email`, `platformRole`)
- Refresh token rotation & session revocation
- Authenticated user profile endpoint (`GET /api/v1/auth/me`)

### Acceptance Criteria
- [x] Password không bao giờ lưu dưới dạng plaintext
- [x] JWT Access token chỉ chứa thông tin danh tính người dùng, không gắn cứng `workspaceId` hoặc `workspaceRole`
- [x] Refresh token hỗ trợ xoay vòng (cấp token mới và vô hiệu hóa token cũ)
- [x] Refresh token đã bị thu hồi hoặc hết hạn bị từ chối `401 Unauthorized`
- [x] Tài khoản bị vô hiệu hóa (`isActive = false`) không thể đăng nhập hoặc làm mới token

### Dependencies
- `EPIC-1.0` (Foundation & Database Baseline)

---

### Task T-1.1.1.1: Password Hashing Service
- **Type**: `IMPLEMENTATION`
- **Objective**: Xây dựng service băm và xác minh password sử dụng thuật toán Argon2id.
- **Context**: `User.passwordHash` phải được bảo vệ bằng giải thuật băm an toàn theo tiêu chuẩn OWASP. Service này là nền tảng cho luồng Authentication.
- **Scope**:
  - Password hashing
  - Password verification
  - Unit tests
- **Non-Goals**: Không xử lý login flow, JWT, database access hoặc controller.
- **Acceptance Criteria**:
  - [x] Password được hash bằng Argon2id
  - [x] Password đúng verify thành công (`true`)
  - [x] Password sai verify thất bại (`false`)
  - [x] Không lưu hoặc log plaintext password
- **Dependencies**: `EPIC-1.0`

---

### Task T-1.1.1.2: Authentication Contracts & DTOs
- **Type**: `IMPLEMENTATION`
- **Objective**: Định nghĩa Zod schemas và TypeScript DTOs cho luồng xác thực trong shared contracts package.
- **Context**: Đảm bảo type safety và input validation chặt chẽ giữa Backend và Frontend.
- **Scope**:
  - Login request & response schemas
  - Token refresh request & response schemas
  - User profile response schema
- **Non-Goals**: Không viết business logic xử lý đăng nhập hay database query.
- **Acceptance Criteria**:
  - [x] Email và password được validate chặt chẽ theo chuẩn Zod
  - [x] Shared package typecheck thành công không có lỗi
- **Dependencies**: `EPIC-1.0`

---

### Task T-1.1.1.3: JWT Token Engine & Rotation Strategy
- **Type**: `IMPLEMENTATION`
- **Objective**: Xây dựng dịch vụ sinh token, ký số JWT thuần danh tính và cơ chế quản lý trạng thái Refresh Token.
- **Context**: JWT access token mang thông tin định danh người dùng toàn cục (`userId`, `email`, `platformRole`); refresh token dùng để cấp mới và hỗ trợ thu hồi tức thì.
- **Scope**:
  - Generate identity access & refresh tokens
  - Token verification & decoding
  - Refresh token rotation & invalidation mechanism
- **Non-Goals**: Không đính kèm `workspaceId` hoặc `workspaceRole` vào JWT payload; không tạo HTTP endpoints trong task này.
- **Acceptance Criteria**:
  - [x] Access token mang payload định danh thuần túy (`sub: userId`, `email`, `role: platformRole`)
  - [x] Cơ chế rotation cấp token mới và vô hiệu hóa token cũ
- **Dependencies**: `EPIC-1.0`

---

### Task T-1.1.1.4: Login & Token Refresh Application Logic
- **Type**: `IMPLEMENTATION`
- **Objective**: Hiện thực hóa use cases đăng nhập, kiểm tra trạng thái tài khoản và cấp mới phiên làm việc.
- **Context**: Tầng Application điều phối giữa User data access, PasswordService và TokenService.
- **Scope**:
  - Login use case
  - Refresh token use case
  - Domain / Application exceptions
- **Non-Goals**: Không xử lý HTTP request/response context.
- **Acceptance Criteria**:
  - [x] Đăng nhập thành công trả về đúng User Info và Token cặp
  - [x] Sai thông tin đăng nhập ném lỗi `401 Unauthorized`
  - [x] Tài khoản `isActive = false` bị từ chối đăng nhập với mã `403 Forbidden`
- **Dependencies**: `T-1.1.1.1`, `T-1.1.1.3`

---

### Task T-1.1.1.5: Authentication API & JwtAuthGuard
- **Type**: `IMPLEMENTATION`
- **Objective**: Hiện thực REST API controller cho Auth, cấu hình `JwtAuthGuard` và decorator `@CurrentUser()`.
- **Context**: Tầng Presentation tiếp nhận HTTP request từ client.
- **Scope**:
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/refresh`
  - `GET /api/v1/auth/me`
  - `JwtAuthGuard` & `@CurrentUser()` decorator
- **Non-Goals**: Không chứa business logic trong controller handlers.
- **Acceptance Criteria**:
  - [x] Input tự động validate qua Zod Validation Pipe
  - [x] `GET /api/v1/auth/me` yêu cầu Bearer token hợp lệ, trả về 401 nếu thiếu hoặc token sai
  - [x] Phản hồi tuân thủ chuẩn envelope `{ success: true, data: ... }`
- **Dependencies**: `T-1.1.1.4`

---

### Task T-1.1.1.6: Authentication Test Suite
- **Type**: `TEST`
- **Objective**: Xây dựng bộ test tự động kiểm thử toàn diện luồng xác thực (Unit & Integration).
- **Context**: Bảo đảm không có hồi quy (Regression) trong module Authentication.
- **Scope**:
  - Unit tests cho use cases
  - Integration tests cho các endpoints Auth
- **Non-Goals**: Không sửa đổi mã nguồn nghiệp vụ nếu tests đã pass.
- **Acceptance Criteria**:
  - [x] Kiểm thử thành công các kịch bản happy path và mã lỗi (400, 401, 403)
- **Dependencies**: `T-1.1.1.5`

---

## 📦 Feature F-1.1.2: Multi-Tenant Workspace & Tenant Isolation

### Objective
Cung cấp khả năng quản lý không gian làm việc đa người thuê (`Workspace`), khởi tạo workspace mới, xác thực và cô lập ranh giới dữ liệu giữa các tenant qua `WorkspaceGuard` thống nhất bằng HTTP Header `X-Workspace-Id`.

### Scope
- Workspace provisioning & unique slug generation
- User workspaces list (`GET /api/v1/workspaces`)
- Current workspace details & settings (`GET/PATCH /api/v1/workspaces/current`)
- `WorkspaceGuard` trích xuất `X-Workspace-Id` và resolve context thành viên

### Acceptance Criteria
- [x] Mỗi Workspace có slug duy nhất trên toàn hệ thống
- [x] Tenant context được chuẩn hóa qua HTTP Header `X-Workspace-Id`
- [x] User không thể truy cập tài nguyên của Workspace mà mình không phải là thành viên (`403 Forbidden`)

### Dependencies
- `F-1.1.1` (Authentication & Token Security)

---

### Task T-1.1.2.1: Workspace Contracts & DTOs
- **Type**: `IMPLEMENTATION`
- **Objective**: Định nghĩa Zod schemas và DTOs cho các thao tác quản lý Workspace.
- **Context**: Chuẩn hóa hợp đồng dữ liệu cho Workspace module.
- **Scope**:
  - Create workspace schema
  - Update workspace settings schema
  - Workspace response DTOs
- **Non-Goals**: Không viết database query hay controller.
- **Acceptance Criteria**:
  - [x] Validate chặt chẽ tên workspace và định dạng slug
- **Dependencies**: `EPIC-1.0`

---

### Task T-1.1.2.2: Workspace Persistence Layer
- **Type**: `IMPLEMENTATION`
- **Objective**: Xây dựng tầng Data Access cho thực thể `Workspace`.
- **Context**: Cung cấp interface và implementation tương tác với bảng `workspaces` trong PostgreSQL.
- **Scope**:
  - Workspace repository interface
  - Prisma workspace repository implementation
- **Non-Goals**: Không quản lý logic thành viên (thuộc Feature F-1.1.3).
- **Acceptance Criteria**:
  - [x] Hỗ trợ tìm kiếm theo ID, Slug và danh sách Workspace theo User
- **Dependencies**: `T-1.1.2.1`

---

### Task T-1.1.2.3: Workspace Provisioning & Slug Management
- **Type**: `IMPLEMENTATION`
- **Objective**: Hiện thực Use Case khởi tạo Workspace, tự động tạo slug duy nhất và gán người tạo làm `OWNER`.
- **Context**: Thiết lập tenant và phân quyền Owner ban đầu trong 1 transaction an toàn.
- **Scope**:
  - Slug generator helper
  - Create workspace use case
  - Atomic transaction tạo `Workspace` và gán `WorkspaceMember` role `OWNER`
- **Non-Goals**: Không viết HTTP controller.
- **Acceptance Criteria**:
  - [x] Slug sinh ra duy nhất, xử lý tốt ký tự tiếng Việt
  - [x] Người tạo luôn có vai trò `OWNER` trong workspace mới tạo
- **Dependencies**: `T-1.1.2.2`

---

### Task T-1.1.2.4: Tenant Isolation Guard & Context Injection
- **Type**: `IMPLEMENTATION`
- **Objective**: Xây dựng Guard chặn truy cập trái phép chéo tenant và Decorator inject Workspace context từ header `X-Workspace-Id`.
- **Context**: Mọi request nghiệp vụ đều phải được kiểm tra tính hợp lệ về quyền thành viên trong Workspace.
- **Scope**:
  - `WorkspaceGuard` (trích xuất header `X-Workspace-Id` và kiểm tra `WorkspaceMember`)
  - `@CurrentWorkspace()` decorator
- **Non-Goals**: Không quyết định phân quyền chi tiết RBAC (sẽ do RolesGuard ở Feature F-1.1.3 đảm nhiệm).
- **Acceptance Criteria**:
  - [x] Trả về `400 Bad Request` nếu thiếu header `X-Workspace-Id`
  - [x] Trả về `403 Forbidden` nếu user không thuộc Workspace được yêu cầu
  - [x] Gán context `{ id, name, slug, memberRole }` vào Request object khi hợp lệ
- **Dependencies**: `T-1.1.2.2`, `T-1.1.1.5`

---

### Task T-1.1.2.5: Workspace Management API
- **Type**: `IMPLEMENTATION`
- **Objective**: Hiện thực REST API controller cho tài nguyên Workspace.
- **Context**: Tầng Presentation cung cấp endpoint cho client.
- **Scope**:
  - `GET  /api/v1/workspaces`
  - `POST /api/v1/workspaces`
  - `GET  /api/v1/workspaces/current`
  - `PATCH /api/v1/workspaces/current`
- **Non-Goals**: Không chứa business logic trong controller.
- **Acceptance Criteria**:
  - [x] Tích hợp đầy đủ `JwtAuthGuard` và `WorkspaceGuard`
  - [x] Trả về response chuẩn envelope
- **Dependencies**: `T-1.1.2.3`, `T-1.1.2.4`

---

### Task T-1.1.2.6: Workspace Isolation Test Suite
- **Type**: `TEST`
- **Objective**: Viết Integration tests kiểm thử tính cô lập dữ liệu giữa các Workspace khác nhau.
- **Context**: Đảm bảo không thể truy cập tài nguyên của tenant khác dưới mọi hình thức.
- **Scope**:
  - Multi-tenancy isolation integration tests
- **Acceptance Criteria**:
  - [x] User A không thể đọc/ghi dữ liệu của Workspace B
  - [x] Tạo workspace thành công sinh đúng slug và vai trò Owner
- **Dependencies**: `T-1.1.2.5`

---

## 📦 Feature F-1.1.3: Workspace Members & Role-Based Access Control

### Objective
Cung cấp khả năng quản lý thành viên trong Workspace (thêm thành viên theo email, cập nhật vai trò `ADMIN`/`AGENT`/`VIEWER`, xóa thành viên) và bộ Guard kiểm soát quyền truy cập RBAC (`RolesGuard`).

### Scope
- Thêm thành viên vào Workspace theo email
- Xem danh sách thành viên (`GET /api/v1/workspaces/current/members`)
- Cập nhật vai trò thành viên
- Xóa thành viên khỏi Workspace
- `@Roles()` decorator & `RolesGuard` với Permission Matrix rõ ràng

### Acceptance Criteria
- [x] Chỉ `OWNER` và `ADMIN` mới có quyền thêm, sửa vai trò hoặc xóa thành viên
- [x] Không cho phép xóa thành viên là `OWNER` duy nhất
- [x] `AGENT` và `VIEWER` bị chặn (`403 Forbidden`) khi cố truy cập các endpoint quản trị

### Dependencies
- `F-1.1.2` (Multi-Tenant Workspace)

---

### Task T-1.1.3.1: Workspace Member Contracts & RBAC Schema
- **Type**: `IMPLEMENTATION`
- **Objective**: Định nghĩa DTOs, Zod schemas và Permission Matrix cho quản lý thành viên Workspace.
- **Context**: Chuẩn hóa dữ liệu đầu vào cho các thao tác quản trị thành viên.
- **Scope**:
  - Add member schema (email, role)
  - Update member role schema
  - Member list response DTO
  - RBAC Permission Matrix definition
- **Non-Goals**: Không xử lý persistence hay HTTP handlers.
- **Acceptance Criteria**:
  - [x] Không cho phép gán trực tiếp vai trò `OWNER` qua endpoint add thông thường
- **Dependencies**: `EPIC-1.0`

---

### Task T-1.1.3.2: Workspace Member Persistence & Business Logic
- **Type**: `IMPLEMENTATION`
- **Objective**: Xây dựng tầng Data Access và nghiệp vụ thêm/sửa/xóa thành viên Workspace.
- **Context**: Quản lý quan hệ `WorkspaceMember` giữa User và Workspace.
- **Scope**:
  - WorkspaceMember repository
  - Member management use cases (List, Add, UpdateRole, Remove)
- **Non-Goals**: Không xử lý HTTP request/response.
- **Acceptance Criteria**:
  - [x] Ngăn chặn trùng lặp thành viên trong cùng một workspace (`@@unique([workspaceId, userId])`)
  - [x] Ngăn chặn hạ quyền hoặc xóa Owner duy nhất
- **Dependencies**: `T-1.1.3.1`

---

### Task T-1.1.3.3: Role-Based Access Control Guard
- **Type**: `IMPLEMENTATION`
- **Objective**: Hiện thực Guard kiểm tra vai trò `WorkspaceRole` của user theo Permission Policy rõ ràng.
- **Context**: Bảo vệ các API quản trị chỉ cho phép role phù hợp.
- **Scope**:
  - `@Roles()` decorator
  - `RolesGuard` implementation
- **Non-Goals**: Không thay thế `WorkspaceGuard` (2 guard hoạt động kết hợp).
- **Acceptance Criteria**:
  - [x] User có role thỏa mãn Permission Policy được phép truy cập
  - [x] Role không đủ quyền bị từ chối với mã `403 Forbidden`
- **Dependencies**: `T-1.1.2.4`

---

### Task T-1.1.3.4: Member Management API
- **Type**: `IMPLEMENTATION`
- **Objective**: Hiện thực REST API controller quản lý thành viên Workspace được bảo vệ bằng `RolesGuard`.
- **Context**: Cung cấp endpoints cho frontend quản trị nhân sự.
- **Scope**:
  - `GET    /api/v1/workspaces/current/members`
  - `POST   /api/v1/workspaces/current/members`
  - `PATCH  /api/v1/workspaces/current/members/:id`
  - `DELETE /api/v1/workspaces/current/members/:id`
- **Non-Goals**: Không chứa business logic trong controller handlers.
- **Acceptance Criteria**:
  - [x] Endpoints POST/PATCH/DELETE yêu cầu quyền `ADMIN` hoặc `OWNER`
- **Dependencies**: `T-1.1.3.2`, `T-1.1.3.3`

---

### Task T-1.1.3.5: RBAC Authorization Test Suite
- **Type**: `TEST`
- **Objective**: Viết Integration tests kiểm thử ma trận phân quyền RBAC đa cấp độ.
- **Context**: Đảm bảo quyền hạn nhân viên được thực thi chuẩn xác.
- **Scope**:
  - RBAC integration tests
- **Acceptance Criteria**:
  - [x] `AGENT` gọi API quản trị nhận `403 Forbidden`
  - [x] `ADMIN` thêm thành viên thành công
- **Dependencies**: `T-1.1.3.4`

---

## 📦 Feature F-1.1.4: Team Management & Member Assignment

### Objective
Cho phép tạo các đội ngũ (`Team`) trong Workspace và gán nhân viên (`TeamMember`) vào đội ngũ phục vụ điều phối và phân công công việc.

### Scope
- CRUD Team trong Workspace (`/api/v1/teams`)
- Thêm và xóa thành viên trong Team (`/api/v1/teams/:id/members`)

### Acceptance Criteria
- [x] Tên Team là duy nhất trong cùng một Workspace (`@@unique([workspaceId, name])`)
- [x] Thành viên thêm vào Team bắt buộc phải là `WorkspaceMember` của cùng Workspace
- [x] Xóa Team không làm xóa tài khoản User

### Dependencies
- `F-1.1.2` (Multi-Tenant Workspace), `F-1.1.3` (Workspace Members)

---

### Task T-1.1.4.1: Team Contracts & DTOs
- **Type**: `IMPLEMENTATION`
- **Objective**: Định nghĩa Zod schemas và TypeScript DTOs cho các thao tác Team.
- **Context**: Chuẩn hóa dữ liệu đầu vào cho Team module.
- **Scope**:
  - Create team schema
  - Update team schema
  - Add team member schema
  - Team response DTOs
- **Non-Goals**: Không viết database query.
- **Acceptance Criteria**:
  - [x] Validate chặt chẽ tên Team (không để trống, độ dài hợp lệ)
- **Dependencies**: `EPIC-1.0`

---

### Task T-1.1.4.2: Team Persistence & Business Logic
- **Type**: `IMPLEMENTATION`
- **Objective**: Hiện thực tầng Data Access và Application Services cho quản lý Team.
- **Context**: Quản lý thực thể `Team` và quan hệ `TeamMember`.
- **Scope**:
  - Team repository
  - Team use cases (List, Create, Update, Delete, AddMember, RemoveMember)
- **Non-Goals**: Không xử lý HTTP context.
- **Acceptance Criteria**:
  - [x] Ngăn chặn tạo 2 team trùng tên trong cùng Workspace
  - [x] Chặn thêm User ngoài Workspace vào Team
- **Dependencies**: `T-1.1.4.1`

---

### Task T-1.1.4.3: Team Management API
- **Type**: `IMPLEMENTATION`
- **Objective**: Hiện thực REST API controller cho tài nguyên Team.
- **Context**: Tầng Presentation cung cấp endpoint quản lý Team.
- **Scope**:
  - `GET/POST   /api/v1/teams`
  - `GET/PATCH/DELETE /api/v1/teams/:id`
  - `POST/DELETE /api/v1/teams/:id/members`
- **Non-Goals**: Không chứa business logic trong controller.
- **Acceptance Criteria**:
  - [x] Tích hợp đầy đủ `WorkspaceGuard` và `RolesGuard` (`@Roles(ADMIN, OWNER)`)
- **Dependencies**: `T-1.1.4.2`

---

### Task T-1.1.4.4: Team Management Test Suite
- **Type**: `TEST`
- **Objective**: Viết Integration tests kiểm thử toàn bộ vòng đời của Team.
- **Context**: Đảm bảo nghiệp vụ quản trị Team hoạt động ổn định.
- **Scope**:
  - Team CRUD integration tests
- **Acceptance Criteria**:
  - [x] Kiểm thử thành công các kịch bản CRUD Team và bắt lỗi trùng tên
- **Dependencies**: `T-1.1.4.3`
