# Epic 2.1: Quản Lý Kho & Biến Thể SKU (Inventory & Catalog)

> **Mục tiêu**: Xây dựng trọn vẹn phân hệ quản lý sản phẩm, biến thể SKU và sổ cái biến động kho mini-inventory theo lát cắt dọc tính năng khép kín (Vertical Slices), đảm bảo công thức tồn kho 3 trạng thái: $\\text{Khả dụng} = \\text{Vật lý} - \\text{Tạm giữ}$.\
****Vị trí tài liệu**: `docs/backlog/epic-2.1-inventory-and-catalog.md`\
****Phụ thuộc**: Phase 1 Baseline (`workspaces`, `auth`)\
****Độ phức tạp**: 🔴 High | **Trạng thái**: ⏳ Sẵn sàng thực thi

---

## Danh Sách Lát Cắt Tính Năng Dọc (Vertical Features)

### Feature 2.1.1: Quản Lý Danh Mục & Biến Thể SKU (End-to-End Catalog & Variants)

*Trọn gói từ CSDL ➔ Backend API ➔ Giao diện Quản trị* `/products` *cho phép tạo và quản lý sản phẩm kèm ma trận biến thể.*

1. **Mục tiêu & Trải nghiệm Người dùng (User Journey & Value)**:

   - Chủ shop/Nhân viên truy cập `/products`, xem danh sách sản phẩm hiển thị ảnh đại diện, tên, danh mục (category tag), số lượng biến thể SKU và tổng tồn kho khả dụng.
   - Bấm nút "Thêm sản phẩm" mở Modal/Dialog tạo sản phẩm mới:
     - Nhập thông tin chung: Tên sản phẩm, mô tả, danh mục, tải ảnh lên MinIO.
     - Tạo ma trận biến thể nhanh theo thuộc tính (ví dụ: Thuộc tính 1 là Size \[S, M, L\], Thuộc tính 2 là Màu \[Đen, Trắng\] ➔ Tự sinh bảng 6 biến thể SKU).
     - Cho phép nhập giá bán, giá vốn (cost price) và số lượng tồn kho ban đầu cho từng SKU.
   - Hỗ trợ sửa nhanh sản phẩm/biến thể, xóa mềm (soft-delete), và tìm kiếm tức thì theo Tên hoặc SKU với debounce 300ms.

2. **Quy tắc nghiệp vụ & Bất biến (Business Rules & Invariants)**:

   - **Mã SKU**: Bắt buộc duy nhất (`Unique`) trong cùng một `workspaceId`. Tự động chuẩn hóa viết hoa (`UPPERCASE`), không dấu và không chứa khoảng trắng.
   - **Ràng buộc giá trị**: Giá bán $\\ge 0$, Giá vốn $\\ge 0$. Tồn kho ban đầu $\\ge 0$.
   - **Toàn vẹn dữ liệu**: Tạo Sản phẩm và toàn bộ Biến thể phải nằm trong cùng 1 Prisma `$transaction` (Atomic: tất cả thành công hoặc rollback toàn bộ).
   - **Bảo vệ toàn vẹn đơn hàng**: Không cho phép xóa cứng (hard-delete) sản phẩm hoặc biến thể nếu đã phát sinh đơn hàng trong hệ thống (chỉ cho phép chuyển trạng thái `ARCHIVED`/ẩn).

3. **Ranh giới & Điều cấm (Constraints & Out-of-Scope)**:

   - **Multi-tenancy**: Mọi câu truy vấn, tìm kiếm, cập nhật hoặc xóa bắt buộc phải kẹp điều kiện `where: { workspaceId }`.
   - ⛔ **Out-of-Scope (Không làm)**:
     - Không xây dựng cây danh mục đa cấp phân cấp cha-con (chỉ dùng tag/category phẳng).
     - Không làm in ấn tem nhãn mã vạch (barcode label printing).
     - Không làm đồng bộ tồn kho với các sàn TMĐT bên thứ ba (Shopee/TikTok Shop).

4. **Tài liệu tham chiếu (References)**:

   - PRD: \[`docs/product/prd-commerce-and-orders.md#31-catalog--variants`\](file:///d:/workspace/Sales%20Copilot/docs/product/prd-commerce-and-orders.md)
   - RFC Kiến trúc: \[`docs/architecture/rfc-commerce-and-orders.md#data-models`\](file:///d:/workspace/Sales%20Copilot/docs/architecture/rfc-commerce-and-orders.md)
   - Nguyên tắc thiết kế: \[`AGENTS.md`\](file:///d:/workspace/Sales%20Copilot/AGENTS.md) (Anti-Over-Engineering, Shadcn UI primitives)

5. **Tiêu chí nghiệm thu (Acceptance Criteria & Definition of Done)**:

   - [ ] Migration Prisma thành công: Model `Product` và `ProductVariant` kèm khóa ngoại liên kết `workspaceId`.

   - [ ] Tạo sản phẩm kèm 3-6 biến thể thành công từ giao diện `/products` và render dữ liệu ngay lập tức trên bảng mà không cần tải lại trang.

   - [ ] Báo lỗi `409 Conflict` thân thiện và rõ ràng khi nhập trùng mã SKU đã tồn tại trong workspace.

   - [ ] Tìm kiếm theo Tên hoặc SKU phản hồi dưới 50ms trên giao diện.

   - [ ] Unit tests backend bao phủ: Tạo thành công trong transaction, chặn trùng SKU, chặn giá âm.

   - [ ] Chạy `pnpm typecheck` và `pnpm nx run server:test` pass 100%.

---

### Feature 2.1.2: Nhập Kho, Kiểm Kê Cân Bằng Tồn & Sổ Cái Biến Động (End-to-End Stock Adjustment & Ledger)

*Trọn gói từ CSDL ➔ Backend API ➔ Giao diện Modal Nhập/Kiểm kho và tra cứu lịch sử giao dịch kho.*

1. **Mục tiêu & Trải nghiệm Người dùng (User Journey & Value)**:

   - Tại trang danh sách sản phẩm hoặc chi tiết sản phẩm, nhân viên kho bấm nút "Điều chỉnh kho" bên cạnh từng biến thể SKU.
   - Modal điều chỉnh kho mở ra, hiển thị rõ ràng: Tồn kho vật lý hiện tại, Tồn tạm giữ, và Tồn khả dụng.
   - Nhân viên chọn loại điều chỉnh:
     - **Nhập hàng (**`STOCK_IN`**)**: Nhập thêm số lượng hàng mới về.
     - **Kiểm kê cân bằng (**`ADJUSTMENT`**)**: Nhập số lượng thực tế đếm được trong kho, hệ thống tự tính số chênh lệch tăng/giảm.
   - Nhập lý do bắt buộc (ví dụ: *"Hàng về đợt 2"*, *"Kiểm kho cuối tuần hao hụt"*) ➔ Bấm xác nhận ➔ Tồn kho cập nhật tức thì.
   - Bấm xem "Lịch sử kho" mở hiển thị dòng thời gian sổ cái bất biến: Thời gian, Nhân viên thực hiện, Loại giao dịch, Số lượng trước/sau, Lý do.

2. **Quy tắc nghiệp vụ & Bất biến (Business Rules & Invariants)**:

   - **Công thức Tồn kho 3 trạng thái**: $$\\text{Tồn khả dụng (Available)} = \\text{Tồn vật lý (Physical)} - \\text{Tồn tạm giữ (Reserved)}$$
   - **Chặn âm kho vật lý**: Tuyệt đối không cho phép bất kỳ hành vi điều chỉnh nào dẫn tới `physicalStock < 0`. Nếu số lượng sau điều chỉnh &lt; 0, hệ thống phải từ chối ngay với lỗi `400 Bad Request`.
   - **Sổ cái bất biến (Immutable Audit Ledger)**: Mọi biến động số lượng tồn kho bắt buộc phải ghi lại một bản ghi vào bảng sổ cái `InventoryTransaction` trong cùng `$transaction` với thao tác cập nhật số lượng tồn. Không ai được quyền sửa hay xóa bản ghi lịch sử này.

3. **Ranh giới & Điều cấm (Constraints & Out-of-Scope)**:

   - **Multi-tenancy & Audit**: Ghi nhận chính xác `workspaceId` và `createdById` (ID nhân viên thực hiện thao tác).
   - ⛔ **Out-of-Scope (Không làm)**:
     - Không làm quản lý đa kho hàng (Multi-warehouse) — Mỗi workspace quản lý 1 kho mặc định duy nhất.
     - Không làm quy trình phiếu nhập kho đa bước chờ duyệt (Phê duyệt 2 cấp) — Điều chỉnh áp dụng ngay lập tức.
     - Không tính giá vốn bình quân gia quyền tự động phức tạp (FIFO/MAC).

4. **Tài liệu tham chiếu (References)**:

   - PRD: \[`docs/product/prd-commerce-and-orders.md#32-mini-inventory--stock-ledger`\](file:///d:/workspace/Sales%20Copilot/docs/product/prd-commerce-and-orders.md)
   - RFC Kiến trúc: \[`docs/architecture/rfc-commerce-and-orders.md#inventory-formula`\](file:///d:/workspace/Sales%20Copilot/docs/architecture/rfc-commerce-and-orders.md)

5. **Tiêu chí nghiệm thu (Acceptance Criteria & Definition of Done)**:

   - [ ] Migration Prisma thành công: Model `InventoryTransaction` ghi nhận biến động kho.

   - [ ] Nhập kho hoặc kiểm kê trên giao diện cập nhật ngay lập tức tồn kho vật lý và khả dụng.

   - [ ] Hệ thống chặn đứng thao tác nếu điều chỉnh làm tồn vật lý âm (`400 Bad Request`).

   - [ ] Mở lịch sử xem được đầy đủ nhật ký biến động kho minh bạch (ai làm, lý do, số lượng trước/sau).

   - [ ] Unit tests backend bao phủ: Nhập kho tăng tồn, kiểm kê giảm tồn, chặn âm kho, ghi log sổ cái.

   - [ ] Chạy `pnpm typecheck` và `pnpm nx run server:test` pass 100%.