# Phase 3C: Mở Rộng & Nâng Cao (Expansion)

> **Phân kỳ:** Phase 3C (Sau khi Phase 3B hoàn tất)
> **Mục tiêu:** Thiết kế lại module vận chuyển và mở rộng kênh chat
> **Ước lượng:** Tuần 6 – Tuần 9
> **Phụ thuộc:** Phase 3B hoàn tất

Tài liệu này định nghĩa các công việc mở rộng cho Sales Copilot. Bắt buộc phải tạo `implementation_plan.md` cho từng Task trước khi tiến hành code.

---

## TASK-3C-01: Thiết kế lại module Vận chuyển từ đầu (Shipping Module Redesign)

### 1. Mục tiêu & Trải nghiệm Người dùng (User Journey & Value)
*   **Mục tiêu:** Xây dựng lại hoàn toàn module vận chuyển (Shipping) từ đầu sau khi mã nguồn cũ đã bị xóa ở Phase 3A. Đảm bảo tích hợp mượt mà với các đơn vị vận chuyển phổ biến tại Việt Nam (GHN, GHTK, ViettelPost) theo mô hình chuẩn, dễ mở rộng.
*   **Trải nghiệm người dùng:** Người dùng (chủ shop) có thể dễ dàng so sánh phí vận chuyển, tạo đơn giao hàng trực tiếp từ hệ thống, và theo dõi trạng thái đơn hàng. AI Copilot có khả năng tự động tính toán phí vận chuyển và khởi tạo lệnh giao hàng khi có yêu cầu.

### 2. Quy tắc nghiệp vụ & Bất biến (Business Rules & Invariants)
*   **Nghiên cứu trước khi triển khai (Research required):** 
    *   Tài liệu API GHN v2 (Xác thực, Báo giá, Tạo đơn, Tracking, Hủy đơn).
    *   Tài liệu API GHTK.
    *   Luồng nghiệp vụ vận chuyển chung cho e-commerce Việt Nam.
*   **Thiết kế cốt lõi (Key design decisions):**
    *   **Mô hình dữ liệu:** Lựa chọn giữa bảng `ShippingAddress` riêng biệt hay nhúng trực tiếp (inline) vào `Order`.
    *   **Mô hình Adapter:** Áp dụng Strategy pattern (`CarrierAdapter`) để xử lý nhiều đơn vị vận chuyển khác nhau một cách linh hoạt.
    *   **State Machine:** Cập nhật Order state machine (Khi nào đơn hàng chuyển sang trạng thái `SHIPPING`?).
    *   **COD (Cash on Delivery):** Xử lý luồng thu hộ, phí thu hộ và cấn trừ.
    *   **Tracking:** Tích hợp theo dõi đơn hàng (Webhook từ Carrier thay vì polling để giảm tải).
    *   **AI Copilot Tools:** Bổ sung lại các công cụ AI `calculate_shipping` và `dispatch_order` theo kiến trúc mới.
*   **Bất biến:** Strict Multi-Tenancy (Bắt buộc kiểm tra `workspaceId` trong mọi thao tác). Trả về Prisma model trực tiếp từ service, validation bằng Zod schema làm DTO.

### 3. Ranh giới & Điều cấm (Constraints & Out-of-Scope)
*   **Ranh giới:** Thiết kế từ đầu (from-scratch redesign). KHÔNG sử dụng lại code cũ đã bị gỡ bỏ ở Phase 3A.
*   **Điều cấm:** **KHÔNG** làm định tuyến đa kho (Multi-warehouse routing) - đã chốt bỏ qua để giữ hệ thống đơn giản theo nguyên tắc YAGNI/KISS.
*   **Ràng buộc:** Bắt buộc tuân thủ chặt chẽ `AGENTS.md`. **Phải có** bản thiết kế `implementation_plan.md` cho phần này trước khi viết code.

### 4. Tài liệu tham chiếu (References)
*   [GHN API v2 Documentation](https://api.ghn.vn)
*   [GHTK API Documentation](https://docs.giaohangtietkiem.vn)
*   Quy định chung của dự án: `AGENTS.md`

### 5. Tiêu chí nghiệm thu (Acceptance Criteria & Definition of Done)
- [ ] Hoàn thành tài liệu `implementation_plan.md` cho Shipping Module và được phê duyệt.
- [ ] Triển khai thành công `CarrierAdapter` cho ít nhất 1 đơn vị vận chuyển (GHN hoặc GHTK).
- [ ] Luồng tạo đơn hàng, tính phí và cập nhật trạng thái hoạt động chính xác.
- [ ] Các công cụ AI Copilot (`calculate_shipping`, `dispatch_order`) hoạt động ổn định.
- [ ] Tất cả các truy vấn đều kiểm tra `workspaceId`.
- [ ] Các unit test / integration test quan trọng được tự động hóa.

---

## TASK-3C-02: Tích hợp kênh Zalo Official Account (Zalo OA Integration)

### 1. Mục tiêu & Trải nghiệm Người dùng (User Journey & Value)
*   **Mục tiêu:** Mở rộng khả năng tiếp cận khách hàng tại thị trường Việt Nam bằng cách tích hợp Zalo Official Account (Zalo OA) như một kênh giao tiếp chính thức yếu hầu.
*   **Trải nghiệm người dùng:** Người dùng có thể nhận, trả lời tin nhắn từ khách hàng qua Zalo ngay trên giao diện thống nhất của Sales Copilot. AI Copilot có thể đọc hiểu ngữ cảnh và phản hồi khách hàng tự động trên Zalo OA một cách trơn tru, tương tự như các kênh Facebook/Telegram.

### 2. Quy tắc nghiệp vụ & Bất biến (Business Rules & Invariants)
*   **Mô hình thiết kế:** Tuân thủ mô hình Adapter pattern đã dùng cho Facebook và Telegram.
*   **Các thành phần chính (Key components):**
    *   `ZaloOaController`: Chịu trách nhiệm webhook verification và tiếp nhận tin nhắn (message ingress).
    *   `ZaloOaService`: Xử lý logic gửi tin nhắn, quản lý token.
    *   `ZaloOaAdapter`: Implement interface chung cho channel adapter.
    *   **Quản lý Token:** Vòng đời Refresh OAuth token phải được xử lý tự động.
    *   **Tin nhắn tương tác:** Hỗ trợ interactive message templates (nút bấm, quick replies).
    *   **Đồng bộ dữ liệu:** Tự động đồng bộ thông tin (Customer profile sync) vào mô hình `Contact`.
*   **Giao diện:** Thêm tùy chọn Zalo OA vào màn hình Cài đặt (`Settings > Inboxes > New`). Sử dụng Shadcn UI primitives.
*   **Bất biến:** AI Copilot phải hoạt động xuyên suốt, không phân biệt channel. `workspaceId` phải được kiểm soát tuyệt đối trên mọi API nội bộ.

### 3. Ranh giới & Điều cấm (Constraints & Out-of-Scope)
*   **Điều cấm:** **KHÔNG** tích hợp Zalo Mini App. **KHÔNG** tích hợp Zalo Shop. (Ngoài phạm vi dự án hiện tại).
*   **Ràng buộc:** Cần nghiên cứu Zalo OA OpenAPI v3. **Phải có** tài liệu `implementation_plan.md` phân tích kỹ luồng OAuth và Webhook trước khi code.

### 4. Tài liệu tham chiếu (References)
*   [Zalo OA OpenAPI v3](https://developers.zalo.me/docs/api/official-account-api/xac-thuc-va-uy-quyen-oa)
*   Kiến trúc Channel Adapter hiện tại (Xem code Facebook/Telegram Adapter).
*   Quy định chung của dự án: `AGENTS.md`

### 5. Tiêu chí nghiệm thu (Acceptance Criteria & Definition of Done)
- [ ] Hoàn thành tài liệu `implementation_plan.md` cho Zalo OA Integration và được phê duyệt.
- [ ] Luồng xác thực OAuth2 với Zalo OA hoạt động trơn tru (Lưu trữ token, tự động refresh).
- [ ] Nhận tin nhắn từ Zalo (Webhook) và hiển thị trên giao diện Inbox thành công.
- [ ] Gửi tin nhắn text và template tới Zalo OA hoạt động.
- [ ] Đồng bộ `Contact` thành công dựa trên user profile của Zalo.
- [ ] AI Copilot có thể trả lời khách hàng trực tiếp qua luồng Zalo OA.

---
## Kiểm tra & Xác nhận (Verification)
*   Đã rà soát tuân thủ YAGNI, KISS theo `AGENTS.md`.
*   Tất cả các Task đều nhắc nhở rõ ràng việc cần tạo bản thiết kế trước khi thực thi mã nguồn.
