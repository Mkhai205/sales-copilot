# Epic 2.2: Khung Lên Đơn & Quản Trị Đơn Hàng OMS (In-Chat Commerce & Orders)

> **Mục tiêu**: Xây dựng trải nghiệm lên đơn siêu tốc ngay trong khung chat, thuật toán khóa kho nguyên tử 2 tầng trong `$transaction`, khóa chống va chạm nhân viên Redis 30s và trang quản trị đơn hàng OMS `/orders` theo mô hình lát cắt dọc khép kín (Vertical Slices).\
> **Vị trí tài liệu**: `docs/backlog/epic-2.2-commerce-and-orders.md`\
> **Phụ thuộc**: `Epic 2.1` (Kho & SKU Biến thể), `conversations`, `contacts`\
> **Độ phức tạp**: 🔴 High | **Trạng thái**: ⏳ Sẵn sàng thực thi

---

## Danh Sách Lát Cắt Tính Năng Dọc (Vertical Features)

### Feature 2.2.1: Khung Lên Đơn Nhanh Trong Chat & Khóa Tồn Kho Nguyên Tử (End-to-End In-Chat Quick Order)
*Trọn gói từ CSDL Đơn hàng ➔ Thuật toán Khóa kho nguyên tử ➔ Giao diện trong Chat cho phép chốt đơn và gửi tóm tắt vào hội thoại.*

1. **Mục tiêu & Trải nghiệm Người dùng (User Journey & Value)**:
   - Khi đang chat với khách hàng tại màn hình `/conversations`, nhân viên ➔ Mở lên đơn bên phải màn hình.
   - Hệ thống tự động kích hoạt **Redis Sliding Lock 30s**: Nếu Agent khác cùng mở đơn cho hội thoại này, màn hình Agent kia sẽ cảnh báo đỏ: *"Hội thoại đang được phục vụ bởi Agent X"* kèm nút Takeover (Cướp quyền).
   - tự động điền Tên và SĐT từ `Contact` hiện tại.
   - Nhân viên gõ tìm kiếm SKU (giao diện `cmdk` lọc < 20ms), chọn sản phẩm, biến thể, số lượng và phương thức thanh toán (`VIETQR`, `COD`).
   - Bấm "Chốt Đơn" ➔ Hệ thống kiểm tra và khóa tạm kho trong Prisma `$transaction`, tạo đơn hàng ở trạng thái `CONFIRMED`, và tự động bắn thẻ tóm tắt đơn hàng vào dòng thời gian chat của khách.

2. **Quy tắc nghiệp vụ & Bất biến (Business Rules & Invariants)**:
   - **Order State Machine**:
     $$\text{DRAFT} \longrightarrow \text{CONFIRMED} \longrightarrow \text{PAID} \longrightarrow \text{SHIPPING} \longrightarrow \text{COMPLETED}$$
     $$\text{Hoặc hủy đơn:} \longrightarrow \text{CANCELLED}$$
   - **Khóa tồn kho nguyên tử 2 tầng**:
     - Khi đơn ở trạng thái `CONFIRMED`: Chỉ tăng `reservedStock += quantity`, KHÔNG trừ `physicalStock`.
     - Điều kiện bắt buộc trước khi tạo đơn: $\text{physicalStock} - \text{reservedStock} \ge \text{quantity}$.
     - Chống Deadlock PostgreSQL (`40P01`): Danh sách `variantId` trong đơn bắt buộc phải được sắp xếp tăng dần (`sort((a, b) => a.localeCompare(b))`) trước khi chạy câu lệnh khóa bản ghi trong `$transaction`.
   - **Chống va chạm đa nhân viên (Multi-agent Collision)**: Sử dụng Redis key `lock:order:conv_{conversationId}` với TTL 30s, tự động gia hạn (heartbeat) khi nhân viên đang thao tác form.

3. **Ranh giới & Điều cấm (Constraints & Out-of-Scope)**:
   - **Multi-tenancy**: Mọi thao tác tạo và đọc đơn hàng bắt buộc gắn liền với `workspaceId`.
   - ⛔ **Out-of-Scope (Không làm)**:
     - Không tích hợp đẩy vận đơn sang các hãng vận chuyển thứ ba (GHTK, GHN, ViettelPost) trong Phase 2 này.
     - Không làm in hóa đơn nhiệt qua máy in Commerce K58/K80.
     - Không hỗ trợ gộp/tách đơn hàng nhiều người mua.

4. **Tài liệu tham chiếu (References)**:
   - PRD: [`docs/product/prd-commerce-and-orders.md`](file:///d:/workspace/Sales%20Copilot/docs/product/prd-commerce-and-orders.md)
   - RFC Kiến trúc: [`docs/architecture/rfc-commerce-and-orders.md`](file:///d:/workspace/Sales%20Copilot/docs/architecture/rfc-commerce-and-orders.md)

5. **Tiêu chí nghiệm thu (Acceptance Criteria & Definition of Done)**:
   - [ ] Migration Prisma thành công: Model `Order` và `OrderItem` với các Enums chuẩn.
   - [ ] Lên đơn thành công làm tăng `reservedStock` tương ứng của biến thể trong kho.
   - [ ] Chặn đứng bán âm kho khi 2 request đồng thời tranh chấp 1 mặt hàng chỉ còn tồn khả dụng = 1 (1 đơn thành công, 1 đơn báo lỗi hết hàng).
   - [ ] Redis lock cảnh báo va chạm khi 2 tab/nhân viên cùng mở form tạo đơn cho 1 khách hàng.
   - [ ] Thẻ tóm tắt đơn hàng xuất hiện ngay lập tức trong dòng chat của cuộc trò chuyện.
   - [ ] Unit tests backend bao phủ: Trừ tồn tạm, chống deadlock, tranh chấp đồng thời, Redis lock.
   - [ ] Chạy `pnpm typecheck` và `pnpm nx run server:test` pass 100%.

---

### Feature 2.2.2: Quản Trị Đơn Hàng Toàn Diện OMS & Hủy Đơn Hoàn Kho (End-to-End Orders OMS & Cancellation)
*Trọn gói từ Backend Query Filters ➔ State Machine Đơn hàng ➔ Giao diện Quản lý Đơn hàng `/orders` và chức năng Hủy đơn tự động hoàn kho.*

1. **Mục tiêu & Trải nghiệm Người dùng (User Journey & Value)**:
   - Chủ shop/Nhân viên truy cập `/orders`, xem danh sách toàn bộ đơn hàng phát sinh từ các kênh chat.
   - Lọc nhanh theo Tabs trạng thái (`Tất cả`, `Chờ thanh toán`, `Đã thanh toán`, `Đang giao`, `Hoàn tất`, `Đã hủy`), lọc theo khoảng ngày, tìm theo mã đơn `orderCode` hoặc Tên/SĐT khách hàng.
   - Bấm vào một dòng đơn mở Sheet chi tiết đơn: xem danh sách SKU, số lượng, đơn giá, địa chỉ giao hàng, phương thức thanh toán và nhật ký chuyển trạng thái.
   - Thao tác "Hủy đơn hàng": Nhân viên nhập lý do hủy ➔ Hệ thống cập nhật trạng thái đơn sang `CANCELLED`, **tự động giải phóng tồn kho tạm giữ** (`reservedStock -= quantity`), và ghi nhận biến động vào sổ cái `InventoryTransaction`.

2. **Quy tắc nghiệp vụ & Bất biến (Business Rules & Invariants)**:
   - **Quy tắc hoàn kho khi hủy đơn (Restock Invariant)**:
     - Nếu đơn đang ở trạng thái `CONFIRMED` (chưa thanh toán): Giảm `reservedStock -= quantity` (giải phóng tồn tạm).
     - Nếu đơn đang ở trạng thái `PAID` (đã trừ kho vật lý): Tăng lại cả `physicalStock += quantity` và ghi sổ cái `InventoryTransaction(ORDER_RESTOCK)`.
     - Tuyệt đối không cho phép hủy các đơn hàng đã ở trạng thái `COMPLETED`.
   - **Toàn vẹn chuyển trạng thái**: Mọi thao tác đổi trạng thái phải tuân thủ nghiêm ngặt State Machine, không được nhảy cóc bất hợp lệ (ví dụ: không thể chuyển từ `DRAFT` thẳng sang `COMPLETED`).

3. **Ranh giới & Điều cấm (Constraints & Out-of-Scope)**:
   - **Tenant Isolation**: Tuyệt đối không cho phép xem hoặc sửa đơn hàng thuộc `workspaceId` khác.
   - ⛔ **Out-of-Scope (Không làm)**:
     - Không làm quy trình trả hàng hoàn tiền phức tạp (RMA / Partial Refund) — Hủy đơn chỉ áp dụng cho toàn bộ đơn hàng.
     - Không làm chức năng chỉnh sửa danh sách sản phẩm sau khi đơn đã chốt (muốn sửa phải hủy đơn cũ và tạo đơn mới).

4. **Tài liệu tham chiếu (References)**:
   - PRD: [`docs/product/prd-commerce-and-orders.md#34-order-management-oms`](file:///d:/workspace/Sales%20Copilot/docs/product/prd-commerce-and-orders.md)
   - RFC Kiến trúc: [`docs/architecture/rfc-commerce-and-orders.md#order-state-machine`](file:///d:/workspace/Sales%20Copilot/docs/architecture/rfc-commerce-and-orders.md)

5. **Tiêu chí nghiệm thu (Acceptance Criteria & Definition of Done)**:
   - [ ] Bảng danh sách đơn hàng hiển thị đầy đủ, phân trang, tìm kiếm và lọc trạng thái mượt mà.
   - [ ] Hủy đơn ở trạng thái `CONFIRMED` giải phóng tồn tạm `reservedStock` ngay lập tức.
   - [ ] Hủy đơn ở trạng thái `PAID` hoàn trả tồn vật lý `physicalStock` và ghi log sổ cái kho.
   - [ ] Chặn đứng thao tác hủy đơn đối với đơn hàng đã hoàn tất (`COMPLETED`).
   - [ ] Unit tests backend bao phủ: Chuyển trạng thái hợp lệ, hoàn kho khi hủy đơn, chặn hủy đơn hoàn tất.
   - [ ] Chạy `pnpm typecheck` và `pnpm nx run server:test` pass 100%.
