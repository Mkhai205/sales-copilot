# Epic 2.5: AI NER Bóc Tách Địa Chỉ 3 Cấp (AI Address Extraction)

> **Mục tiêu**: Tự động nhận diện Tên, Số điện thoại và chuẩn hóa Địa chỉ giao hàng 3 cấp (Tỉnh/Thành phố - Quận/Huyện - Phường/Xã) theo chuẩn hành chính Quốc gia từ tin nhắn văn bản không cấu trúc của khách hàng, cho phép nhân viên điền đơn trong 1 cú click theo mô hình lát cắt dọc khép kín (Vertical Slices).\
> **Vị trí tài liệu**: `docs/backlog/epic-2.5-ai-address-ner.md`\
> **Phụ thuộc**: `Epic 2.2` (Khung lên đơn), `contacts`\
> **Độ phức tạp**: 🟡 Medium | **Trạng thái**: ⏳ Chờ Milestone 2A

---

## Danh Sách Lát Cắt Tính Năng Dọc (Vertical Features)

### Feature 2.5.1: Động Cơ Bóc Tách SĐT & Chuẩn Hóa Địa Chỉ 3 Cấp (End-to-End Address Extraction Engine)
*Trọn gói từ CSDL Hành chính Quốc gia ➔ Cấu trúc Trie tra cứu siêu tốc & Regex SĐT ➔ API Trích xuất Hybrid (kết hợp LLM Fallback).*

1. **Mục tiêu & Trải nghiệm Người dùng (User Journey & Value)**:
   - Hệ thống cung cấp API `POST /api/v1/conversations/:id/extract-shipping-info`: Tiếp nhận chuỗi tin nhắn không cấu trúc từ khách hàng (ví dụ: *"gửi cho a Minh sđt 0988 123 456 ở số 15 ngõ 45 phố vọng, đồng tâm, hbt, hn"*).
   - Tự động nhận diện và chuẩn hóa có cấu trúc:
     - Tên người nhận: "a Minh" ➔ "Minh".
     - Số điện thoại: `0988 123 456` ➔ `0988123456`.
     - Tỉnh/Thành phố: `hn` ➔ `Thành phố Hà Nội`.
     - Quận/Huyện: `hbt` ➔ `Quận Hai Bà Trưng`.
     - Phường/Xã: `đồng tâm` ➔ `Phường Đồng Tâm`.
     - Địa chỉ chi tiết (số nhà/ngõ/phố): `số 15 ngõ 45 phố vọng`.
   - Tốc độ xử lý siêu tốc: < 5ms cho các tin nhắn thông dụng (nhờ thuật toán Trie in-memory) và < 500ms khi cần gọi Gemini Fallback.

2. **Quy tắc nghiệp vụ & Bất biến (Business Rules & Invariants)**:
   - **CSDL Hành chính 3 cấp Quốc gia (GSO)**:
     - Danh mục chuẩn 63 Tỉnh/Thành phố, 705 Quận/Huyện, 10.614 Phường/Xã được lưu trữ và tối ưu hóa bằng cấu trúc dữ liệu Trie/Inverted Index trong bộ nhớ RAM khi server khởi động.
     - Hỗ trợ khử dấu tiếng Việt và ánh xạ các từ viết tắt phổ biến ("HN", "TPHCM", "SG", "Q1", "HBT", "CG").
   - **Quy chuẩn Số điện thoại Việt Nam**:
     - Nhận diện các đầu số di động 10 số hợp lệ: `03x`, `05x`, `07x`, `08x`, `09x`. Tự động loại bỏ dấu cách, dấu chấm, dấu gạch nối và mã quốc gia `+84`.
   - **Chiến lược lai 2 tầng (Hybrid Architecture: Rule-first + LLM Fallback)**:
     - Tầng 1: Chạy Regex SĐT + Trie Matching địa chỉ (tốn 0 token LLM, phản hồi < 5ms).
     - Tầng 2: Nếu không khớp được tối thiểu Tỉnh/Thành hoặc độ tin cậy < 80%, chuyển tiếp văn bản sang Gemini 2.5 Flash Structured Output để trích xuất ngữ cảnh phức tạp.

3. **Ranh giới & Điều cấm (Constraints & Out-of-Scope)**:
   - **Bảo mật & Quyền riêng tư**: Tuyệt đối không gửi tin nhắn của khách ra các dịch vụ LLM công cộng nếu không có thỏa thuận bảo mật doanh nghiệp.
   - ⛔ **Out-of-Scope (Không làm)**:
     - Không làm nhận diện phân tích nhà mạng viễn thông (Viettel, Vina, Mobi).
     - Không tính toán khoảng cách tọa độ GPS hoặc tích hợp bản đồ Google Maps/Mapbox trong Phase 2 này.

4. **Tài liệu tham chiếu (References)**:
   - PRD: [`docs/product/prd-commerce-and-orders.md#36-ai-address-ner--1-click-order`](file:///d:/workspace/Sales%20Copilot/docs/product/prd-commerce-and-orders.md)
   - RFC Kiến trúc: [`docs/architecture/rfc-commerce-and-orders.md#address-ner-pipeline`](file:///d:/workspace/Sales%20Copilot/docs/architecture/rfc-commerce-and-orders.md)

5. **Tiêu chí nghiệm thu (Acceptance Criteria & Definition of Done)**:
   - [ ] Bóc tách và chuẩn hóa chính xác địa chỉ viết tắt không dấu thông dụng dưới 5ms.
   - [ ] Chuẩn hóa đúng 100% các định dạng SĐT 10 số di động Việt Nam.
   - [ ] LLM Fallback bóc tách chính xác tên và địa chỉ chi tiết cho các câu chat lộn xộn, nhiều tiếng lóng.
   - [ ] Unit tests backend bao phủ: Trie matching, Regex SĐT, fallback LLM logic.
   - [ ] Chạy `pnpm typecheck` và `pnpm nx run server:test` pass 100%.

---

### Feature 2.5.2: Thẻ Gợi Ý & Nút 1-Click Điền Đơn Vào Khung Chat (End-to-End 1-Click Autofill)
*Trọn gói từ Lắng nghe tin nhắn Chat ➔ Hiển thị Thẻ gợi ý thông minh ➔ Tự động mở và điền toàn bộ Form.*

1. **Mục tiêu & Trải nghiệm Người dùng (User Journey & Value)**:
   - Trong quá trình chat với khách hàng tại `/conversations`, ngay khi khách gửi tin nhắn chứa thông tin nhận hàng, hệ thống tự động hiển thị một thẻ gợi ý tinh tế (Card) ngay phía trên khung soạn thảo tin nhắn: *"Phát hiện địa chỉ: [Tên] - [SĐT] - [Phường, Quận, Tỉnh]"*.
   - Nhân viên bấm nút **"Tạo Đơn Nhanh"** (hoặc bấm phím `Tab`): Hệ thống tự động mở, tự động điền sẵn Tên, SĐT, chọn đúng combobox Tỉnh ➔ Huyện ➔ Xã và Số nhà.
   - Giảm thời gian thao tác gõ tay của nhân viên từ 90s xuống chỉ còn 5s!

2. **Quy tắc nghiệp vụ & Bất biến (Business Rules & Invariants)**:
   - **Tương thích Form State**: Dữ liệu bóc tách được ánh xạ 1-1 vào các trường của form lên đơn nhanh.
   - **Trải nghiệm không xâm lấn (Non-intrusive UX)**: Thẻ gợi ý có nút "Bỏ qua" hoặc tự động ẩn sau khi nhân viên đã tạo đơn, không che khuất dòng chat hay khung nhập tin nhắn.

3. **Ranh giới & Điều cấm (Constraints & Out-of-Scope)**:
   - **Phía Client**: Lắng nghe sự kiện socket tin nhắn mới, chỉ gọi API trích xuất khi tin nhắn thỏa mãn điều kiện nghi vấn có thông tin liên hệ (có số điện thoại hoặc từ khóa địa chỉ) để tránh lãng phí request.
   - ⛔ **Out-of-Scope (Không làm)**:
     - Không tự động chốt đơn mà không có sự xác nhận của nhân viên (nhân viên luôn là người kiểm tra cuối cùng trước khi bấm "Chốt Đơn").

4. **Tài liệu tham chiếu (References)**:
   - PRD: [`docs/product/prd-commerce-and-orders.md#36-ai-address-ner--1-click-order`](file:///d:/workspace/Sales%20Copilot/docs/product/prd-commerce-and-orders.md)
   - Thiết kế UX: [`docs/backlog/epic-2.2-in-chat-pos-and-orders.md#feature-221`](file:///d:/workspace/Sales%20Copilot/docs/backlog/epic-2.2-in-chat-pos-and-orders.md)

5. **Tiêu chí nghiệm thu (Acceptance Criteria & Definition of Done)**:
   - [ ] Thẻ gợi ý xuất hiện tự nhiên, thanh thoát phía trên khung chat khi có thông tin giao hàng.
   - [ ] 1-Click tự động mở và điền chính xác 100% các trường Tên, SĐT, Tỉnh, Huyện, Xã, Địa chỉ cụ thể.
   - [ ] Thao tác phím tắt `Tab` kích hoạt điền đơn mượt mà.
   - [ ] Chạy `pnpm typecheck` và `pnpm nx run web:test` pass 100%.
