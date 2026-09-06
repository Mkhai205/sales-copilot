# Engineering & Coding Guidelines

## 1. Purpose & Architectural Philosophy

Tài liệu này quy định các tiêu chuẩn kỹ thuật và quy ước lập trình cho **Sales Copilot Platform**.

Hệ thống tuân thủ triết lý **Pragmatic Modular Monolith**:
- **KISS (Keep It Simple, Stupid)**: Ưu tiên mã nguồn trực diện, dễ đọc, dễ bảo trì thay vì các pattern phức tạp.
- **YAGNI (You Aren't Gonna Need It)**: Chỉ viết code giải quyết yêu cầu cụ thể hiện tại. Không tạo abstraction dự phòng cho tương lai.
- **Co-location over Folder Sprawl**: Gom các thành phần liên quan chặt chẽ vào cùng một module thư mục, tránh phân tách thành hàng loạt micro-folders.
- **Quy chuẩn này là bản chi tiết hóa và hoàn toàn nhất quán với `AGENTS.md`.**

---

## 2. Backend Module Structure & Co-location

Mỗi tính năng backend được tổ chức thành một **NestJS Feature Module** gắn kết (Cohesive Module), nằm tại `apps/server/src/modules/<feature>/`.

### ✅ Cấu trúc chuẩn:
```text
modules/conversations/
├── conversations.module.ts         # NestJS Module definition & dependency wiring
├── conversations.controller.ts     # HTTP REST routes, auth guards & request delegation
├── conversations.service.ts        # Core business logic & Prisma database operations
├── conversations.dto.ts            # Input validation schemas (Zod) & TypeScript types
├── conversations.listener.ts       # Domain event listeners (@OnEvent) nếu có
└── conversations.service.spec.ts   # Unit & Service integration tests
```

### ❌ Cấm cấu trúc phân mảnh (Anti-Pattern):
Tuyệt đối **KHÔNG** tạo 10 tầng thư mục lồng nhau cho một tính năng:
`domain/entities`, `domain/value-objects`, `domain/events`, `application/commands`, `application/queries`, `application/ports`, `infrastructure/persistence`, `presentation/http`...

---

## 3. Direct Implementation & Anti-Over-Engineering

### 3.1. Không tạo Interface cho Single Implementation
- Trong NestJS và TypeScript, các class `@Injectable()` đã là first-class dependency injection token và có thể mock trực tiếp trong test bằng `jest.spyOn()` hoặc custom test provider.
- ❌ **KHÔNG TẠO**: `IUserService`, `IConversationService`, `IAuthService` khi chỉ có **MỘT** class hiện thực cụ thể.
- ✅ **Interface chỉ dùng khi**: Có tính đa hình thực sự (Polymorphic integrations) với nhiều adapter khác nhau (ví dụ: `ChannelAdapter` được implement bởi `FacebookAdapter`, `ZaloAdapter`, `TelegramAdapter`; `LlmProviderAdapter` cho `GeminiAdapter`, `OpenAiAdapter`).

### 3.2. Không tạo chuỗi chuyển đổi DTO/Mapper phức tạp
- ❌ **KHÔNG CHAIN**: `Entity` ➔ `DomainModel` ➔ `ApplicationDTO` ➔ `Presenter` ➔ `ViewModel`.
- ✅ **DO**: Dùng một Zod schema duy nhất để validate đầu vào request (`@ZodBody()`). Trả về Prisma model hoặc plain typed object trực tiếp. `TransformInterceptor` sẽ tự động đóng gói response envelope `{ success: true, data, meta }`.

### 3.3. Quy tắc số 3 (Rule of Three)
- Không trừu tượng hóa ở lần viết thứ 1 hoặc thứ 2. Cho phép lặp code 2 lần trước khi gom thành hàm dùng chung.
- Chỉ tạo shared helper/base class khi có **ít nhất 3 trường hợp cụ thể khác nhau** có logic hoàn toàn giống nhau.

---

## 4. Multi-Tenancy & Data Security (Bắt buộc)

### 4.1. Bắt buộc Tenant Scoping (`workspaceId`)
Mọi thao tác truy vấn, cập nhật, xóa dữ liệu trên tài nguyên nghiệp vụ **BẮT BUỘC PHẢI CÓ `workspaceId`** trong mệnh đề `where` của Prisma:
```typescript
// ❌ SAI: Dễ rò rỉ dữ liệu chéo tenant
const conv = await this.prisma.conversation.findUnique({ where: { id } });

// ✅ ĐÚNG: Luôn khóa chặt theo workspaceId
const conv = await this.prisma.conversation.findFirst({
  where: { id, workspaceId },
});
```

### 4.2. Bảo mật Credentials kênh liên lạc
- Cột `Channel.credentials` lưu trữ thông tin nhạy cảm (Access Token, App Secret, Webhook Secret) phải được mã hóa tại rest bằng thuật toán **AES-256-GCM**.
- Mọi thao tác đọc/ghi credentials phải đi qua `ChannelCredentialService`.
- Tuyệt đối không log credentials dạng plaintext ra terminal, console hoặc trả về client API.

### 4.3. Xác thực Webhook đầu vào
- Toàn bộ webhook nhận từ bên ngoài (Facebook, Zalo, Telegram...) phải được verify chữ ký số (HMAC-SHA256 signature) trước khi xử lý payload.

---

## 5. Ranh giới Module & Tiêu chuẩn AI Hiệu năng cao

### 5.1. Encapsulation & Gọi chéo Module
- Module đóng gói nghiệp vụ trong NestJS Service và export ra ngoài qua `exports: [...]` trong `*.module.ts`.
- ❌ Không trực tiếp truy vấn hoặc mutate Prisma model của module khác. Luôn gọi qua exported service hoặc bắn domain event.
- **In-process**: Sử dụng `EventEmitter2` cho side-effects không đồng bộ (`@OnEvent('message.created')`).
- **Background Jobs**: Sử dụng hàng đợi Redis BullMQ cho các tác vụ nặng hoặc cần retry (gửi webhook, xử lý AI).

### 5.2. Nguyên tắc tiếp nhận tin nhắn AI không chặn (Async AI Ingestion)
- Luồng tiếp nhận tin nhắn (`inbound webhook / message ingestion`) **TUYỆT ĐỐI KHÔNG CHẶN (BLOCK) ĐỂ CHỜ LLM INFERENCE**.
- Webhook tiếp nhận phải phản hồi thành công trong vòng `< 100ms`. Việc phân tích tín hiệu mua hàng (buying signals), tính điểm lead scoring và tạo draft reply phải được đẩy vào BullMQ queue để xử lý bất đồng bộ.

### 5.3. Bằng chứng AI phải có nguồn gốc rõ ràng (Traceable AI Evidence)
- Mọi tín hiệu mua hàng (buying signals) và bằng chứng bán hàng do LLM trích xuất bắt buộc phải gắn kèm trích dẫn nguyên văn (`verbatim quote`) và tham chiếu chính xác `messageId` và `conversationId`.

---

## 6. Xử lý lỗi & Định dạng phản hồi API

### 6.1. Dùng Built-in NestJS Exceptions
- Sử dụng trực tiếp các standard exception từ `@nestjs/common` (`NotFoundException`, `BadRequestException`, `ConflictException`, `ForbiddenException`, `UnauthorizedException`).
- ❌ Không tạo hệ thống phân cấp exception trừu tượng (`DomainError`, `ApplicationError`, `CustomBaseException`).
- Khi cần mã lỗi nghiệp vụ, truyền object có cấu trúc:
  ```typescript
  throw new ConflictException({
    code: 'EMAIL_ALREADY_EXISTS',
    message: 'Email is already in use by another account',
    details: { email },
  });
  ```

### 6.2. Envelope chuẩn hóa tự động
- Controllers chỉ cần trả về dữ liệu thuần: object hoặc `{ items, meta }`.
- `TransformInterceptor` tự động bọc thành:
  ```json
  {
    "success": true,
    "data": { ... },
    "meta": { ... }
  }
  ```
- `HttpExceptionFilter` tự động bắt mọi ngoại lệ và định dạng:
  ```json
  {
    "success": false,
    "error": {
      "code": "NOT_FOUND",
      "message": "Resource not found",
      "details": null
    }
  }
  ```

---

## 7. Frontend Guidelines (Next.js & Shadcn UI)

1. **Bắt buộc tái sử dụng Shadcn UI Primitives**:
   - 50+ component nguyên tử đã được cấu hình tại `apps/web/src/components/ui/`.
   - Tra cứu skill `shadcn` trước khi viết bất kỳ UI mới nào. Tuyệt đối không tự viết modal, dropdown hay button tùy biến từ đầu.
   - Form layout: dùng `FieldGroup` + `Field`. Khoảng cách: dùng `gap-*` (không dùng `space-y-*`). Kích thước bằng nhau: dùng `size-*`.
2. **Quản lý Server State**:
   - Sử dụng duy nhất `@tanstack/react-query`.
   - Sử dụng client `fetch` mỏng trong `src/lib/api/client.ts` cùng types từ `@sales-copilot/shared-contracts`. Không cài đặt Axios hay SWR.
3. **Xác thực Cookie an toàn**:
   - JWT tokens lưu trữ trong `httpOnly` secure cookies qua Server Actions & Next.js Middleware. Không lưu token vào `localStorage`.
4. **Theming & Toast**:
   - Dùng semantic Tailwind classes (`bg-background`, `text-foreground`, `text-primary`, `border-border`).
   - Hiển thị toast bằng thư viện `sonner` (`toast.success()`, `toast.error()`).

---

## 8. Chiến lược kiểm thử (Testing Guidelines)

- **Viết kiểm thử có giá trị cao**: Tập trung vào quy tắc nghiệp vụ cốt lõi, state machine transitions, phân tách tenant (`workspaceId`), và đối soát contact deduplication.
- ❌ **Tránh kiểm thử giòn gãy (Brittle Tests)**: Không viết 200 dòng mock chỉ để test một hàm getter 3 dòng hoặc hàm ủy quyền CRUD đơn giản.
- Mọi tính năng hoàn thành khi:
  1. Đảm bảo bảo mật và cô lập tenant.
  2. Code tinh gọn theo chuẩn YAGNI & KISS.
  3. Linter & build vượt qua: `pnpm nx run <project>:lint`, `pnpm nx run <project>:build`.
  4. Test pass: `pnpm nx run <project>:test`.
