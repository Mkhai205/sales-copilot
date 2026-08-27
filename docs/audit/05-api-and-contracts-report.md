# Phase 5 — API, REST Contracts & Validation Audit Report

> **Document Status**: COMPLETED AUDIT REPORT  
> **Auditor**: Senior Backend Architect & Independent Code Reviewer  
> **Audit Phase**: Phase 5 — API Surface, Shared Contracts, Serialization & Validation  
> **Target Scope**: Shared Contracts (`packages/shared-contracts/`), REST Controllers, Zod Pipes (`ZodSchemaValidationPipe`), Response Envelopes (`TransformInterceptor`), Exception Handling (`HttpExceptionFilter`), Swagger OpenAPI (`apps/server/src/modules/`, `apps/server/src/common/`)  
> **Execution Date**: August 27, 2026

---

## 1. Executive Summary & API Surface Verdict

A systematic audit was conducted on the entire REST API surface of the Sales Copilot platform, evaluating alignment between backend controllers, `@sales-copilot/shared-contracts`, input validation pipelines, response serialization transformers, and OpenAPI specifications.

```text
                     API & CONTRACTS HEALTH SCORECARD
                                    │
       ┌────────────────────────────┼────────────────────────────┐
       ▼                            ▼                            ▼
  SERIALIZATION & ENVELOPE      VALIDATION & PIPES           CONTRACT ALIGNMENT
  • Uniform Success Envelope    • Zod Pipes Working Clean    • 🔴 ZodError Crash in Messages
  • ISO 8601 Dates Guaranteed   • 🔴 WebChat Bypasses Zod    • 🔴 WebChat Contract Missing
  • Pagination Metadata Unified • 🔴 Raw Error Leak in 500   • Orphaned User Schemas
```

### Key API Strengths:
1. **Unified API Success Envelope (`TransformInterceptor`)**: Every successful HTTP response is automatically wrapped into `{ success: true, data: T, meta?: PaginationMeta }`. Paginated controller endpoints returning `{ items, meta }` are seamlessly transformed to standard format.
2. **Clean Date Serialization**: All mappers (`mapConversationToDto`, `mapMessageToDto`, `mapContactToDto`) explicitly verify and serialize Date objects using `.toISOString()`, ensuring predictable, standardized ISO 8601 timestamps for frontend consumers.
3. **Structured Validation Pipe (`ZodSchemaValidationPipe`)**: Custom parameter decorators (`@ZodBody`, `@ZodQuery`, `@ZodParam`) cleanly extract Zod validation issues into structured error arrays: `{ field, message }`.
4. **Standardized HTTP Semantics**: Read operations return `200 OK`, creation returns `201 Created` (or `200 OK` for idempotent lookups), deletion uniformly returns `200 OK` with confirmation payloads.

### API & Contract Gaps Identified:
1. **Unhandled `ZodError` Returns HTTP 500 in MessagesController (`FINDING-P5-01`)**: Calling `createMessageSchema.parse()` and `updateDeliveryStatusSchema.parse()` manually inside `MessagesController` throws a raw `ZodError` on invalid input. `HttpExceptionFilter` does not recognize `ZodError`, falling back to `HTTP 500 Internal Server Error` instead of `400 Bad Request`.
2. **Web Chat Widget Endpoints Completely Bypass Shared Contracts (`FINDING-P5-02`)**: All Web Chat visitor endpoints (`/api/v1/widget/*`) define ad-hoc interfaces in the controller file. `@sales-copilot/shared-contracts` contains zero schemas or DTOs for Web Chat, and no Zod input validation is enforced on visitor requests.
3. **Information Disclosure in Production Exception Filter (`FINDING-P5-03`)**: `HttpExceptionFilter` directly returns `exception.message` for generic runtime errors without checking `NODE_ENV`, leaking raw database error messages and stack details to public consumers.
4. **Orphaned Contracts in `shared-contracts/users` (`FINDING-P5-04`)**: `updateUserProfileSchema` and `UserProfileDto` are exported by `@sales-copilot/shared-contracts` but have no corresponding implementation in `apps/server`.
5. **Swagger Documentation Inconsistencies (`FINDING-P5-05`)**: Missing Swagger response schemas on WebChat endpoints and route parameter inconsistencies on `PresenceController`.

---

## 2. API Response & Error Envelope Standardization

### 2.1. Success Envelope (`TransformInterceptor`)

The backend achieves 100% uniformity in successful API responses:
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "hasMore": true
  }
}
```

### 2.2. Standard Error Envelope (`HttpExceptionFilter`)

Standard HTTP errors thrown via NestJS exceptions (`BadRequestException`, `NotFoundException`, etc.) format properly as:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email address"
      }
    ]
  }
}
```

---

## 3. Shared Contracts Coverage Matrix

| Bounded Context | Shared Contract Path | Zod Schema Coverage | Backend Controller | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Auth** | `packages/shared-contracts/src/auth/` | `loginSchema`<br>`refreshTokenSchema`<br>`logoutSchema` | `AuthController` | ✅ **Fully Aligned** |
| **Workspaces** | `packages/shared-contracts/src/workspaces/` | `createWorkspaceSchema`<br>`updateWorkspaceSchema`<br>`addMemberSchema`<br>`updateMemberRoleSchema` | `WorkspacesController`<br>`WorkspaceMembersController` | ✅ **Fully Aligned** |
| **Teams** | `packages/shared-contracts/src/teams/` | `createTeamSchema`<br>`updateTeamSchema`<br>`addTeamMemberSchema` | `TeamsController` | ✅ **Fully Aligned** |
| **Inboxes** | `packages/shared-contracts/src/inboxes/` | `createInboxSchema`<br>`updateInboxSchema`<br>`addInboxMemberSchema` | `InboxesController`<br>`InboxMembersController` | ✅ **Fully Aligned** |
| **Contacts** | `packages/shared-contracts/src/contacts/` | `createContactSchema`<br>`updateContactSchema`<br>`mergeContactsSchema`<br>`contactListQuerySchema` | `ContactsController` | ✅ **Fully Aligned** |
| **Conversations** | `packages/shared-contracts/src/conversations/` | `createConversationSchema`<br>`updateStatusSchema`<br>`assignSchema`<br>`updatePrioritySchema`<br>`assignLabelsSchema`<br>`conversationListQuerySchema` | `ConversationsController` | ✅ **Fully Aligned** |
| **Messages** | `packages/shared-contracts/src/messages/` | `createMessageSchema`<br>`updateDeliveryStatusSchema`<br>`messageListQuerySchema` | `MessagesController` | ⚠️ **Manual Parse Bug** (`FINDING-P5-01`) |
| **Labels** | `packages/shared-contracts/src/labels/` | `createLabelSchema`<br>`updateLabelSchema`<br>`labelListQuerySchema` | `LabelsController` | ✅ **Fully Aligned** |
| **Canned Responses** | `packages/shared-contracts/src/canned-responses/` | `createCannedResponseSchema`<br>`updateCannedResponseSchema` | `CannedResponsesController` | ✅ **Fully Aligned** |
| **Automation Rules** | `packages/shared-contracts/src/automation-rules/` | `createAutomationRuleSchema`<br>`updateAutomationRuleSchema` | `AutomationRulesController` | ✅ **Fully Aligned** |
| **Webhooks** | `packages/shared-contracts/src/webhooks/` | `createWebhookSubscriptionSchema`<br>`updateWebhookSubscriptionSchema` | `WebhookSubscriptionsController` | ✅ **Fully Aligned** |
| **Audit Logs** | `packages/shared-contracts/src/audit-logs/` | `auditLogListQuerySchema` | `AuditLogsController` | ✅ **Fully Aligned** |
| **Users** | `packages/shared-contracts/src/users/` | `updateUserProfileSchema` | None (`apps/server/src/modules/users` is empty) | 🔴 **Orphan Contract** (`FINDING-P5-04`) |
| **Web Chat Widget** | None | None | `WebChatController` (`/widget/*`) | 🔴 **Missing Contracts** (`FINDING-P5-02`) |

---

## 4. Detailed API & Contracts Findings

### [FINDING-P5-01] Unhandled ZodError in MessagesController Returns HTTP 500 Instead of 400

- **Severity**: **HIGH**
- **Category**: API Error Handling & Status Codes
- **Location**: `apps/server/src/modules/messages/messages.controller.ts:120, 155`, `apps/server/src/common/filters/http-exception.filter.ts:31-58`
- **Requirement Reference**: `AGENTS.md` Section 6 ("Error Handling & Response Standards")

#### 1. Evidence
In `apps/server/src/modules/messages/messages.controller.ts`:
```typescript
@Post('conversations/:conversationId/messages')
async create(
  @CurrentWorkspace() context: WorkspaceContext,
  @CurrentUser() user: JwtUserPayload,
  @Param('conversationId') conversationId: string,
  @Body() body: any,
  @UploadedFiles() files?: UploadedFile[],
): Promise<MessageResponseDto> {
  // ...
  // ❌ Manual call to schema.parse() throws raw ZodError outside of NestJS pipeline:
  const validatedDto: CreateMessageDto = createMessageSchema.parse(payload);
  return this.messagesService.create(context.workspaceId, conversationId, validatedDto, files);
}

@Patch('messages/:id/delivery-status')
async updateDeliveryStatus(@Body() body: any): Promise<MessageResponseDto> {
  // ❌ Manual call to schema.parse():
  const validatedDto: UpdateDeliveryStatusDto = updateDeliveryStatusSchema.parse(body);
  return this.messagesService.updateDeliveryStatus(id, validatedDto);
}
```

In `apps/server/src/common/filters/http-exception.filter.ts`:
```typescript
if (exception instanceof HttpException) {
  statusCode = exception.getStatus();
  code = this.deriveErrorCode(exception);
  // ...
} else if (exception instanceof Error) {
  // ❌ ZodError inherits from Error, NOT HttpException!
  // statusCode defaults to HttpStatus.INTERNAL_SERVER_ERROR (500)
  message = exception.message || 'Internal server error';
}
```

#### 2. Problem Description
In all other controllers, incoming request bodies are validated using `@ZodBody(schema)`, which transforms Zod validation failures into `BadRequestException({ code: 'VALIDATION_FAILED', errors })`.
In `MessagesController`, the author manually invoked `createMessageSchema.parse(payload)`. When a client passes invalid input (e.g. empty content without attachments, invalid message type), `schema.parse()` throws a native `ZodError`.
Because `ZodError` does not inherit from NestJS `HttpException`, `HttpExceptionFilter` falls into the generic `Error` handler, assigning status code `500 Internal Server Error`.

#### 3. Impact Analysis
Any client or frontend application submitting an invalid message payload receives an HTTP 500 error instead of HTTP 400 Bad Request. Automated monitoring tools (Sentry, Datadog) interpret client validation mistakes as critical backend application crashes.

#### 4. Expected Behavior
Validation errors must always return HTTP 400 Bad Request with `{ code: 'VALIDATION_FAILED', details: [...] }`.

#### 5. Recommended Fix
1. In `HttpExceptionFilter`, add explicit handling for `ZodError`:
```typescript
import { ZodError } from 'zod';

if (exception instanceof ZodError) {
  statusCode = HttpStatus.BAD_REQUEST;
  code = 'VALIDATION_FAILED';
  message = 'Validation failed';
  details = exception.issues.map(issue => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}
```
2. In `MessagesController`, replace `.parse()` with `safeParse()` or use a dedicated multipart Zod pipe.

#### 6. Verification Method
Send an invalid payload `{ "content": "" }` to `POST /api/v1/conversations/:id/messages` and verify that the response is `400 Bad Request` with `code: 'VALIDATION_FAILED'`.

---

### [FINDING-P5-02] Web Chat Widget Endpoints Completely Bypass Shared Contracts

- **Severity**: **HIGH**
- **Category**: Contract Alignment & Architecture
- **Location**: `apps/server/src/integrations/web-chat/web-chat.controller.ts:33-58, 129-155`
- **Requirement Reference**: `docs/07-api-and-contracts.md`, `packages/shared-contracts/`

#### 1. Evidence
In `apps/server/src/integrations/web-chat/web-chat.controller.ts`:
```typescript
// ❌ Ad-hoc local interfaces defined directly inside the controller file:
export interface WidgetContactRequestDto {
  websiteToken?: string;
  widgetToken?: string;
  identifier?: string;
  name?: string;
  email?: string;
  // ...
}

export interface WidgetContactResponseDto {
  token: string;
  contactToken: string;
  contact: Record<string, unknown>;
  isNewContact: boolean;
}

@Post('contact')
async getOrCreateContact(
  @Body() dto: WidgetContactRequestDto, // ❌ Uses raw @Body() without Zod validation
): Promise<WidgetContactResponseDto> { ... }
```
In `packages/shared-contracts/src/`:
```text
Zero schemas or types exist for web-chat or widget endpoints.
```

#### 2. Problem Description
The shared contract package `@sales-copilot/shared-contracts` was architected to be the single source of truth for both backend validation and frontend SDK types.
The entire Web Chat Widget REST API surface (`GET /api/v1/widget/config`, `POST /api/v1/widget/contact`, `GET /api/v1/widget/conversations`, etc.) bypasses this architecture:
- No Zod schemas exist in `shared-contracts`.
- The controller uses unvalidated `@Body()` decorators.
- The embeddable widget SDK (`@sales-copilot/widget-sdk`) and web frontend cannot import types from `shared-contracts`.

#### 3. Impact Analysis
The public Web Chat API is vulnerable to malformed inputs and parameter injection, and client SDKs must duplicate type declarations.

#### 4. Expected Behavior
All Web Chat request/response types and Zod validation schemas should be defined in `packages/shared-contracts/src/widget/` and enforced on `WebChatController` via `@ZodBody()`, `@ZodQuery()`.

#### 5. Recommended Fix
1. Create `packages/shared-contracts/src/widget/schemas.ts` defining `widgetContactRequestSchema`, `widgetContactResponseSchema`, etc.
2. Export them from `@sales-copilot/shared-contracts`.
3. Update `WebChatController` to use `@ZodBody(widgetContactRequestSchema)`.

#### 6. Verification Method
Verify that `packages/shared-contracts` exports widget schemas and that `WebChatController` imports them.

---

### [FINDING-P5-03] Information Disclosure in Production Exception Filter

- **Severity**: **HIGH**
- **Category**: Security & Error Handling
- **Location**: `apps/server/src/common/filters/http-exception.filter.ts:55-57`
- **Requirement Reference**: OWASP Top 10 Security Misconfiguration / Information Disclosure

#### 1. Evidence
In `apps/server/src/common/filters/http-exception.filter.ts`:
```typescript
} else if (exception instanceof Error) {
  // ❌ Exposes raw exception message unconditionally in production:
  message = exception.message || 'Internal server error';
}
```

#### 2. Problem Description
When an unhandled native Error or database exception occurs (e.g. Prisma database connection failure, Postgres syntax error, or disk I/O error):
- Line 56 sets `message = exception.message`.
- This message is returned directly to the HTTP client in the response JSON:
  `{ "success": false, "error": { "code": "INTERNAL_SERVER_ERROR", "message": "Can't reach database server at localhost:5432" } }`.
- `HttpExceptionFilter` does not check `NODE_ENV`. In production environments, raw internal error details, database connection strings, table names, and query structures leak to attackers.

#### 3. Impact Analysis
Facilitates database fingerprinting and reveals internal infrastructure topology to malicious actors.

#### 4. Expected Behavior
In production (`NODE_ENV === 'production'`), generic 500 errors must sanitize the message to a static string: `"An unexpected error occurred. Please contact support."` and include a correlation `requestId`.

#### 5. Recommended Fix
Update `HttpExceptionFilter`:
```typescript
} else if (exception instanceof Error) {
  const isProduction = process.env.NODE_ENV === 'production';
  message = isProduction ? 'An unexpected internal error occurred' : (exception.message || 'Internal server error');
}
```

#### 6. Verification Method
Simulate a database connection error with `NODE_ENV=production` and verify that the response message is `"An unexpected internal error occurred"`.

---

### [FINDING-P5-04] Orphaned Contracts in `shared-contracts/users`

- **Severity**: **LOW**
- **Category**: Contract Maintenance & Dead Code
- **Location**: `packages/shared-contracts/src/users/schemas.ts:4-18`
- **Requirement Reference**: `docs/07-api-and-contracts.md`

#### 1. Evidence
In `packages/shared-contracts/src/users/schemas.ts`:
```typescript
export const updateUserProfileSchema = z.object({
  name: z.string().min(1).optional(),
  avatarUrl: z.string().url().optional(),
});
export type UpdateUserProfileDto = z.infer<typeof updateUserProfileSchema>;

export interface UserProfileDto {
  id: string;
  email: string;
  name: string;
  role: PlatformRole;
  avatarUrl?: string;
  isActive: boolean;
  createdAt: string;
}
```

#### 2. Problem Description
These schemas were defined for a user profile update feature, but the backend server currently has an empty `apps/server/src/modules/users` directory and no endpoint consuming them. Furthermore, `UserDto` in `auth/schemas.ts` already satisfies user representation needs.

#### 3. Impact Analysis
Confuses frontend developers into expecting an update profile API that does not exist.

#### 4. Expected Behavior
Either implement `PATCH /api/v1/auth/me` using `updateUserProfileSchema`, or remove the unused contract definitions.

#### 5. Recommended Fix
Implement `PATCH /api/v1/auth/me` in `AuthController` during **Phase 10 (Hardening Sprint)**.

#### 6. Verification Method
Verify that `updateUserProfileSchema` is imported and used by a controller.

---

### [FINDING-P5-05] OpenAPI / Swagger Inconsistencies across Controllers

- **Severity**: **LOW**
- **Category**: Documentation & API Usability
- **Location**: `apps/server/src/modules/realtime/presence.controller.ts:31`, `apps/server/src/integrations/web-chat/web-chat.controller.ts:65`
- **Requirement Reference**: `docs/07-api-and-contracts.md`

#### 1. Evidence
- In `PresenceController`: Annotated with `@Controller('workspaces/:workspaceId/presence')` without `@ApiHeader({ name: 'X-Workspace-Id' })`.
- In `WebChatController`: Lacks `@ApiResponse` status annotations for 400 Bad Request and 404 Not Found on visitor endpoints.

#### 2. Problem Description
Automated OpenAPI client SDK generators (like `openapi-typescript-codegen`) produce inconsistent client libraries when endpoints omit error responses and diverge from tenant header standards.

#### 3. Impact Analysis
Client code generation tools generate incomplete type definitions for error responses.

#### 4. Expected Behavior
Consistent header documentation and complete status code annotations across all controller endpoints.

#### 5. Recommended Fix
Standardize `PresenceController` to `@ApiHeader({ name: 'X-Workspace-Id' })` and add complete `@ApiResponse` decorators to `WebChatController`.

#### 6. Verification Method
Generate OpenAPI JSON via `/docs-json` and verify schema completeness.

---

## 5. Phase 5 API & Contracts Sign-Off Assessment

| Dimension | Standard | Audit Result | Status |
| :--- | :--- | :--- | :---: |
| **Response Standardization** | Uniform `{ success: true, data, meta }` envelope | 100% compliant via `TransformInterceptor`. | ✅ **Pass** |
| **Input Validation** | Zod pipe validation on all mutation endpoints | Fails on `MessagesController` (`FINDING-P5-01`) and `WebChatController` (`FINDING-P5-02`). | 🔴 **Critical Action Required** |
| **Error Handling** | Standardized `{ success: false, error }` | Fails on raw `ZodError` and leaks message in production (`FINDING-P5-03`). | 🔴 **Critical Action Required** |
| **Contract Alignment** | Shared contracts match backend endpoints | WebChat missing; Users contract orphaned. | 🟡 **Needs Hardening** |
| **Date Formatting** | Strict ISO 8601 strings | 100% compliant across all mappers. | ✅ **Pass** |

### Summary Recommendation for Phase 5:
The API response envelope design and mapper layer are clean and robust. 

Three **Critical/High priority contract and validation defects** must be resolved in **Phase 10 (Hardening Sprint)**:
1. Intercept `ZodError` in `HttpExceptionFilter` to prevent HTTP 500 responses on validation failures in `MessagesController`.
2. Migrate Web Chat widget schemas to `@sales-copilot/shared-contracts` and enforce `@ZodBody()`.
3. Sanitize 500 error messages in `HttpExceptionFilter` when `NODE_ENV === 'production'`.
