# Engineering Coding Guidelines

## 1. Purpose

Tài liệu này quy định các nguyên tắc implement code cho Sales Copilot Platform.

Mục tiêu:

- Code dễ đọc và maintain.
- Giữ đúng module boundaries.
- Giảm coupling.
- Dễ test.
- Dễ refactor.
- Không để implementation detail làm ô nhiễm domain logic.
- Cho phép coding agent phát triển từng module độc lập.

Các quy tắc trong file này bổ sung cho `AGENTS.md`.

## 2. General Principles

Ưu tiên:

- Simple over clever.
- Explicit over implicit.
- Composition over inheritance.
- Small cohesive modules.
- Strong typing.
- Dependency inversion tại architectural boundaries.
- Business logic ở đúng layer.
- Fail fast đối với invalid input.
- Immutable data khi phù hợp.

Không tạo abstraction nếu chưa có vấn đề thực tế cần giải quyết.

Không sử dụng design pattern chỉ vì pattern đó tồn tại.

## 3. Backend Layering

Backend ưu tiên:

```text
Presentation
    ↓
Application
    ↓
Domain
    ↑
Infrastructure
```

### Presentation

Chứa:

- REST controllers
- WebSocket gateways
- Request/response mapping
- Authentication context
- Input validation

Không chứa business logic.

Controller nên thực hiện:

```text
request
→ validate
→ authorize
→ call use-case
→ map response
```

Không thực hiện:

```text
controller
→ database
→ business decision
→ external provider
```

### Application

Chứa:

- Use cases
- Commands
- Queries
- Application services
- Transaction orchestration
- Authorization checks ở application boundary
- Event publishing

Application layer điều phối domain objects và infrastructure ports.

### Domain

Chứa:

- Entities
- Value objects
- Domain services
- Domain rules
- Domain events
- Business invariants

Domain không phụ thuộc:

- NestJS
- Prisma
- PostgreSQL
- Redis
- OpenAI
- Gemini
- Facebook SDK
- Zalo SDK
- Telegram SDK

### Infrastructure

Chứa:

- Database implementations
- Repository implementations
- Redis
- Queue
- Object storage
- External providers
- LLM adapters
- Channel adapters

Infrastructure implement interfaces được định nghĩa bởi application/domain khi cần dependency inversion.

## 4. Module Structure

Một module nên có cấu trúc tương tự:

```text
module/
├── domain/
│   ├── entities/
│   ├── value-objects/
│   ├── events/
│   └── repositories/
│
├── application/
│   ├── commands/
│   ├── queries/
│   ├── services/
│   └── dto/
│
├── infrastructure/
│   ├── persistence/
│   ├── integrations/
│   └── services/
│
└── presentation/
    ├── http/
    └── websocket/
```

Không bắt buộc mọi module phải có đầy đủ tất cả folder.

Không tạo empty abstraction chỉ để tuân thủ structure.

## 5. Naming

Tên phải phản ánh domain.

Ưu tiên:

```text
LeadScoringService
ConversationAssignment
MessageReceived
CreateLead
AnalyzeConversation
SendChannelMessage
```

Tránh:

```text
DataManager
CommonService
HelperService
UtilityManager
ProcessService
GenericHandler
```

Tên generic thường là dấu hiệu module boundary chưa rõ.

## 6. Services

Service phải có một responsibility rõ ràng.

Tránh God Service:

```text
SalesService
ConversationService
AIService
```

nếu chúng xử lý quá nhiều use cases.

Ưu tiên:

```text
LeadScoringService
LeadQualificationService
ConversationSummaryService
ReplySuggestionService
AgentActionService
```

## 7. DTOs and Contracts

DTO/API contract không được sử dụng như domain entity.

Phân biệt:

```text
API DTO
Application Command
Domain Entity
Persistence Model
```

Không expose ORM model trực tiếp ra API.

Validation xảy ra tại boundary.

Shared contracts chỉ chứa contract cần chia sẻ giữa applications/packages.

Không biến shared package thành nơi chứa mọi loại utility.

## 8. Validation

Input từ bên ngoài phải được validate.

Validation phải xảy ra trước khi business logic được thực thi.

Các boundary cần validation:

- REST API
- WebSocket
- Webhooks
- Queue jobs
- External provider responses
- AI structured output

AI output phải được validate như untrusted external input.

## 9. Error Handling

Không throw generic errors nếu domain/application có thể biểu diễn error cụ thể.

Ưu tiên error có semantic meaning:

```text
LeadNotFound
InvalidLeadTransition
UnauthorizedWorkspaceAccess
ConversationNotFound
MessageAlreadyProcessed
ChannelNotConnected
AIActionNotAllowed
```

API layer map application/domain errors thành HTTP response phù hợp.

Không leak internal stack traces hoặc infrastructure details ra client.

## 10. Database Access

Không truy cập database trực tiếp từ:

- Controller
- WebSocket gateway
- Domain entity
- AI agent
- External integration handler

Database access đi qua repository/data-access layer.

Query phải:

- Có scope tenant/workspace.
- Tránh N+1.
- Có index phù hợp.
- Có transaction khi cần consistency.

Không query toàn bộ dataset nếu chỉ cần một subset.

## 11. Transactions

Transaction được sử dụng cho các operation cần atomicity.

Ví dụ:

```text
Create Lead
+
Create initial Lead Intelligence
+
Publish required state
```

Không giữ transaction trong thời gian dài.

Không thực hiện external API calls trong database transaction nếu có thể tránh.

External side effects nên sử dụng event/outbox/background processing khi phù hợp.

## 12. Idempotency

Các operation có khả năng nhận duplicate request/event phải idempotent.

Đặc biệt:

- Webhooks
- Incoming messages
- Queue jobs
- AI jobs
- External API callbacks
- Autonomous actions

External event nên có unique identifier hoặc deduplication strategy.

## 13. Event Rules

Event phải biểu diễn một fact đã xảy ra.

Tốt:

```text
MessageReceived
LeadScoreUpdated
ConversationAssigned
ActionExecuted
```

Không dùng event để biểu diễn arbitrary command.

Command:

```text
SendMessage
ScoreLead
AssignConversation
```

Event:

```text
MessageSent
LeadScored
ConversationAssigned
```

Event payload phải typed và stable.

## 14. Queue / Background Jobs

Job phải:

- Có unique identity khi cần.
- Có retry strategy.
- Có timeout.
- Có failure handling.
- Có observability.
- Có idempotency.

Không đưa synchronous request processing vào queue chỉ vì "có thể".

Queue phù hợp với:

- AI processing
- Webhook processing
- Heavy computation
- External synchronization
- Retryable operations
- Notifications
- Media processing

## 15. External Integrations

Mọi external integration phải được adapter hóa.

Ví dụ:

```text
ChannelPort
├── FacebookAdapter
├── ZaloAdapter
├── TelegramAdapter
└── EmailAdapter
```

LLM:

```text
LLMProvider
├── OpenAIAdapter
└── GeminiAdapter
```

Không để external SDK types xuất hiện trong domain/application contracts.

## 16. AI Code

AI code phải coi model output là probabilistic/untrusted.

Không tin tưởng trực tiếp:

```text
LLM output
→ database mutation
```

Phải:

```text
LLM
→ structured output
→ validation
→ policy
→ application use-case
→ mutation
```

AI không được bypass authorization.

AI không được truy cập database trực tiếp.

AI tool phải có explicit schema và permission.

## 17. Frontend

Frontend không chứa server-side business rules.

Components nên tập trung vào:

- Presentation
- Interaction
- State
- API calls
- Realtime rendering

Không duplicate backend domain rules trong frontend.

Các UI states quan trọng phải được xử lý:

- Loading
- Empty
- Error
- Unauthorized
- Optimistic state nếu cần
- Realtime update
- Retry

## 18. Realtime

WebSocket event phải có typed payload.

Không gửi raw database entities trực tiếp.

Realtime event nên đại diện cho client-facing state change.

Authorization phải được kiểm tra trước khi subscribe hoặc publish data.

## 19. Logging

Sử dụng structured logging.

Mỗi request/job quan trọng nên có correlation identifier.

Không log:

- Password
- API key
- Access token
- Refresh token
- Sensitive customer information không cần thiết
- Full conversation content nếu không cần

AI execution nên có metadata đủ để debug nhưng không log secret/provider credentials.

## 20. Comments

Comment giải thích "why", không giải thích những gì code đã rõ ràng thể hiện.

Không viết comment cho code đơn giản.

Nếu logic phức tạp do business rule, comment nên giải thích invariant hoặc reason.

## 21. Refactoring

Refactor được khuyến khích khi:

- Code duplication rõ ràng.
- Module boundary sai.
- Coupling cao.
- Test khó.
- Performance problem.
- Naming gây hiểu nhầm.

Refactor không được làm thay đổi behavior ngoài scope task nếu không được xác định rõ.

Major architectural refactor phải được ghi nhận.

## 22. Dependency Management

Trước khi thêm dependency:

1. Kiểm tra existing dependency.
2. Kiểm tra native/platform capability.
3. Đánh giá maintenance.
4. Đánh giá security.
5. Đánh giá bundle/runtime cost.
6. Xác định ownership.

Không thêm nhiều thư viện giải quyết cùng một vấn đề.

## 23. Performance

Ưu tiên correctness trước optimization.

Khi optimize:

- Đo trước.
- Xác định bottleneck.
- Thay đổi nhỏ.
- Đo lại.

Các khu vực cần đặc biệt chú ý:

- Conversation queries
- Message timeline
- Realtime fan-out
- AI processing
- Queue throughput
- Database indexes
- External API calls

## 24. Security

Mọi request phải được xem là untrusted.

Luôn kiểm tra:

- Authentication
- Authorization
- Tenant
- Workspace
- Resource ownership
- Input validation

Không dựa vào frontend để bảo vệ dữ liệu.

## 25. Documentation

Cập nhật documentation khi:

- Public API thay đổi.
- Domain behavior thay đổi.
- Architecture thay đổi.
- New integration được thêm.
- Business rule mới được thêm.

Không cần document implementation details hiển nhiên.

## 26. Error Handling & Response Standards

1. **Sử dụng NestJS Built-in Exceptions**:
   - Sử dụng các exceptions chuẩn của `@nestjs/common` (`NotFoundException`, `BadRequestException`, `ForbiddenException`, `UnauthorizedException`, `ConflictException`, `UnprocessableEntityException`).
   - Không tạo thêm các custom error class trừu tượng (`AppError`, `DomainError`) gây over-engineering.
   - Khi cần truyền mã lỗi đặc thù (custom business error code):
     ```typescript
     throw new ConflictException({
       code: 'EMAIL_ALREADY_EXISTS',
       message: 'Email này đã được sử dụng',
       details: { email: 'test@example.com' },
     });
     ```
2. **Global Filter làm Adapter**:
   - `HttpExceptionFilter` chịu trách nhiệm duy nhất chuyển đổi mọi exception thành format chuẩn `ApiErrorResponse` (`{ success: false, error: { code, message, details } }`).
   - Tuyệt đối không bắt lỗi rồi tự `res.status(...).json(...)` thủ công trong Controller/Service.
3. **Response Envelope tự động**:
   - Controller và Service chỉ trả về pure domain data hoặc paginated object `{ items, meta }`.
   - `TransformInterceptor` tự động đóng gói envelope `{ success: true, data, meta }`.
4. **Validation Pipes**:
   - Sử dụng `@ZodBody(schema)`, `@ZodQuery(schema)`, `@ZodParam(schema)` để validate request payload.

