# AGENTS.md

## 1. Project Vision & Current Goal

Sales Copilot là hệ thống Omnichannel Conversational Commerce.
Mục tiêu trọng tâm hiện tại: **Phát triển tính năng mới cho Core Backend và Web UI** (đặc biệt tập trung vào các module Chatbot, Commerce, và Inventory).

## 2. Core Directive: Anti-Over-Engineering (KISS & YAGNI)

- **Tối giản cấu trúc (Backend):** Ưu tiên lối viết trực tiếp, idiomatic. NestJS Controller gọi đến Service, và Service gọi trực tiếp qua Prisma ORM.
- **Không tạo Layer dư thừa:** Tuyệt đối KHÔNG áp dụng Clean Architecture rườm rà. KHÔNG tạo các interface thừa (ví dụ `IUserService`) hoặc mapping qua nhiều tầng DTO (Entity -> Domain -> DTO -> View). Dùng luôn Zod schema làm DTO và trả về Prisma model trực tiếp.
- **Rule of Three:** Chỉ đóng gói (abstract) code thành helper dùng chung sau khi đoạn code đó đã bị duplicate ít nhất 2 lần. Không đoán trước tương lai.

## 3. Mandatory Security & Data Isolation (Strict Multi-Tenancy)

- **Luôn gắn `workspaceId`:** Hệ thống áp dụng Strict Multi-tenancy. TẤT CẢ các truy vấn database (từ `findUnique`, `findFirst`, `update`, đến `delete`) cho các resource của tổ chức ĐỀU PHẢI có `workspaceId` trong điều kiện `where`.
  - ❌ _Sai:_ `prisma.order.findUnique({ where: { id } })`
  - ✅ _Đúng:_ `prisma.order.findFirst({ where: { id, workspaceId } })`
- **Database Safety:** Không bao giờ chạy các lệnh phá huỷ dữ liệu (như `prisma migrate reset` hoặc `db push --force-reset`) mà chưa có sự chấp thuận rõ ràng của user.

## 4. Frontend Guidelines (Next.js & Web UI)

- **Giao diện:** BẮT BUỘC tái sử dụng các primitive của **Shadcn UI** và **Tailwind CSS**. Không tự phát minh lại các UI components nếu Shadcn đã có. Luôn check `src/components/ui/` trước khi code.
- **State Management:** Quản lý server state (fetching, caching, mutation) BẮT BUỘC dùng **TanStack Query** (React Query). Hạn chế tối đa dùng `useEffect` để fetch API thủ công.
- **Design Tokens:** Sử dụng các utility classes ngữ nghĩa của Tailwind (như `bg-background`, `text-foreground`, `text-primary`).

## 5. Workflow & Human-in-the-Loop

- **Plan Before Code:** Với bất kỳ task lớn, thêm tính năng hoặc refactor sâu, AI Agent PHẢI tạo file `implementation_plan.md` và chờ user phê duyệt trước khi sinh code.
- **Verification:** Sau khi code xong, luôn verify lại bằng các lệnh `lint`, `typecheck` hoặc `test` để đảm bảo code không làm break hệ thống hiện tại.
