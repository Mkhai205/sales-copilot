# Phase 8 — Error Handling, Logging & Observability Audit Report

> **Document Status**: COMPLETED AUDIT REPORT  
> **Auditor**: Senior Backend Architect & Independent Code Reviewer  
> **Audit Phase**: Phase 8 — Error Handling, Structured Logging, Correlation Tracing & Observability  
> **Target Scope**: Exception Handling (`HttpExceptionFilter`), Request Tracing (`RequestIdMiddleware`), Logging Pipeline (`LoggingInterceptor`), Health Checks (`AppController`, `AppService`), Audit Logging Coverage (`AuditLogService`), Distributed Trace Propagation  
> **Execution Date**: August 27, 2026

---

## 1. Executive Summary & Observability Verdict

An architectural and operational audit was executed across the error handling, logging, distributed tracing, health checks, and audit trail subsystems of the Sales Copilot backend.

```text
                    OBSERVABILITY HEALTH SCORECARD
                                    │
       ┌────────────────────────────┼────────────────────────────┐
       ▼                            ▼                            ▼
  LOGGING HYGIENE & CONTEXT     DISTRIBUTED TRACING          AUDIT LOG TRAIL
  • 100% NestJS Logger (0 console) • X-Request-Id Middleware    • Non-blocking via Events
  • Timing & Prefix Standardized• 🔴 Tracing Lost in BullMQ  • 🔴 Member/Webhook Events Missing
  • No Body/Password Dumps      • 🔴 Health Check 200 on Down• Audit Invariant Gaps
```

### Key Strengths:
1. **Flawless Logging Hygiene**: Zero raw `console.log` or `console.error` statements across the entire backend codebase (`apps/server/src`). Every component instantiates and uses NestJS `Logger` with appropriate contextual tags (`new Logger(ClassName.name)`).
2. **Safe Logging (Zero Credential Dumps)**: `LoggingInterceptor` logs request metadata (`method`, `url`, `status`, `durationMs`, `ip`, `userAgent`, `requestId`) without dumping request or response bodies, avoiding sensitive token/password leakage to log aggregators.
3. **Structured Request Identification**: `RequestIdMiddleware` extracts or generates an `X-Request-Id` (UUID v4) on every HTTP request and attaches it to both request headers and the HTTP response header.
4. **Comprehensive Dependency Pings in Health Check**: `AppService.getHealth()` actively verifies connectivity across all three core dependencies: PostgreSQL (`prisma.ping()`), Redis (`redis.ping()`), and MinIO S3 (`storage.ping()`).

### Observability & Traceability Deficiencies Identified:
1. **Critical Security Operations Omitted from Audit Trail (`FINDING-P8-01`)**: `AuditLogService` listens to minor resource events (labels, canned responses, automation rules) but completely fails to audit high-privilege operations: adding workspace members, changing member roles, removing members, or creating outbound webhook subscriptions.
2. **Trace Context Disconnected Between HTTP and BullMQ Jobs (`FINDING-P8-02`)**: `X-Request-Id` is not forwarded when enqueuing BullMQ jobs (`channel-ingestion`, `webhook-delivery`). Ingestion workers log with unlinked job IDs, breaking distributed trace correlation.
3. **Health Check Endpoint Returns HTTP 200 When Dependencies Are Down (`FINDING-P8-03`)**: When PostgreSQL or Redis is offline, `GET /api/v1/health` returns `{ status: 'degraded' }` with **HTTP status 200 OK**. Kubernetes readiness probes will continue routing traffic to a dead container.
4. **Missing Production Metrics & OpenTelemetry Instrumentation (`FINDING-P8-04`)**: No Prometheus metrics (`/metrics`) or OpenTelemetry traces are instrumented for queue latency, WebSocket socket counts, or database query timings.

---

## 2. Audit Trail Event Coverage Matrix

| Resource / Event | Triggering Controller / Service | Audited by AuditLogService? | Severity / Gap |
| :--- | :--- | :---: | :--- |
| **Contact Merged** | `ContactMergeService.merge` | ✅ **Audited** (`CONTACT_MERGED`) | Working as expected. |
| **Channel Created / Deleted** | `InboxesService.createInbox / deleteInbox` | ✅ **Audited** (`CHANNEL_CREATED`, `CHANNEL_DELETED`) | Working as expected. |
| **Label Created / Deleted** | `LabelsService.create / delete` | ✅ **Audited** (`LABEL_CREATED`, `LABEL_DELETED`) | Working as expected. |
| **Canned Response Created / Deleted**| `CannedResponsesService.create / delete` | ✅ **Audited** (`CANNED_RESPONSE_CREATED`, `...DELETED`) | Working as expected. |
| **Automation Rule Lifecycle** | `AutomationRulesService.create / update / delete` | ✅ **Audited** (`AUTOMATION_RULE_CREATED`, `...`) | Working as expected. |
| **Workspace Member Added** | `WorkspaceMembersController.addMember` | 🔴 **NOT AUDITED** | **Critical Security Gap** (`FINDING-P8-01`). |
| **Workspace Member Role Changed**| `WorkspaceMembersController.updateMemberRole` | 🔴 **NOT AUDITED** | **Critical Security Gap** (`FINDING-P8-01`). |
| **Workspace Member Removed** | `WorkspaceMembersController.removeMember` | 🔴 **NOT AUDITED** | **Critical Security Gap** (`FINDING-P8-01`). |
| **Webhook Subscription Created** | `WebhookSubscriptionsController.create` | 🔴 **NOT AUDITED** | **High Security Gap** (Data Exfiltration risk). |
| **Conversation Status / Assignee** | `ConversationsService.updateStatus / assign` | 🔴 **NOT AUDITED** | Untracked ticket lifecycle changes. |

---

## 3. Detailed Error Handling & Observability Findings

### [FINDING-P8-01] Critical Security Operations Omitted from Audit Trail

- **Severity**: **HIGH**
- **Category**: Security Governance & Audit Trail
- **Location**: `apps/server/src/modules/audit-logs/audit-logs.service.ts:140-340`, `apps/server/src/modules/workspaces/workspace-members.controller.ts:55-120`, `apps/server/src/modules/webhooks/webhook-subscriptions.controller.ts:60-120`
- **Requirement Reference**: `F-1.10.1`, `NFR-4`

#### 1. Evidence
In `apps/server/src/modules/audit-logs/audit-logs.service.ts`:
Event listeners exist for:
- `contact.merged`
- `channel.created`, `channel.deleted`
- `label.created`, `label.deleted`
- `canned_response.created`, `canned_response.deleted`
- `automation_rule.created`, `automation_rule.updated`, `automation_rule.deleted`

Listeners **DO NOT EXIST** for:
- `member.added`
- `member.role_updated`
- `member.removed`
- `webhook_subscription.created`
- `webhook_subscription.deleted`

#### 2. Problem Description
The `audit_logs` table and API (`GET /api/v1/audit-logs`) are designed for administrative compliance and security governance.
Currently, low-impact actions like creating a color label or creating a canned response shortcut are audited. However, the most sensitive operations in the platform:
1. Adding a new user to a workspace.
2. Promoting a member to `ADMIN` or demoting an `ADMIN`.
3. Removing an agent or administrator from a workspace.
4. Registering an outbound webhook endpoint (which receives customer conversation payloads).

are **completely absent from the audit trail**.

#### 3. Impact Analysis
If an administrative account is compromised or a rogue administrator adds an unauthorized member or registers an exfiltration webhook endpoint, there is zero record of the action in the organization's audit log.

#### 4. Expected Behavior
All member management and webhook subscription mutations must emit domain events and be persisted in `audit_logs` with actor ID, target ID, and change details.

#### 5. Recommended Fix
In `WorkspacesService` and `WebhookSubscriptionsService`, emit `member.added`, `member.role_updated`, `member.removed`, `webhook.created`, and add corresponding listeners in `AuditLogService`.

#### 6. Verification Method
Add a member and change their role; verify that two new audit log records appear in `GET /api/v1/audit-logs`.

---

### [FINDING-P8-02] Distributed Trace Context Broken Between HTTP and Background Jobs

- **Severity**: **MEDIUM**
- **Category**: Observability & Distributed Tracing
- **Location**: `apps/server/src/modules/webhooks/webhooks.service.ts:227-244`, `apps/server/src/infrastructure/queue/channel-ingestion.processor.ts:87-95`
- **Requirement Reference**: `NFR-2` (Reliability & Debuggability)

#### 1. Evidence
In `apps/server/src/modules/webhooks/webhooks.service.ts`:
```typescript
await this.ingestionQueue.add(
  'process-channel-event',
  {
    channelId,
    channelEventId: channelEvent.id,
    eventType: channelEvent.eventType,
    payload: rawBody,
    // ❌ requestId is NOT passed in the job data!
  },
  // ...
);
```
In `apps/server/src/infrastructure/queue/channel-ingestion.processor.ts`:
```typescript
async process(job: Job<ChannelIngestionJobData, void, string>): Promise<void> {
  const { channelId, channelEventId, eventType, payload } = job.data;
  // ❌ Logs without correlation requestId:
  this.logger.log(
    `Received ingestion job ${job.id} for channel '${channelId}' (event: '${eventType}', eventId: '${channelEventId}')`,
  );
}
```

#### 2. Problem Description
`RequestIdMiddleware` generates a unique `X-Request-Id` for every incoming HTTP webhook call. The HTTP controller and `LoggingInterceptor` log with this prefix:
`[3f7b2c9a-...] POST /api/v1/channels/:id/webhook - 200 - 12ms`.
However, when the webhook service hands off the event to BullMQ, the `requestId` is omitted from the job payload.
The background worker executes asynchronously with no correlation to the original HTTP request ID.

#### 3. Impact Analysis
In high-throughput environments, tracking an asynchronous failure (e.g. why a specific webhook payload failed ingestion) requires manually cross-referencing timestamps rather than querying a single correlation ID across log aggregators.

#### 4. Expected Behavior
Include `requestId` in job payload metadata:
```typescript
interface ChannelIngestionJobData {
  // ...
  requestId?: string;
}
```
And prefix worker logs with `[${job.data.requestId}]`.

#### 5. Recommended Fix
Capture `req.headers['x-request-id']` in `WebhooksController` and forward it into `ChannelIngestionJobData` and `WebhookDeliveryJobData`.

#### 6. Verification Method
Send an inbound webhook with `X-Request-Id: test-trace-123` and verify that the background worker log output contains `[test-trace-123]`.

---

### [FINDING-P8-03] Health Check Endpoint Returns HTTP 200 When Dependencies Are Down

- **Severity**: **MEDIUM**
- **Category**: High Availability & Container Orchestration
- **Location**: `apps/server/src/app.controller.ts:10-16`, `apps/server/src/app.service.ts:48-62`
- **Requirement Reference**: Kubernetes Readiness / Liveness Standards, `NFR-3`

#### 1. Evidence
In `apps/server/src/app.controller.ts`:
```typescript
@Get()
@ApiOperation({ summary: 'Check API service health status' })
@ApiResponse({ status: 200, description: 'Service is healthy' })
getHealth() {
  // ❌ Always returns HTTP 200 OK regardless of isHealthy value!
  return this.appService.getHealth();
}
```
In `apps/server/src/app.service.ts`:
```typescript
const isHealthy = database.status === 'up' && redis.status === 'up' && storage.status === 'up';

return {
  status: isHealthy ? 'ok' : 'degraded',
  // ...
};
```

#### 2. Problem Description
When PostgreSQL, Redis, or MinIO S3 is completely down:
- `AppService.getHealth()` sets `status: 'degraded'`.
- But `AppController.getHealth()` does not set the HTTP response status code to `503 Service Unavailable`. It returns **HTTP 200 OK**.
- Kubernetes container readiness probes and AWS Target Group health checks evaluate HTTP status codes. Because the response is HTTP 200, orchestrators consider the pod ready and continue routing customer requests to an instance that cannot reach its database.

#### 3. Impact Analysis
Pods with broken database connections remain in load balancer pools, causing customer requests to fail with 500 errors instead of being routed to healthy replicas.

#### 4. Expected Behavior
If any critical dependency (`database` or `redis`) is `down`, the endpoint must return **HTTP 503 Service Unavailable**.

#### 5. Recommended Fix
In `AppController.getHealth`:
```typescript
@Get()
async getHealth(@Res({ passthrough: true }) res: Response) {
  const health = await this.appService.getHealth();
  if (health.status !== 'ok') {
    res.status(HttpStatus.SERVICE_UNAVAILABLE);
  }
  return health;
}
```

#### 6. Verification Method
Stop Redis, query `GET /health`, and verify that the HTTP status code is `503 Service Unavailable`.

---

### [FINDING-P8-04] Missing Metrics & APM Instrumentation

- **Severity**: **LOW**
- **Category**: Observability & Metrics
- **Location**: `apps/server/src/main.ts`, `apps/server/src/app.module.ts`
- **Requirement Reference**: `docs/04-system-architecture.md`

#### 1. Evidence
- No Prometheus metrics exporter (`prom-client` or `@willsoto/nestjs-prometheus`) is installed or configured.
- No `/metrics` endpoint is exposed.
- No OpenTelemetry instrumentation is configured for distributed tracing across NestJS, Prisma, and Redis.

#### 2. Problem Description
The platform relies entirely on text logging. Key operational telemetry metrics:
- Queue depth and worker latency (`bullmq`).
- Active WebSocket connection counts (`/realtime` vs `/widget`).
- Prisma connection pool saturation and query execution histograms.
- Redis lock acquisition failures.

cannot be graphed on Prometheus/Grafana dashboards or alerted upon via Prometheus Alertmanager.

#### 3. Impact Analysis
Operations teams lack visibility into real-time capacity and saturation until services crash or suffer user-facing degradation.

#### 4. Expected Behavior
Install `@willsoto/nestjs-prometheus` and expose standard Node.js and BullMQ metrics on an internal `/metrics` endpoint.

#### 5. Recommended Fix
Configure Prometheus metrics module in `apps/server/src/infrastructure/metrics`.

#### 6. Verification Method
Query `GET /metrics` and verify standard Prometheus text metrics format.

---

## 4. Phase 8 Observability Sign-Off Assessment

| Dimension | Standard | Audit Result | Status |
| :--- | :--- | :--- | :---: |
| **Logger Hygiene** | 100% NestJS Logger with context | 0 console.log, fully standardized. | ✅ **Pass** |
| **Sensitive Data Redaction** | No passwords/tokens in standard logs | Request bodies excluded from logs. | ✅ **Pass** |
| **Request Correlation** | Unique X-Request-Id per request | Middleware generates & attaches header. | ✅ **Pass** |
| **Distributed Tracing** | Trace ID propagated to background jobs | Lost when enqueuing in BullMQ (`FINDING-P8-02`). | 🟡 **Needs Hardening** |
| **Audit Log Coverage** | All administrative actions tracked | Member & Webhook operations omitted (`FINDING-P8-01`). | 🔴 **Critical Action Required** |
| **Health Check Semantics** | HTTP 503 on dependency failure | Returns HTTP 200 when degraded (`FINDING-P8-03`). | 🟡 **Needs Hardening** |
| **Metrics & Telemetry** | Prometheus / OpenTelemetry support | Missing Prometheus instrumentation (`FINDING-P8-04`). | 🟡 **Needs Hardening** |

### Summary Recommendation for Phase 8:
Logging hygiene is exemplary (zero console calls, clean timing formatting).

The **critical gap** in this phase is the **audit log coverage deficit**: administrative member changes and webhook configurations are not recorded in `audit_logs`. This must be addressed alongside the health check status fix in **Phase 10 (Hardening Sprint)**.
