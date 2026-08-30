# Engineering Testing Strategy

## 1. Purpose

Testing phải bảo vệ:

- Business rules
- Module boundaries
- Data consistency
- API contracts
- External integrations
- AI behavior
- Autonomous actions
- Tenant isolation

Không chạy theo coverage percentage một cách máy móc.

Ưu tiên test những behavior có business impact cao.

## 2. Testing Pyramid

```text
             E2E
          /       \
      Integration
       /          \
   Application / Contract
      /              \
          Unit
```

Phần lớn business logic nên được test ở unit/application level.

Critical flows cần integration/E2E coverage.

## 3. Unit Tests

Unit tests tập trung vào deterministic business logic.

Ưu tiên test:

- Lead lifecycle
- Lead score rules
- Qualification rules
- Conversation state transitions
- Assignment rules
- Authorization rules
- Domain invariants
- Value objects
- Event generation

Ví dụ:

```text
NEW → ENGAGED       valid
ENGAGED → QUALIFIED valid
QUALIFIED → HOT     valid
HOT → CONVERTED     valid

NEW → CONVERTED     invalid
```

## 4. Application Tests

Application tests kiểm tra use-case behavior.

Ví dụ:

```text
CreateLead
AssignConversation
ReceiveMessage
SendMessage
AnalyzeConversation
UpdateLeadScore
GenerateReply
ExecuteAgentAction
```

Test:

- Input
- Authorization
- Domain interaction
- Repository interaction
- Event publishing
- Error behavior

## 5. Integration Tests

Integration tests dùng real infrastructure hoặc test infrastructure phù hợp.

Ưu tiên:

- PostgreSQL
- Redis
- Queue
- MinIO
- Webhook handling
- Persistence
- Transactions
- Repository behavior

Các integration quan trọng không nên chỉ mock toàn bộ infrastructure.

## 6. API Tests

Test:

- Request validation
- Authentication
- Authorization
- Tenant isolation
- Workspace isolation
- Response contract
- Error format
- Pagination
- Filtering
- Idempotency

Critical API phải có regression tests.

## 7. WebSocket Tests

Test:

- Authentication
- Workspace access
- Subscription authorization
- Event delivery
- Event payload
- Multiple connected users
- Reconnect behavior
- Duplicate events
- Unauthorized access

Realtime data phải được kiểm tra tenant/workspace isolation.

## 8. Channel Integration Tests

Mỗi channel adapter phải có contract tests.

Channels:

- Facebook Messenger
- Zalo
- Telegram
- Email

Test:

```text
External payload
→ Adapter
→ Normalized event
```

và:

```text
Application message
→ Adapter
→ External provider request
```

Provider API không được làm thay đổi core domain contract.

## 9. Webhook Tests

Webhook tests phải kiểm tra:

- Signature verification
- Payload validation
- Duplicate webhook
- Unknown event
- Malformed payload
- Retry
- Idempotency
- Correct tenant/workspace mapping

Webhook processing không được tạo duplicate message.

## 10. AI Tests

AI testing chia thành:

### Deterministic Tests

Test:

- Schema validation
- Tool validation
- Policy
- Authorization
- Score boundaries
- State transitions
- Fallback handling

### Model Evaluation

Đánh giá:

- Intent accuracy
- Sentiment quality
- Lead qualification
- Lead scoring consistency
- Reply quality
- Next-best-action quality
- Hallucination rate

AI evaluation không nên phụ thuộc hoàn toàn vào exact string matching.

## 11. AI Regression Tests

Duy trì một dataset đại diện cho các conversation scenarios.

Mỗi scenario có:

- Input conversation
- Expected intent
- Expected qualification
- Expected score range
- Expected action constraints

Ví dụ:

```text
Scenario:
Customer asks price and confirms budget.

Expected:
Intent = purchase
Qualification = qualified
Lead score = high range
Recommended action = provide pricing / continue qualification
```

AI model/provider thay đổi phải chạy regression evaluation.

## 12. Autonomous Agent Tests

Autonomous actions cần test mạnh hơn recommendation-only behavior.

Test:

```text
AI decision
→ Tool selection
→ Policy
→ Authorization
→ Execution
→ Audit event
```

Cases bắt buộc:

- Allowed action
- Denied action
- Invalid arguments
- Unauthorized workspace
- Low confidence
- Tool failure
- External provider failure
- Retry
- Duplicate execution

## 13. Security Tests

Kiểm tra:

- Cross-organization access
- Cross-workspace access
- Unauthorized conversation access
- Unauthorized lead access
- RBAC violations
- Webhook spoofing
- Invalid tokens
- File access violations

Tenant isolation là critical security requirement.

## 14. Database Tests

Test:

- Constraints
- Unique indexes
- Foreign keys
- Tenant scoping
- Workspace scoping
- Transactions
- Concurrent updates khi cần
- Migration correctness

Critical invariants nên được enforce ở database nếu phù hợp.

## 15. Regression Testing

Mỗi bug production có business impact phải có regression test nếu có thể.

Regression tests phải ưu tiên:

- Message duplication
- Conversation state corruption
- Lead score corruption
- Tenant data leakage
- Unauthorized action
- AI autonomous action errors

## 16. Test Data

Test data nên:

- Deterministic
- Minimal
- Reusable
- Representative

Không sử dụng production customer data trong test.

AI evaluation data phải được anonymize.

## 17. Mocking Rules

Mock external systems khi unit testing.

Không mock domain logic.

Không mock mọi thứ trong integration tests.

Mock nên nằm ở architectural boundary.

Ví dụ:

```text
Application
→ LLM interface
→ Mock provider
```

thay vì mock mọi internal class.

## 18. Test Naming

Test name phải mô tả behavior.

Tốt:

```text
should reject invalid lead transition from NEW to CONVERTED
```

Không tốt:

```text
test lead service
```

## 19. Definition of Test Completion

Task được xem là test-complete khi:

- Relevant unit tests pass.
- Relevant application tests pass.
- Integration tests được cập nhật nếu infrastructure behavior thay đổi.
- API/contract tests được cập nhật nếu contract thay đổi.
- Regression test được thêm cho bug.
- Critical security behavior được kiểm tra.

## 20. Testing Priority

Priority:

1. Security
2. Domain invariants
3. Data consistency
4. Autonomous actions
5. Critical user flows
6. External integrations
7. General UI behavior
8. Non-critical edge cases

Không hy sinh critical correctness để đạt coverage percentage.
