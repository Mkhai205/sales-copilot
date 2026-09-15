# Epic 2.4: Cổng Super Admin Portal & Cấu Hình Động (Platform Administration)

> **Mục tiêu**: Xây dựng trọn vẹn phân hệ quản trị nền tảng cấp Super Admin tại `/admin`: Quản lý danh sách doanh nghiệp (Workspaces), thiết lập hạn mức Quota, bật/tắt Feature Flags động qua bộ nhớ đệm 2 tầng Redis, và tra cứu nhật ký kiểm toán hệ thống `PlatformAuditLog` theo mô hình lát cắt dọc khép kín (Vertical Slices).\
> **Vị trí tài liệu**: `docs/backlog/epic-2.4-super-admin-portal.md`\
> **Phụ thuộc**: `auth`, `workspaces`, `users`\
> **Độ phức tạp**: 🟡 Medium | **Trạng thái**: ⏳ Sẵn sàng thực thi

---

## Danh Sách Lát Cắt Tính Năng Dọc (Vertical Features)

#### Feature 2.4.1: Quản Trị Doanh Nghiệp (Workspaces) & Hạn Mức Quota (End-to-End Tenant Management)
*Trọn gói từ Phân quyền PlatformRole ➔ API Quản lý Tenant ➔ Giao diện Dashboard `/admin/workspaces` cho phép khóa/mở shop và chỉnh quota.*

1. **Mục tiêu & Trải nghiệm Người dùng (User Journey & Value)**:
   - Super Admin đăng nhập và truy cập cổng quản trị `/admin/workspaces`, xem danh sách toàn bộ các doanh nghiệp (Tenant) trên nền tảng (Tên shop, Slug, Chủ sở hữu, Số thành viên, Số kênh kết nối, Trạng thái hoạt động, Ngày tạo).
   - Thao tác khóa/mở khóa shop (`SUSPENDED` / `ACTIVE`): Khi bấm khóa shop, toàn bộ thành viên của shop đó lập tức bị đăng xuất và bị chặn truy cập vào hệ thống.
   - Bấm nút "Chỉnh Quota" mở Modal/Dialog: Điều chỉnh hạn mức số lượng thành viên tối đa (seat count), số kênh chat kết nối, và hạn mức token AI hàng tháng. Lưu thay đổi áp dụng tức thì.

2. **Quy tắc nghiệp vụ & Bất biến (Business Rules & Invariants)**:
   - **Phân quyền cấp nền tảng (Platform Role)**:
     - Chỉ người dùng có `platformRole === 'SUPER_ADMIN'` mới được phép truy cập layout `/admin` và gọi các API `/api/v1/platform-admin/*`.
     - Tuyệt đối không cho phép bất kỳ User thông thường hoặc Workspace Admin nào vượt quyền (`403 Forbidden`).
   - **Nguyên tắc Bảo mật Siêu quản trị (Metadata-Only Architecture)**:
     - Super Admin chỉ được phép quản lý siêu dữ liệu doanh nghiệp (tên shop, số lượng nhân sự, gói cước, quota).
     - **Tuyệt đối KHÔNG hiển thị** nội dung tin nhắn riêng tư, hình ảnh chat hoặc danh sách số điện thoại khách hàng của các shop trên portal này (đảm bảo quyền riêng tư dữ liệu khách hàng theo quy định pháp lý).

3. **Ranh giới & Điều cấm (Constraints & Out-of-Scope)**:
   - **Tách biệt Route & Layout**: Portal `/admin` nằm trên route layout riêng biệt với không gian làm việc của shop thông thường `/[workspaceSlug]/*`.
   - ⛔ **Out-of-Scope (Không làm)**:
     - Không làm cổng thanh toán tự động gia hạn gói cước SaaS (Billing/Subscription payment gateway) — Việc thanh toán gói dịch vụ do sales/admin duyệt thủ công.

4. **Tài liệu tham chiếu (References)**:
   - PRD: [`docs/product/prd-super-admin.md#41-workspace-management--quotas`](file:///d:/workspace/Sales%20Copilot/docs/product/prd-super-admin.md)
   - RFC Kiến trúc: [`docs/architecture/rfc-super-admin.md#platform-roles--security`](file:///d:/workspace/Sales%20Copilot/docs/architecture/rfc-super-admin.md)

5. **Tiêu chí nghiệm thu (Acceptance Criteria & Definition of Done)**:
   - [ ] Người dùng không có quyền `SUPER_ADMIN` bị chặn 100% khi cố tình truy cập `/admin` hoặc gọi API platform-admin (`403 Forbidden`).
   - [ ] Bảng danh sách Workspaces hiển thị đúng và tìm kiếm nhanh theo tên/slug.
   - [ ] Khóa shop (`SUSPENDED`) thu hồi phiên đăng nhập và ngăn chặn ngay lập tức quyền truy cập của toàn bộ nhân viên shop đó.
   - [ ] Điều chỉnh Quota cập nhật thành công và các kiểm tra hạn mức tại shop áp dụng ngay lập tức.
   - [ ] Unit tests backend bao phủ: Guard chặn quyền, API khóa shop, API cập nhật quota.
   - [ ] Chạy `pnpm typecheck` và `pnpm nx run server:test` pass 100%.

---

### Feature 2.4.2: Động Cơ Cấu Hình Động, Feature Flags & Nhật Ký Kiểm Toán (End-to-End Dynamic Settings & Audit)
*Trọn gói từ CSDL Cấu hình ➔ Bộ đệm 2 tầng Redis ➔ Giao diện `/admin/settings` bật tắt tính năng toàn sàn và tra cứu Platform Audit.*

1. **Mục tiêu & Trải nghiệm Người dùng (User Journey & Value)**:
   - Super Admin truy cập `/admin/settings`:
     - Xem danh sách Feature Flags toàn sàn (ví dụ: `COMMERCE_POS_ENABLED`, `VIETQR_ENABLED`, `AI_AUTOPILOT_ENABLED`).
     - Gạt công tắc (Switch) bật/tắt tính năng: Hệ thống cập nhật cấu hình tức thì trong < 1s mà không cần khởi động lại server (Zero Downtime).
     - Xem bảng **Platform Audit Logs**: Tra cứu lịch sử ai đã bật/tắt cờ gì, ai đã khóa shop nào, đổi quota lúc mấy giờ kèm địa chỉ IP và giá trị thay đổi trước/sau (Diff JSON).

2. **Quy tắc nghiệp vụ & Bất biến (Business Rules & Invariants)**:
   - **Bộ đệm 2 tầng (2-Tier Cache Engine)**:
     - Đọc cấu hình ưu tiên từ Redis cache `system:settings:<key>` (TTL 300s, phản hồi < 5ms). Nếu cache miss mới truy vấn PostgreSQL.
     - Khi cập nhật cấu hình: Ghi DB + Invalidate cache Redis + Phát sự kiện nội bộ để các worker đồng bộ cấu hình mới.
   - **Sổ cái kiểm toán bất biến (Immutable Platform Audit)**:
     - Mọi hành vi thay đổi cấu hình, can thiệp quota hoặc khóa shop của Super Admin bắt buộc phải ghi 1 bản ghi vào `PlatformAuditLog`.
     - Không có bất kỳ API nào cho phép sửa hay xóa bản ghi trong `PlatformAuditLog`.

3. **Ranh giới & Điều cấm (Constraints & Out-of-Scope)**:
   - **Hiệu năng hệ thống**: Thao tác đọc cấu hình Feature Flag không được phép tạo điểm nghẽn (bottleneck) lên database chính.
   - ⛔ **Out-of-Scope (Không làm)**:
     - Không làm A/B testing phức tạp chia % traffic người dùng — Feature Flags ở cấp độ bật/tắt toàn hệ thống hoặc theo từng workspace.

4. **Tài liệu tham chiếu (References)**:
   - PRD: [`docs/product/prd-super-admin.md#42-dynamic-system-configuration--feature-flags`](file:///d:/workspace/Sales%20Copilot/docs/product/prd-super-admin.md)
   - RFC Kiến trúc: [`docs/architecture/rfc-super-admin.md#2-tier-configuration-cache`](file:///d:/workspace/Sales%20Copilot/docs/architecture/rfc-super-admin.md)

5. **Tiêu chí nghiệm thu (Acceptance Criteria & Definition of Done)**:
   - [ ] Migration Prisma thành công: Model `SystemSetting` và `PlatformAuditLog`.
   - [ ] Tốc độ đọc Feature Flag qua bộ nhớ đệm Redis đạt < 5ms.
   - [ ] Bật/tắt Feature Flag cập nhật tức thì trên toàn hệ thống mà không cần restart server.
   - [ ] Mọi hành vi can thiệp của Super Admin được ghi nhận đầy đủ vào `PlatformAuditLog` kèm IP và Diff.
   - [ ] Unit tests backend bao phủ: Đọc cache Redis, Invalidate cache khi update, ghi log audit.
   - [ ] Chạy `pnpm typecheck` và `pnpm nx run server:test` pass 100%.
