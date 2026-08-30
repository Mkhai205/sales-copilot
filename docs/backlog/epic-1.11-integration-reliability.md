# Epic 1.11: Integration & Reliability

## 1. Overview

Thiết lập bộ kiểm thử tích hợp Vertical Slice End-to-End kiểm chứng toàn bộ chu trình sống của tin nhắn từ Webhook Inbound đến Realtime UI, các endpoint kiểm tra sức khỏe hệ thống (Healthchecks), Structured JSON Telemetry Logging, và security hardening trước khi chuyển sang Phase 2.

- **ID**: `EPIC-1.11`
- **Status**: 🟡 Ready
- **Dependencies**: Hoàn thành toàn bộ `EPIC-1.0` đến `EPIC-1.10`
- **References**:
  - `docs/references/chatwoot/source/tests/playwright/`

---

## 2. Features Summary

| Feature | Tên | Complexity | Lý do |
| :--- | :--- | :---: | :--- |
| **F-1.11.1** | Vertical Slice E2E Tests | 🔴 **High** | 5 test scenarios end-to-end, Docker test environment, multi-module integration, WebSocket assertion, database seed/cleanup |
| **F-1.11.2** | Healthcheck Endpoints | 🟢 **Low** | Simple dependency checks (DB, Redis, MinIO), standard response format |
| **F-1.11.3** | Structured Logging & Telemetry | 🟡 **Medium** | Pino integration, request ID correlation, sensitive data redaction, per-environment config |
| **F-1.11.4** | Security Hardening | 🟡 **Medium** | Rate limiting, CORS, Helmet headers, input sanitization review, JWT policy verification |

---

## 3. Feature Specifications

---

### 📦 Feature F-1.11.1: Vertical Slice E2E Tests — 🔴 High

#### Objective

Xây dựng bộ E2E tests kiểm chứng toàn bộ luồng nghiệp vụ chính từ đầu đến cuối, bao gồm tất cả các module tương tác với nhau.

#### Scope

- **Test Scenario 1 — Inbound Message Flow**:
  Webhook inbound → ChannelEvent dedup → Contact Resolution → Conversation creation → Message storage → WebSocket broadcast
- **Test Scenario 2 — Agent Reply Flow**:
  Agent gửi message → Message storage → Delivery status → Outbound channel send → WebSocket broadcast
- **Test Scenario 3 — Auto-Assignment Flow**:
  Conversation created → Auto-assignment evaluate → Agent assigned → WebSocket notification
- **Test Scenario 4 — Automation Rule Flow**:
  Message created → Automation rule evaluate → Conditions match → Actions execute (assign, label, webhook)
- **Test Scenario 5 — Contact Merge Flow**:
  Merge contacts → Transfer identities, conversations, messages → Audit log → WebSocket broadcast
- Test infrastructure: Docker Compose test environment, database seeding, cleanup

#### Acceptance Criteria

- [ ] Tất cả 5 test scenarios pass end-to-end
- [ ] Tests chạy trong isolated Docker environment
- [ ] Database được seed và cleanup sau mỗi test run
- [ ] WebSocket events được verify trong test assertions
- [ ] Tests có thể chạy trong CI pipeline

#### Dependencies

- Tất cả Epic 1.0–1.9

---

### 📦 Feature F-1.11.2: Healthcheck Endpoints — 🟢 Low

#### Objective

Cung cấp endpoint kiểm tra sức khỏe hệ thống cho monitoring và Kubernetes probes.

#### Scope

- `GET /health` — comprehensive health check:
  - PostgreSQL connectivity
  - Redis connectivity
  - MinIO connectivity
  - BullMQ queue status
- `GET /health/ready` — readiness probe (database migrations applied, services initialized)
- `GET /health/live` — liveness probe (process alive, not deadlocked)
- Response format: `{ status: 'ok' | 'degraded' | 'down', checks: { ... } }`

#### Acceptance Criteria

- [ ] `/health` trả về status và chi tiết từng dependency
- [ ] Database down → status `degraded` hoặc `down`
- [ ] Redis down → status `degraded`
- [ ] Kubernetes readiness/liveness probes hoạt động đúng
- [ ] Endpoints không yêu cầu authentication (public)

#### Dependencies

- `EPIC-1.0` (Foundation — database, Redis, MinIO)

---

### 📦 Feature F-1.11.3: Structured Logging & Telemetry — 🟡 Medium

#### Objective

Cấu hình structured JSON logging với Pino cho toàn bộ application, hỗ trợ request correlation và performance metrics.

#### Scope

- Pino logger integration với NestJS
- Structured JSON log format: timestamp, level, message, context, requestId, workspaceId
- Request correlation: `X-Request-Id` header → propagate through entire request lifecycle
- Performance logging: request duration, database query count
- Log levels configuration per environment (development: debug, production: info)
- Sensitive data redaction (passwords, tokens, credentials)

#### Acceptance Criteria

- [ ] Logs output structured JSON format
- [ ] Request ID correlation end-to-end (HTTP request → service → database)
- [ ] Sensitive data (passwords, tokens) NEVER appear in logs
- [ ] Log levels configurable via environment variable
- [ ] Request duration logged cho mỗi API call
- [ ] WorkspaceId included trong log context khi available

#### Dependencies

- `EPIC-1.0` (Foundation)

---

### 📦 Feature F-1.11.4: Security Hardening — 🟡 Medium

#### Objective

Áp dụng các biện pháp bảo mật cuối cùng trước production deployment.

#### Scope

- Rate limiting: `ThrottlerGuard` cho API endpoints (configurable per-route)
- CORS configuration: whitelist allowed origins
- Helmet security headers: X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, etc.
- Input sanitization review: ensure no XSS/injection vectors
- JWT token expiration review: access token 15m, refresh token 7d
- API documentation: Swagger/OpenAPI spec generation (optional)

#### Acceptance Criteria

- [ ] Rate limiting active: quá nhiều requests → `429 Too Many Requests`
- [ ] CORS chỉ cho phép whitelisted origins
- [ ] Security headers present trên tất cả responses
- [ ] No XSS vectors trong user-supplied content (sanitize HTML in message content)
- [ ] JWT expiration configured theo policy
- [ ] NFR-4 compliance verified

#### Dependencies

- `EPIC-1.0` (Foundation)
