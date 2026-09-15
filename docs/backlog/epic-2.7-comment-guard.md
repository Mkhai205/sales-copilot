# Epic 2.7: Vệ Sĩ Ẩn Bình Luận Chống Cướp Khách (Anti-theft Comment Guard)

> **Mục tiêu**: Lắng nghe Webhook bình luận công khai trên bài viết và livestream mạng xã hội (Facebook/TikTok), quét số điện thoại trong `< 1s` để tự động ẩn bình luận tránh bị đối thủ quét data cướp khách, đồng thời tự động gửi tin nhắn riêng (Private Message) kéo khách vào hộp thư để nhân viên tư vấn chốt đơn theo mô hình lát cắt dọc khép kín (Vertical Slices).\
> **Vị trí tài liệu**: `docs/backlog/epic-2.7-comment-guard.md`\
> **Phụ thuộc**: `channels`, `inboxes`, `conversations`\
> **Độ phức tạp**: 🟡 Medium | **Trạng thái**: ⏳ Chờ Milestone 2A

---

## Danh Sách Lát Cắt Tính Năng Dọc (Vertical Features)

### Feature 2.7.1: Quét SĐT & Ẩn Bình Luận Mạng Xã Hội < 1s (End-to-End Realtime Comment Masking)
*Trọn gói từ Tiếp nhận Webhook Bình luận ➔ Động cơ Quét SĐT siêu tốc ➔ Tự động ẩn bình luận trên Facebook Graph API trong < 1 giây.*

1. **Mục tiêu & Trải nghiệm Người dùng (User Journey & Value)**:
   - Khách hàng để lại bình luận công khai trên bài viết Fanpage: *"Tư vấn cho mình áo polo size M nhé, sđt 0912 345 678"*.
   - Hệ thống tiếp nhận webhook sự kiện bình luận từ Facebook, động cơ Regex nhận diện có chuỗi số điện thoại ➔ Ngay lập tức gọi Graph API ẩn bình luận (`is_hidden: true`).
   - **Tốc độ thực thi < 1s (Sub-second execution)**: Đối thủ hoặc các tool cào data hoàn toàn không kịp nhìn thấy số điện thoại của khách để cướp đơn.
   - Các bình luận không chứa SĐT (ví dụ: *"Hàng đẹp quá shop ơi"*) được giữ nguyên công khai để duy trì tương tác tự nhiên của bài viết.

2. **Quy tắc nghiệp vụ & Bất biến (Business Rules & Invariants)**:
   - **Nhận diện lách luật (Anti-obfuscation Regex)**:
     - Nhận diện đa dạng các kiểu viết SĐT của khách hàng Việt Nam: viết liền (`0912345678`), viết cách (`0912 345 678`), viết chấm (`0912.345.678`), và viết chữ kết hợp số (`0 chín 1 2...`).
   - **Hiệu năng & Bảo mật Token**:
     - Phản hồi webhook Facebook HTTP 200 trong < 100ms.
     - Access Token của Page dùng để gọi Graph API ẩn bình luận bắt buộc phải được giải mã qua `ChannelCredentialService` (AES-256-GCM).

3. **Ranh giới & Điều cấm (Constraints & Out-of-Scope)**:
   - **Idempotency Webhook**: Khử trùng lặp webhook thông qua bảng `ChannelEvent` để không gọi Graph API nhiều lần cho 1 comment ID.
   - ⛔ **Out-of-Scope (Không làm)**:
     - Không xóa vĩnh viễn bình luận (Delete comment) — Chỉ ẩn (`is_hidden: true`) để giữ lại tương tác tổng cho Page.

4. **Tài liệu tham chiếu (References)**:
   - PRD: [`docs/product/prd-commerce-and-orders.md#38-anti-theft-comment-guard`](file:///d:/workspace/Sales%20Copilot/docs/product/prd-commerce-and-orders.md)
   - RFC Kiến trúc: [`docs/architecture/rfc-commerce-and-orders.md#comment-guard-pipeline`](file:///d:/workspace/Sales%20Copilot/docs/architecture/rfc-commerce-and-orders.md)

5. **Tiêu chí nghiệm thu (Acceptance Criteria & Definition of Done)**:
   - [ ] Tiếp nhận webhook bình luận mượt mà, khử trùng lặp qua `ChannelEvent`.
   - [ ] Ẩn thành công bình luận chứa SĐT trên Facebook trong < 1s kể từ khi khách đăng.
   - [ ] Giữ nguyên hiển thị công khai đối với các bình luận khen/hỏi han thông thường không chứa SĐT.
   - [ ] Unit tests backend bao phủ: Regex phát hiện nhiều định dạng SĐT lách luật, luồng gọi Graph API ẩn bình luận.
   - [ ] Chạy `pnpm typecheck` và `pnpm nx run server:test` pass 100%.

---

### Feature 2.7.2: Kéo Khách Vào Hộp Thư Qua Private Message & Giao Diện Cấu Hình (End-to-End Private Message & Settings)
*Trọn gói từ Tự động gửi tin nhắn riêng Private Message ➔ Đẩy vào Unified Inbox thành hội thoại mới ➔ Giao diện Cài đặt & Thống kê.*

1. **Mục tiêu & Trải nghiệm Người dùng (User Journey & Value)**:
   - Sau khi tự động ẩn bình luận chứa SĐT, hệ thống tự động gửi một tin nhắn riêng (Private Message) vào Messenger của khách: *"Dạ chào bạn [Tên khách], Shop đã nhận được thông tin liên hệ của bạn. Shop xin phép nhắn tin riêng để bảo mật số điện thoại và tư vấn chi tiết cho bạn ạ!"*.
   - Cuộc trò chuyện này tự động xuất hiện ngay trong danh sách chat `/conversations` của nhân viên kèm nhãn nổi bật `Từ Bình Luận`, cho phép nhân viên tiếp tục tư vấn chốt đơn.
   - Chủ shop có thể vào Cài đặt Inbox ➔ Tab "Vệ sĩ bình luận": Bật/tắt tính năng, chỉnh sửa nội dung tin nhắn riêng mẫu, và xem thống kê số bình luận đã được bảo vệ thành công.

2. **Quy tắc nghiệp vụ & Bất biến (Business Rules & Invariants)**:
   - **Chính sách Meta Platform (Facebook Private Replies)**:
     - Gọi `POST /{comment-id}/private_replies` trong vòng 7 ngày kể từ khi khách bình luận. Mỗi bình luận chỉ được gửi 1 tin nhắn riêng duy nhất.
   - **Hợp nhất danh tính (Identity Resolution)**:
     - Tự động tạo `Contact` và `Conversation` mới trong Unified Inbox hoặc gắn vào luồng hội thoại cũ nếu khách hàng đã từng nhắn tin trước đó.

3. **Ranh giới & Điều cấm (Constraints & Out-of-Scope)**:
   - **Xác thực cấu hình**: Cài đặt nội dung tin nhắn riêng được lưu theo từng kênh `Channel`/`Inbox`.
   - ⛔ **Out-of-Scope (Không làm)**:
     - Không tự động spam tin nhắn quảng cáo hàng loạt (Broadcast) cho những người bình luận bài viết cũ.

4. **Tài liệu tham chiếu (References)**:
   - PRD: [`docs/product/prd-commerce-and-orders.md#38-anti-theft-comment-guard`](file:///d:/workspace/Sales%20Copilot/docs/product/prd-commerce-and-orders.md)
   - RFC Kiến trúc: [`docs/architecture/rfc-commerce-and-orders.md#private-reply-pipeline`](file:///d:/workspace/Sales%20Copilot/docs/architecture/rfc-commerce-and-orders.md)

5. **Tiêu chí nghiệm thu (Acceptance Criteria & Definition of Done)**:
   - [ ] Gửi tin nhắn riêng Private Message thành công vào Messenger của khách sau khi ẩn bình luận.
   - [ ] Cuộc trò chuyện mới xuất hiện ngay lập tức trong Unified Inbox kèm nhãn `Từ Bình Luận`.
   - [ ] Giao diện Cài đặt cho phép bật/tắt và tùy biến tin nhắn mẫu trực quan.
   - [ ] Unit tests backend bao phủ: Gọi Private Replies API, khởi tạo conversation từ comment webhook.
   - [ ] Chạy `pnpm typecheck` và `pnpm nx run server:test` pass 100%.
