# Epic 1.9: Automation Rules & Outbound Webhooks

## 1. Overview

Hiện thực động cơ luật tự động hóa (Automation Rules Engine) với DSL trigger-condition-action, và hệ thống phát tán Outbound Webhooks kèm cơ chế retry Exponential Backoff qua BullMQ.

- **ID**: `EPIC-1.9`
- **Status**: 🟢 Done
- **Dependencies**: `EPIC-1.8` (Assignment & Operations)
- **References**:
  - `.docs/references/chatwoot/source/app/models/automation_rule.rb`
  - `.docs/references/chatwoot/source/app/models/webhook.rb`
  - `.docs/references/chatwoot/source/app/listeners/automation_rule_listener.rb`

---

## 2. Features Summary

| Feature | Tên | Complexity | Lý do |
| :--- | :--- | :---: | :--- |
| **F-1.9.1** | Automation Rules Management | 🟡 **Medium** | CRUD với nested JSON schema validation (conditions/actions DSL), Zod validation cho dynamic structure |
| **F-1.9.2** | Automation Rule Evaluator & Executor | 🔴 **High** | DSL evaluation engine, condition matching (6 operators), action execution pipeline (7 action types), error isolation, nhiều cross-module dependencies |
| **F-1.9.3** | Outbound Webhook Subscriptions | 🟢 **Low** | Simple CRUD + HMAC secret generation |
| **F-1.9.4** | Webhook Delivery & Retry Engine | 🟡 **Medium** | BullMQ job dispatch, HMAC signing, exponential backoff retry, WebhookDelivery logging, DLQ |

---

## 3. Feature Specifications

---

### 📦 Feature F-1.9.1: Automation Rules Management — 🟡 Medium

#### Objective

Cung cấp CRUD cho Automation Rules trong Workspace. Mỗi rule gồm 3 phần: trigger event, conditions (criteria), và actions (side effects).

#### Scope

- CRUD AutomationRule:
  - `name`: tên rule
  - `description`: mô tả
  - `isActive`: bật/tắt rule
  - `eventTrigger`: sự kiện kích hoạt (enum: `MESSAGE_CREATED`, `CONVERSATION_CREATED`, `CONVERSATION_STATUS_CHANGED`)
  - `conditions`: JSON array — danh sách điều kiện (attribute, operator, value)
    - Attributes: `status`, `inboxId`, `teamId`, `assigneeId`, `priority`, `content` (message), `senderType`
    - Operators: `EQUAL`, `NOT_EQUAL`, `CONTAINS`, `NOT_CONTAINS`, `IS_PRESENT`, `IS_NOT_PRESENT`
  - `actions`: JSON array — danh sách hành động thực thi
    - Action types: `ASSIGN_AGENT`, `ASSIGN_TEAM`, `ADD_LABEL`, `REMOVE_LABEL`, `SEND_WEBHOOK`, `CHANGE_STATUS`, `CHANGE_PRIORITY`
- Zod schemas validating nested JSON structure cho conditions/actions
- Ordering/priority: rules evaluated theo `createdAt` order

#### Acceptance Criteria

- [x] Rule tạo thành công với cấu trúc trigger-conditions-actions hợp lệ
- [x] Invalid conditions/actions schema bị reject (`422 Validation Failed` / `400 Bad Request`)
- [x] Rule `isActive = false` không được evaluate (hỗ trợ filter `isActive` và lưu trạng thái)
- [x] REST API endpoints:
  - `GET    /api/v1/automation-rules` — List rules
  - `POST   /api/v1/automation-rules` — Create rule
  - `GET    /api/v1/automation-rules/:id` — Detail
  - `PATCH  /api/v1/automation-rules/:id` — Update rule
  - `DELETE /api/v1/automation-rules/:id` — Delete rule
- [x] Guards: `JwtAuthGuard` + `WorkspaceGuard`; CUD yêu cầu `ADMIN` hoặc `OWNER`
- [x] Tenant isolation: mọi query include `workspaceId`

#### Dependencies

- `EPIC-1.1` (Identity)

---

### 📦 Feature F-1.9.2: Automation Rule Evaluator & Executor — 🔴 High

#### Objective

Xây dựng engine đánh giá automation rules khi có domain event trigger, kiểm tra conditions, và thực thi actions tương ứng.

#### Scope

- `AutomationEvaluator`:
  - Listen domain events: `message.created`, `conversation.created`, `conversation.status_updated`
  - Fetch active rules matching trigger event cho workspace
  - Evaluate conditions: `ConditionMatcher.match(entity, conditions[])` → boolean
  - Execute actions: `ActionExecutor.execute(entity, actions[])` → side effects
- `ConditionMatcher`:
  - Support operators: `EQUAL`, `NOT_EQUAL`, `CONTAINS`, `NOT_CONTAINS`, `IS_PRESENT`, `IS_NOT_PRESENT`
  - Access entity attributes (conversation status, inbox, team, message content, etc.)
- `ActionExecutor`:
  - `ASSIGN_AGENT` → gọi assignment service
  - `ASSIGN_TEAM` → gọi assignment service
  - `ADD_LABEL` → gọi label service
  - `REMOVE_LABEL` → gọi label service
  - `SEND_WEBHOOK` → dispatch webhook job
  - `CHANGE_STATUS` → gọi conversation service
  - `CHANGE_PRIORITY` → gọi conversation service
- Error isolation: failed action không ảnh hưởng rule khác
- Audit log ghi nhận rule execution

#### Acceptance Criteria

- [x] Rule với trigger `MESSAGE_CREATED` evaluate khi có message mới
- [x] Conditions đánh giá đúng: match → execute actions; no match → skip
- [x] Multiple rules cho cùng trigger → tất cả được evaluate
- [x] Failed action → log error, tiếp tục evaluate rules tiếp theo
- [x] Rule `isActive = false` → skip
- [x] Actions thực thi side effects đúng (assign, label, webhook, status)
- [x] Audit log ghi nhận rule triggered + actions executed

#### Dependencies

- `F-1.9.1` (Automation Rules Management)
- `F-1.7.1` (Domain Event Bus — event listeners)
- `EPIC-1.5` (Conversation Core — action targets)

---

### 📦 Feature F-1.9.3: Outbound Webhook Subscriptions — 🟢 Low

#### Objective

Cung cấp khả năng đăng ký nhận webhook outbound cho hệ thống bên thứ 3 khi có sự kiện trong Workspace.

#### Scope

- CRUD WebhookSubscription:
  - `url`: HTTPS endpoint URL
  - `events`: array of event types to subscribe (`message.created`, `conversation.status_updated`, etc.)
  - `isActive`: bật/tắt subscription
  - `secret`: HMAC-SHA256 signing secret (auto-generate hoặc user-provided)
- HMAC-SHA256 signing cho outbound payloads (header `X-Webhook-Signature`)
- Zod schemas & DTOs

#### Acceptance Criteria

- [x] Subscription tạo thành công với URL hợp lệ (HTTPS required)
- [x] Events array chỉ chấp nhận known event types
- [x] Secret tự động sinh nếu không provided
- [x] REST API endpoints:
  - `GET    /api/v1/webhook-subscriptions` — List
  - `POST   /api/v1/webhook-subscriptions` — Create
  - `PATCH  /api/v1/webhook-subscriptions/:id` — Update
  - `DELETE /api/v1/webhook-subscriptions/:id` — Delete
- [x] Guards: `JwtAuthGuard` + `WorkspaceGuard`; CUD yêu cầu `ADMIN` hoặc `OWNER`
- [x] Tenant isolation: mọi query include `workspaceId`

#### Dependencies

- `EPIC-1.1` (Identity)

---

### 📦 Feature F-1.9.4: Webhook Delivery & Retry Engine — 🟡 Medium

#### Objective

Xây dựng engine gửi webhook outbound qua BullMQ với cơ chế retry Exponential Backoff, và ghi nhận lịch sử gửi trong `WebhookDelivery`.

#### Scope

- `WebhookDispatcher`:
  - Listen domain events → lookup active subscriptions matching event
  - Create BullMQ job cho mỗi subscription × event
- BullMQ worker:
  - HTTP POST tới subscription URL
  - Payload: event type + data + timestamp
  - HMAC-SHA256 signature trong header `X-Webhook-Signature`
  - Timeout: 10 seconds
- `WebhookDelivery` logging:
  - Request payload, response status code, response body (truncated)
  - Delivery status: `PENDING`, `SUCCESS`, `FAILED`
  - Attempt count
- Retry strategy:
  - Max 3 attempts
  - Exponential backoff: 30s, 120s, 480s
  - Dead letter after max attempts

#### Acceptance Criteria

- [x] Domain event → BullMQ job created cho mỗi active subscription matching event
- [x] HTTP POST gửi đúng payload format
- [x] HMAC-SHA256 signature đúng (verifiable by subscriber)
- [x] Success (2xx response) → `WebhookDelivery` status `SUCCESS` / `DELIVERED`
- [x] Failure (non-2xx hoặc timeout) → retry với exponential backoff
- [x] After max attempts → `WebhookDelivery` status `FAILED`, no more retries
- [x] `WebhookDelivery` ghi nhận đầy đủ: request, response, attempts, timestamps
- [x] Failed webhook delivery không block event processing pipeline


#### Dependencies

- `F-1.9.3` (Outbound Webhook Subscriptions)
- `F-1.7.1` (Domain Event Bus)
- `EPIC-1.0` (Foundation — Redis/BullMQ)
