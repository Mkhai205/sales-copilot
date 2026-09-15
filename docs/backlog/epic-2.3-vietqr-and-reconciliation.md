# Epic 2.3: Dynamic VietQR & Gạch Nợ Tự Động (VietQR & Bank Reconciliation)

> **Mục tiêu**: Tự động sinh mã thanh toán Dynamic VietQR chuẩn NAPAS 247 gắn liền với từng đơn hàng, tiếp nhận Webhook ngân hàng (SePay/Casso) để tự động gạch nợ chuyển trạng thái `PAID` trong `< 1s` và phát tán thông báo Realtime lên khung chat của nhân viên theo mô hình lát cắt dọc khép kín (Vertical Slices).\
> **Vị trí tài liệu**: `docs/backlog/epic-2.3-vietqr-and-reconciliation.md`\
> **Phụ thuộc**: `Epic 2.2` (Đơn hàng OMS), `realtime` Gateway\
> **Độ phức tạp**: 🔴 High | **Trạng thái**: ⏳ Sẵn sàng thực thi

---

## Danh Sách Lát Cắt Tính Năng Dọc (Vertical Features)

### Feature 2.3.1: Sinh Mã Dynamic VietQR Trong Khung Chat (End-to-End Dynamic VietQR)
*Trọn gói từ Thuật toán EMVCo NAPAS 247 ➔ API sinh mã QR theo đơn ➔ Giao diện Modal xem mã QR và nút Copy 1-chạm trong Chat.*

1. **Mục tiêu & Trải nghiệm Người dùng (User Journey & Value)**:
   - Khi một đơn hàng được tạo trong chat, thẻ đơn hàng hiển thị nút "Xem mã VietQR".
   - Nhân viên hoặc khách hàng bấm nút ➔ Mở Modal/Dialog hiển thị mã VietQR sắc nét, kèm thông tin rõ ràng: Ngân hàng thụ hưởng, Số tài khoản, Tên chủ tài khoản, Số tiền chính xác của đơn và Nội dung chuyển khoản chuẩn `DH{orderCode}` (ví dụ: `DH10283`).
   - Cung cấp các nút tiện ích 1-chạm: "Sao chép STK", "Sao chép số tiền", "Sao chép cú pháp", và "Gửi ảnh QR vào chat cho khách".

2. **Quy tắc nghiệp vụ & Bất biến (Business Rules & Invariants)**:
   - **Chuẩn EMVCo NAPAS 247**:
     - Sinh payload QR tĩnh/động theo đúng chuẩn thanh toán bán lẻ liên ngân hàng Việt Nam (Tag 00-63, CRC-16 CCITT 0xFFFF).
     - Gói cước: Sử dụng thư viện chuẩn nhẹ (ví dụ `vietnam-qr-pay` hoặc tương tự đã kiểm chứng) thay vì tự viết lại thuật toán CRC-16 thủ công dễ lỗi.
   - **Nội dung thanh toán duy nhất**: Memo/Cú pháp chuyển khoản bắt buộc theo format `DH{orderCode}` để hệ thống đối soát tự động chính xác 100%.

3. **Ranh giới & Điều cấm (Constraints & Out-of-Scope)**:
   - **Bảo mật cấu hình ngân hàng**: Cấu hình tài khoản ngân hàng thụ hưởng được lưu ở cấp `Workspace` và chỉ Quản trị viên/Chủ shop có quyền thay đổi.
   - ⛔ **Out-of-Scope (Không làm)**:
     - Không tích hợp cổng thanh toán quốc tế (Stripe, PayPal).
     - Không làm ví điện tử trực tiếp (Momo, ZaloPay merchant gateway) trong Phase 2 này — Tập trung duy nhất vào VietQR NAPAS 247.

4. **Tài liệu tham chiếu (References)**:
   - PRD: [`docs/product/prd-commerce-and-orders.md#35-dynamic-vietqr--instant-bank-reconciliation`](file:///d:/workspace/Sales%20Copilot/docs/product/prd-commerce-and-orders.md)
   - RFC Kiến trúc: [`docs/architecture/rfc-commerce-and-orders.md#vietqr-generation`](file:///d:/workspace/Sales%20Copilot/docs/architecture/rfc-commerce-and-orders.md)

5. **Tiêu chí nghiệm thu (Acceptance Criteria & Definition of Done)**:
   - [ ] Mã QR quét thành công trên các ứng dụng ngân hàng phổ biến (Vietcombank, MB, Techcombank) và tự động điền đúng STK, số tiền, cú pháp `DH...`.
   - [ ] Bấm xem mã QR mở modal nhanh dưới 100ms.
   - [ ] Nút sao chép (copy-to-clipboard) hoạt động chuẩn xác trên cả desktop và mobile.
   - [ ] Unit tests backend bao phủ: Sinh chuỗi payload EMVCo hợp lệ, kiểm tra CRC-16 checksum, định dạng memo chuẩn.
   - [ ] Chạy `pnpm typecheck` và `pnpm nx run server:test` pass 100%.

---

### Feature 2.3.2: Webhook Đối Soát Ngân Hàng & Gạch Nợ Realtime (End-to-End Instant Reconciliation & Realtime)
*Trọn gói từ Endpoint Inbound Webhook (SePay/Casso) ➔ Xử lý Đối soát Trừ kho Vật lý ➔ Bắn WebSocket đổi Badge "ĐÃ THANH TOÁN" xanh lá trên UI.*

1. **Mục tiêu & Trải nghiệm Người dùng (User Journey & Value)**:
   - Khách hàng quét mã QR trên App ngân hàng và bấm xác nhận chuyển tiền.
   - Cổng ngân hàng (SePay hoặc Casso) bắn Webhook thông báo biến động số dư về hệ thống:
     - Hệ thống tiếp nhận webhook, phản hồi HTTP 200 ngay trong < 100ms.
     - Tự động bóc tách mã đơn `DH...` từ nội dung chuyển khoản, so khớp số tiền và gạch nợ đơn hàng sang trạng thái `PAID`.
     - Chính thức trừ tồn kho vật lý (`physicalStock -= quantity`, `reservedStock -= quantity`), ghi nhận sổ cái `InventoryTransaction`.
   - **Tức thời (< 1s)**: Thẻ đơn hàng trên màn hình chat của nhân viên tự động đổi badge từ "Chờ thanh toán" sang **"ĐÃ THANH TOÁN"** xanh lá nổi bật kèm âm thanh thông báo và toast xác nhận mà không cần F5 tải lại trang.

2. **Quy tắc nghiệp vụ & Bất biến (Business Rules & Invariants)**:
   - **Kháng lặp tuyệt đối (Strict Idempotency)**:
     - Khóa giao dịch bằng `transactionId` từ ngân hàng (lưu vào bảng `PaymentTransaction`).
     - Nếu webhook gửi lại trùng `transactionId` đã xử lý, hệ thống trả về HTTP 200 ngay lập tức và KHÔNG thực hiện gạch nợ hay trừ kho lần 2.
   - **Kiểm tra số tiền (Amount Validation)**:
     - Số tiền chuyển khoản $\ge$ Tổng tiền đơn hàng (`amount >= order.totalAmount`).
     - Nếu chuyển thiếu tiền: Chuyển đơn sang trạng thái cảnh báo `PARTIALLY_PAID` (hoặc ghi log cảnh báo) và KHÔNG gạch nợ `PAID`.
   - **Nguyên tử trừ kho vật lý**: Thao tác chuyển sang `PAID`, trừ `physicalStock`, trừ `reservedStock`, và ghi `InventoryTransaction(ORDER_FULFILLMENT)` bắt buộc phải thực thi trong cùng 1 Prisma `$transaction`.

3. **Ranh giới & Điều cấm (Constraints & Out-of-Scope)**:
   - **Xác thực Webhook**: Bắt buộc kiểm tra chữ ký HMAC hoặc Secret Token trong header của SePay/Casso trước khi xử lý payload.
   - ⛔ **Out-of-Scope (Không làm)**:
     - Không tự động chuyển khoản hoàn tiền (Refund API) về tài khoản khách hàng — Hoàn tiền do chủ shop thực hiện thủ công ngoài ứng dụng ngân hàng.

4. **Tài liệu tham chiếu (References)**:
   - PRD: [`docs/product/prd-commerce-and-orders.md#35-dynamic-vietqr--instant-bank-reconciliation`](file:///d:/workspace/Sales%20Copilot/docs/product/prd-commerce-and-orders.md)
   - RFC Kiến trúc: [`docs/architecture/rfc-commerce-and-orders.md#bank-reconciliation-pipeline`](file:///d:/workspace/Sales%20Copilot/docs/architecture/rfc-commerce-and-orders.md)

5. **Tiêu chí nghiệm thu (Acceptance Criteria & Definition of Done)**:
   - [ ] Endpoint Webhook xác thực Secret/HMAC hợp lệ và phản hồi HTTP 200 trong < 100ms.
   - [ ] Xử lý kháng lặp thành công: Gửi lại cùng 1 transaction webhook không gây lỗi và không bị trừ kho 2 lần.
   - [ ] Đơn hàng tự động đổi sang trạng thái `PAID` và trừ cả tồn vật lý lẫn tồn tạm giữ chính xác.
   - [ ] Màn hình chat nhận sự kiện WebSocket và cập nhật badge đơn hàng sang "ĐÃ THANH TOÁN" xanh lá trong < 1s.
   - [ ] Unit tests backend bao phủ: Đối soát khớp tiền, xử lý trùng lặp transaction, xử lý thiếu tiền.
   - [ ] Chạy `pnpm typecheck` và `pnpm nx run server:test` pass 100%.
