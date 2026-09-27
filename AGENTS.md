# AGENTS.md

## 1. Project Overview

Sales Copilot là hệ thống Omnichannel Conversational Commerce.

**Development Stage: Pre-production.** Dự án đang trong giai đoạn phát triển tích cực, chưa có production deployment hay user data thực. Kiến trúc và tính năng có thể thay đổi thường xuyên. Khi refactor hoặc thay đổi kiến trúc, **xóa sạch code cũ** — KHÔNG viết adapter tương thích ngược, KHÔNG giữ lại code "phòng trường hợp cần lại".

## 2. Code Hygiene — Nguyên tắc khi chỉnh sửa code

> **Directive cốt lõi:** Mỗi lần chạm vào code, để lại nó sạch hơn lúc tìm thấy. Thêm code mới không bao giờ là lý do để giữ lại code rác xung quanh.

- **Đọc hiểu trước khi sửa:** Khi chỉnh sửa một file, đọc hiểu toàn bộ file đó và các file liên quan trực tiếp. Không chỉ nhìn vào hàm cần sửa rồi bỏ qua phần còn lại.
- **Xóa > Giữ lại:** Nếu phát hiện dead code, logic thừa, import không dùng, hoặc pattern lỗi thời trong file đang sửa — dọn luôn trong cùng thay đổi. Không comment out, không để TODO, không "giữ phòng khi cần".
- **Không copy pattern mù quáng:** Khi tham khảo code từ file khác trong cùng codebase, luôn kiểm tra pattern đó có còn đúng với kiến trúc hiện tại không. Code cũ trong dự án có thể đã lỗi thời.
- **Không lặp lại logic đã có ở tầng khác:** Nếu một tầng đã xử lý (validate, transform, fallback, format...) thì các tầng bên trong không viết lại cùng logic đó. Trước khi viết bất kỳ đoạn phòng thủ nào, kiểm tra xem đã có tầng nào đảm nhận chưa.
- **Khi gặp nhiều cách làm cùng một việc trong codebase:** Xác định cách nào đúng/mới hơn, follow cách đó. Nếu đang sửa file chứa cách cũ, chuyển luôn sang cách mới.
- **Gặp bug ngoài scope task:** Nếu nhỏ và rõ ràng (typo, off-by-one, null check thiếu) — sửa luôn. Nếu phức tạp hoặc có thể ảnh hưởng rộng — báo cho user, không tự ý sửa.
- **Sau khi hoàn thành, tự kiểm tra:**
  - Code tôi vừa viết có gì thừa không?
  - Thay đổi của tôi có khiến code nào khác trở nên obsolete không? Nếu có, xóa luôn.
  - Có function/variable nào không còn ai gọi sau thay đổi này không?

## 3. Pragmatic & Clean Engineering

- **Tối giản cấu trúc, KHÔNG cẩu thả:**
  - Tối giản = loại bỏ ceremony vô nghĩa. KHÔNG BAO GIỜ cắt bớt: validation dữ liệu, RBAC, error handling, state machine checks (Order, Payment, Inventory).
- **Data Integrity:**
  - Mọi thao tác ghi liên quan đến tiền bạc, đơn hàng, tồn kho **BẮT BUỘC dùng `prisma.$transaction`**.
- **Skinny Controller, Rich Service:**
  - Controller: routing, auth guards, gọi service, trả response. Business logic thuộc về Service.
  - Tránh "God Method" — phân tách thành private helpers có tên rõ nghĩa.
- **Không tạo Layer dư thừa:**
  - KHÔNG áp dụng Clean Architecture/DDD cồng kềnh. Flow: Controller → Service → Prisma.
  - KHÔNG tạo interface khi chỉ có 1 implementation.
  - Dùng Zod schema làm DTO, trả Prisma model trực tiếp.
- **Design Patterns có chủ đích:**
  - KHÔNG vẽ pattern phán đoán tương lai. NHƯNG bài toán đa kênh (WebChat, Facebook, Telegram) hoặc đa đối tác (Shipping, Payment) **BẮT BUỘC dùng Strategy/Adapter Pattern**.
- **Ponytail Decision Ladder:**
  1. Có thực sự cần không? (YAGNI)
  2. Codebase đã có sẵn chưa?
  3. Stdlib / Native Platform có sẵn không?
  4. Dependencies đã cài có làm được không?
  5. Có lib phổ biến đáng tin cậy không? → Cài và dùng.
  6. Chỉ khi đó mới viết code mới — tối thiểu, clean, có test.
- **Rule of Three:** Chỉ abstract thành helper dùng chung khi đã duplicate ít nhất 2 lần.

## 4. Security & Multi-Tenancy

- **Strict Multi-tenancy:** TẤT CẢ truy vấn database cho resource của tổ chức PHẢI có `workspaceId` trong `where`.
  - ❌ `prisma.order.findUnique({ where: { id } })`
  - ✅ `prisma.order.findFirst({ where: { id, workspaceId } })`
- **Database Safety:** KHÔNG chạy lệnh phá huỷ dữ liệu (`prisma migrate reset`, `db push --force-reset`) khi chưa có sự chấp thuận rõ ràng của user.

## 5. Frontend (Next.js & Web UI)

- Tái sử dụng **Shadcn UI** + **Tailwind CSS**. Luôn kiểm tra `src/components/ui/` trước khi tạo component mới.
- Server state management BẮT BUỘC dùng **TanStack Query**. Hạn chế `useEffect` fetch API thủ công.
- Sử dụng semantic Tailwind utility classes cho design tokens.

## 6. Workflow

- **Test:** Đọc skill `tdd` trước khi viết test. Viết test cho behavior, không cho implementation details.
- **Verification:** Sau khi code xong, chạy `lint`, `typecheck`, `test` để đảm bảo không regression.
