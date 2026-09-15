# Epic 2.6: AI Auto-pilot 24/7 & Guarded Discount Policy Engine (AI Sales Assistant)

> **Mục tiêu**: Hiện thực hóa AI trợ lý bán hàng tự động với 4 chế độ cấu hình linh hoạt (`ALWAYS_ON`, `OFF_HOURS`, `OVERFLOW`, `MANUAL`), đàm phán giảm giá/freeship có kiểm soát theo hạn mức an toàn của chủ shop và tự động chốt đơn ban đêm (Midnight Checkout) theo mô hình lát cắt dọc khép kín (Vertical Slices).\
> **Vị trí tài liệu**: `docs/backlog/epic-2.6-ai-autopilot-discount.md`\
> **Phụ thuộc**: `Epic 2.1` (Kho & SKU), `Epic 2.2` (Đơn hàng), `Epic 2.3` (VietQR)\
> **Độ phức tạp**: 🔴 High | **Trạng thái**: ⏳ Chờ Milestone 2A

---

## Danh Sách Lát Cắt Tính Năng Dọc (Vertical Features)

### Feature 2.6.1: Chính Sách Giảm Giá An Toàn & Điều Phối 4 Chế Độ AI (End-to-End Policy & 4-Mode Dispatcher)
*Trọn gói từ Schema Chính sách Giảm giá ➔ Động cơ Điều phối 4 chế độ Inbound ➔ Giao diện Cài đặt Shop/Inbox.*

1. **Mục tiêu & Trải nghiệm Người dùng (User Journey & Value)**:
   - Chủ shop/Quản lý truy cập Cài đặt Hộp thư (Inbox Settings), chọn tab "Chính sách AI Bán hàng":
     - Cấu hình 1 trong 4 chế độ hoạt động của AI:
       1. `ALWAYS_ON`: AI tự động phản hồi và tư vấn 24/7.
       2. `OFF_HOURS`: Ban ngày nhân viên trực (0 tốn token AI); ngoài khung giờ làm việc hoặc khi toàn bộ nhân viên Offline thì AI tự động tiếp quản.
       3. `OVERFLOW`: Khi khách hàng nhắn tin mà sau $N$ phút không có nhân viên nào nhận chat ➔ AI tự động nhảy vào ứng cứu.
       4. `MANUAL`: Tắt hoàn toàn tính năng AI trả lời tự động.
     - Thiết lập hạn mức chiết khấu an toàn (`Discount Policy`): % giảm giá tối đa (ví dụ: không quá 10%), số tiền giảm tối đa (ví dụ: không quá 50.000đ), và ngưỡng áp dụng Freeship (ví dụ: đơn hàng trên 300.000đ).
   - Hệ thống tự động phân luồng tin nhắn: Inbound webhook trả HTTP 200 trong < 100ms, sau đó điều hướng tác vụ vào hàng đợi AI hoặc hàng đợi phân công nhân viên tùy theo trạng thái ca trực.

2. **Quy tắc nghiệp vụ & Bất biến (Business Rules & Invariants)**:
   - **Guarded Discount Policy Engine**:
     - Bất kỳ đơn hàng nào do AI tạo ra đều phải trải qua bước thẩm định chính sách (Policy Evaluation).
     - Chiết khấu của đơn: $\text{discountAmount} \le \min(\text{orderTotal} \times \text{maxPercent}, \text{maxAmount})$.
     - Bất kỳ nỗ lực nào đề xuất vượt trần đều bị hệ thống chặn đứng với mã lỗi `422 Unprocessable Entity` và buộc AI phải quay lại giá niêm yết chuẩn.
   - **Nhận diện Ca trực Realtime**:
     - Kiểm tra khung giờ làm việc kết hợp Redis Presence Set `presence:workspace_{workspaceId}`. Nếu có ít nhất 1 Agent ở trạng thái `ONLINE` trong ca trực ➔ Hệ thống ưu tiên nhân viên thật xử lý.

3. **Ranh giới & Điều cấm (Constraints & Out-of-Scope)**:
   - **Bất đồng bộ hóa (Async Ingestion)**: Tuyệt đối không gọi LLM hoặc tính toán chính sách trực tiếp trên luồng nhận Webhook của Facebook/Zalo.
   - ⛔ **Out-of-Scope (Không làm)**:
     - Không xây dựng mã giảm giá dạng Coupon/Voucher phức tạp nhiều tầng nhiều điều kiện — Chỉ áp dụng chính sách chiết khấu trực tiếp (Direct Discount).

4. **Tài liệu tham chiếu (References)**:
   - PRD: [`docs/product/prd-commerce-and-orders.md#37-ai-auto-pilot--discount-policy-engine`](file:///d:/workspace/Sales%20Copilot/docs/product/prd-commerce-and-orders.md)
   - RFC Kiến trúc: [`docs/architecture/rfc-commerce-and-orders.md#discount-policy-engine`](file:///d:/workspace/Sales%20Copilot/docs/architecture/rfc-commerce-and-orders.md)

5. **Tiêu chí nghiệm thu (Acceptance Criteria & Definition of Done)**:
   - [ ] Migration Prisma thành công: Model `DiscountPolicy` lưu chính sách chiết khấu và chế độ AI theo từng Workspace/Inbox.
   - [ ] Phân luồng chính xác 100% giữa nhân viên và AI theo 4 chế độ cấu hình (`ALWAYS_ON`, `OFF_HOURS`, `OVERFLOW`, `MANUAL`).
   - [ ] Động cơ chính sách chặn đứng 100% các đề xuất giảm giá vượt quá trần quy định của shop.
   - [ ] Giao diện Cài đặt lưu cấu hình mượt mà và áp dụng hiệu lực ngay lập tức.
   - [ ] Unit tests backend bao phủ: Thẩm định chính sách, phân luồng theo ca trực và trạng thái presence.
   - [ ] Chạy `pnpm typecheck` và `pnpm nx run server:test` pass 100%.

---

### Feature 2.6.2: Vòng Lặp Tư Vấn & Chốt Đơn Tự Động Nửa Đêm (End-to-End Midnight Checkout Loop)
*Trọn gói từ Worker AI xử lý nền ➔ Tự động Kiểm tra tồn kho khả dụng ➔ Tự tạo Đơn & gửi VietQR ➔ Nút Cướp Quyền (Takeover) của Nhân viên.*

1. **Mục tiêu & Trải nghiệm Người dùng (User Journey & Value)**:
   - Khách hàng nhắn tin lúc 02:00 sáng hỏi mua hàng ("Áo polo trắng size L còn không shop, ship về Cầu Giấy bao nhiêu tiền?").
   - AI Auto-pilot trong chế độ `OFF_HOURS` tự động:
     1. Tra cứu danh mục và tồn kho khả dụng thực tế của SKU `POLO-TRANG-L` (nếu hết hàng thì tư vấn biến thể khác, tuyệt đối không bán hàng khi hết tồn khả dụng).
     2. Bóc tách địa chỉ giao hàng và tính tổng tiền kèm phí ship.
     3. Tự động gọi API nội bộ tạo đơn hàng `CONFIRMED`, khóa tạm tồn kho nguyên tử và sinh mã Dynamic VietQR.
     4. Gửi tin nhắn trả lời kèm ảnh mã VietQR thu tiền cho khách.
   - Sáng hôm sau, nhân viên mở ca trực: Thấy đơn hàng đã được chốt và gạch nợ thành công, chỉ việc đóng gói!
   - Nếu nhân viên muốn can thiệp trong lúc AI đang trao đổi: Bấm nút **"Tiếp Quản Lại Từ AI"** (Takeover) trên header cuộc trò chuyện ➔ Ngắt quyền gửi tin tức thì của AI trong hội thoại đó.

2. **Quy tắc nghiệp vụ & Bất biến (Business Rules & Invariants)**:
   - **Tồn kho khả dụng là chân lý tối cao**: AI chỉ được phép chào và chốt các SKU có $\text{physicalStock} - \text{reservedStock} > 0$.
   - **Cơ chế Nhân viên Cướp quyền (Human Takeover)**:
     - Khi nhân viên gửi bất kỳ tin nhắn nào trong hội thoại hoặc bấm nút "Takeover", hệ thống gán cờ `isAiPaused: true` vào `Conversation`.
     - AI worker sẽ lập tức dừng mọi tác vụ sinh câu trả lời đang chờ xử lý cho hội thoại đó.

3. **Ranh giới & Điều cấm (Constraints & Out-of-Scope)**:
   - **Hạ tầng Background Job**: Tác vụ LLM và xử lý đơn hàng của AI Auto-pilot bắt buộc phải chạy qua BullMQ Worker, không ảnh hưởng đến API server chính.
   - ⛔ **Out-of-Scope (Không làm)**:
     - Không tích hợp Voice AI / đàm thoại giọng nói qua điện thoại — Chỉ hỗ trợ tin nhắn văn bản (Text Chat).

4. **Tài liệu tham chiếu (References)**:
   - PRD: [`docs/product/prd-commerce-and-orders.md#37-ai-auto-pilot--discount-policy-engine`](file:///d:/workspace/Sales%20Copilot/docs/product/prd-commerce-and-orders.md)
   - RFC Kiến trúc: [`docs/architecture/rfc-commerce-and-orders.md#ai-auto-pilot-worker`](file:///d:/workspace/Sales%20Copilot/docs/architecture/rfc-commerce-and-orders.md)

5. **Tiêu chí nghiệm thu (Acceptance Criteria & Definition of Done)**:
   - [ ] AI tự động tư vấn, kiểm tra tồn kho, tạo đơn hàng và gửi mã VietQR thành công trong kịch bản đêm.
   - [ ] Tuyệt đối không bao giờ chốt đơn SKU có tồn kho khả dụng = 0.
   - [ ] Nút Takeover ngắt ngay lập tức quyền tự động trả lời của AI và chuyển giao quyền kiểm soát cho nhân viên.
   - [ ] Unit tests backend bao phủ: Gemini Function Calling flow, kiểm tra tồn trước khi chốt, Human Takeover.
   - [ ] Chạy `pnpm typecheck` và `pnpm nx run server:test` pass 100%.
