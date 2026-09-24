# AGENTS.md

## 1. Project Vision & Current Goal

Sales Copilot là hệ thống Omnichannel Conversational Commerce.
Mục tiêu trọng tâm hiện tại: **Phát triển tính năng mới cho Core Backend và Web UI** (đặc biệt tập trung vào các module Chatbot, Commerce, và Inventory).

## 2. Core Directive: Pragmatic & Clean Engineering (Anti-Over-Engineering != Sloppy Code)

- **Tối giản cấu trúc, KHÔNG cẩu thả (Pragmatic != Naive):**
  - Tối giản là loại bỏ các lớp vỏ bọc vô nghĩa (ceremony), tuyệt đối **KHÔNG cắt bớt tính đúng đắn và an toàn của nghiệp vụ**.
  - Không bao giờ bỏ qua: validation dữ liệu, kiểm tra quyền hạn (RBAC), error handling, và kiểm tra tính hợp lệ của trạng thái (State Machine của Order, Payment, Inventory).
- **Tính toàn vẹn dữ liệu (Data Integrity & ACID):**
  - Mọi thao tác ghi liên quan đến tiền bạc, tạo/huỷ đơn hàng, và xuất nhập tồn kho **BẮT BUỘC dùng `prisma.$transaction`** để đảm bảo an toàn ACID và phòng chống race conditions (bán âm kho, lệch giao dịch).
- **Skinny Controller, Rich & Cohesive Service:**
  - Controller chỉ làm nhiệm vụ HTTP (routing, auth guards, gọi service, trả response). Toàn bộ business logic thuộc về Service.
  - Tránh "God Method": nếu một hàm nghiệp vụ dài và phức tạp, hãy phân tách thành các private helper methods có tên gọi rõ nghĩa.
- **Không tạo Layer dư thừa:**
  - Tuyệt đối KHÔNG áp dụng Clean Architecture/DDD cồng kềnh với hàng tá tầng trung gian (`Controller -> Facade -> AppService -> DomainService -> IRepository -> Repository`). NestJS Controller gọi đến Service, và Service gọi trực tiếp qua Prisma ORM.
  - KHÔNG tạo interface hình thức nếu chỉ có 1 implementation (ví dụ: không tạo `IUserService` chỉ để cho `UserService` implement).
  - Dùng luôn Zod schema làm DTO và trả về Prisma model trực tiếp, không viết các mapper layer (`Entity -> Domain -> DTO -> View`) vô ích.
- **Design Patterns có chủ đích (Just-in-Time Patterns):**
  - Không phán đoán tương lai để vẽ pattern vu vơ. NHƯNG khi gặp bài toán đa kênh (Omnichannel: WebChat, Facebook, Telegram) hoặc đa đối tác (Shipping: GHN, GHTK; Payment: VietQR, SePay), **BẮT BUỘC dùng Strategy / Adapter Pattern** để tách biệt clean, tránh viết chuỗi `if/else` chằng chịt trong một service.
- **Ponytail Decision Ladder & Don't Reinvent the Wheel:**
  - Trước khi viết code, dừng lại ở nấc thang đầu tiên thoả mãn:
    1. _Có thực sự cần không?_ (YAGNI - Không cần thì bỏ qua).
    2. _Codebase đã có sẵn chưa?_ (Tái sử dụng helper/pattern có sẵn).
    3. _Stdlib / Native Platform có sẵn không?.
    4. _Dependencies đã cài trong repo có làm được không?_ (Dùng thư viện đã có).
    5. _Có dependencies hay lib nào phổ biến đáng tin cậy có thể giải quyết được không?_ Tìm kiếm và xác nhận nếu được thì cài đặt và dùng không phải code lại.
    6. _Chỉ khi đó mới viết code mới:_ Viết lượng code tối thiểu nhất, clean nhất và có kiểm thử đầy đủ.
- **Rule of Three:** Chỉ đóng gói (abstract) code thành helper dùng chung sau khi đoạn code đó đã bị duplicate ít nhất 2 lần.

## 3. Mandatory Security & Data Isolation (Strict Multi-Tenancy)

- **Luôn gắn `workspaceId`:** Hệ thống áp dụng Strict Multi-tenancy. TẤT CẢ các truy vấn database (từ `findUnique`, `findFirst`, `update`, đến `delete`) cho các resource của tổ chức ĐỀU PHẢI có `workspaceId` trong điều kiện `where`.
  - ❌ _Sai:_ `prisma.order.findUnique({ where: { id } })`
  - ✅ _Đúng:_ `prisma.order.findFirst({ where: { id, workspaceId } })`
- **Database Safety:** Không bao giờ chạy các lệnh phá huỷ dữ liệu (như `prisma migrate reset` hoặc `db push --force-reset`) mà chưa có sự chấp thuận rõ ràng của user.

## 4. Frontend Guidelines (Next.js & Web UI)

- **Giao diện:** BẮT BUỘC tái sử dụng các primitive của **Shadcn UI** và **Tailwind CSS**. Không tự phát minh lại các UI components nếu Shadcn đã có. Luôn check `src/components/ui/` trước khi code. Dùng skills /frontend-design /shadcn /tailwind-v4-shadcn.
- **State Management:** Quản lý server state (fetching, caching, mutation) BẮT BUỘC dùng **TanStack Query** (React Query). Hạn chế tối đa dùng `useEffect` để fetch API thủ công. Dùng skills /tanstack-query-best-practices /vercel-react-best-practices.
- **Design Tokens:** Sử dụng các utility classes ngữ nghĩa của Tailwind.

## 5. Workflow & Human-in-the-Loop

- **Plan Before Code:** Với bất kỳ task lớn, thêm tính năng hoặc refactor sâu, AI Agent PHẢI tạo file `implementation_plan.md` và chờ user phê duyệt trước khi sinh code.
- **Trức khi viết test:** Đọc skills tdd.
- **Verification:** Sau khi code xong, luôn verify lại bằng các lệnh `lint`, `typecheck` hoặc `test` để đảm bảo code không làm break hệ thống hiện tại.
