# REST API Contracts (Phase 1)

## 1. Request & Response Standards

- **Base URL**: `/api/v1`
- **Authentication**: `Authorization: Bearer <JWT_TOKEN>` (Cookie fallback for Web Client)
- **Content Type**: `application/json`

### 1.1. Success Response Envelope
All successful responses are uniformly wrapped by the `TransformInterceptor`:
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "hasMore": true
  }
}
```
* Single resource endpoints return `"data": { ... }` (or `"data": null` on 204/empty).
* Collection endpoints return `"data": [ ... ]` and `"meta": { ... }`.

### 1.2. Error Response Schema
All errors (NestJS `HttpException`, validation pipes, unhandled errors) are captured by `HttpExceptionFilter` and formatted uniformly:
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Contact with id '123' not found",
    "details": null
  }
}
```

### 1.3. Standard Error Code Mapping

| HTTP Status | Standard Code (`error.code`) | Description | Example NestJS Exception |
| :--- | :--- | :--- | :--- |
| **400** | `BAD_REQUEST` | Malformed request or business invariant failure | `new BadRequestException('...')` |
| **400 / 422** | `VALIDATION_FAILED` | Payload schema validation failed | `new BadRequestException({ code: 'VALIDATION_FAILED', errors: [...] })` |
| **401** | `UNAUTHORIZED` | Missing or invalid authentication token | `new UnauthorizedException('...')` |
| **403** | `FORBIDDEN` | Insufficient permissions / workspace tenant mismatch | `new ForbiddenException('...')` |
| **404** | `NOT_FOUND` | Resource or entity does not exist | `new NotFoundException('...')` |
| **409** | `CONFLICT` | State conflict (e.g. duplicate email, version conflict) | `new ConflictException('...')` |
| **429** | `TOO_MANY_REQUESTS` | Rate limit exceeded | `ThrottlerGuard` |
| **500** | `INTERNAL_SERVER_ERROR` | Unhandled server exception | `new InternalServerErrorException()` |

### 1.4. Validation Error Details Example
When `@ZodBody`, `@ZodQuery`, or `@ZodParam` validation fails:
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
      },
      {
        "field": "phone_number",
        "message": "Required"
      }
    ]
  }
}
```

### 1.5. Comparison with Chatwoot Reference
| Aspect | Chatwoot Reference (Rails) | Sales Copilot (NestJS) |
| :--- | :--- | :--- |
| **Success Envelope** | Varied (direct object, `{ meta, payload }`, `{ data: { meta, payload } }`) | **Unified `{ success: true, data, meta }`** |
| **Error Handling** | Rails `rescue_from` (`{ error: string }` or `{ message: string, attributes: [] }`) | **NestJS `HttpExceptionFilter` with typed `{ success: false, error: { code, message, details } }`** |
| **Client Types** | Implicit / Ruby Jbuilder templates | **Explicit TypeScript Contracts (`@sales-copilot/shared-contracts`)** |

---

## 2. Resource Endpoints

### 2.1 Authentication & Workspace
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `GET  /api/v1/workspaces/current`
- `GET  /api/v1/workspaces/members`

### 2.2 Inboxes & Channels (1:1)
- `GET    /api/v1/inboxes`
- `POST   /api/v1/inboxes`
- `GET    /api/v1/inboxes/:id`
- `PATCH  /api/v1/inboxes/:id`
- `POST   /api/v1/channels/:id/webhook` (Public ingestion webhook)

### 2.3 Contacts & Identities
- `GET    /api/v1/contacts`
- `POST   /api/v1/contacts`
- `GET    /api/v1/contacts/:id`
- `PATCH  /api/v1/contacts/:id`
- `POST   /api/v1/contacts/merge`

### 2.4 Conversations & Messaging
- `GET    /api/v1/conversations` (Filters: `status`, `inboxId`, `assigneeId`, `teamId`, `labelId`)
- `POST   /api/v1/conversations`
- `GET    /api/v1/conversations/:id`
- `PATCH  /api/v1/conversations/:id/status` (`OPEN`, `PENDING`, `RESOLVED`, `SNOOZED`)
- `PATCH  /api/v1/conversations/:id/assign`
- `GET    /api/v1/conversations/:id/messages`
- `POST   /api/v1/conversations/:id/messages`

### 2.5 Operations
- `GET/POST /api/v1/labels`
- `GET/POST /api/v1/canned-responses`
- `GET/POST /api/v1/automation-rules`
- `GET/POST /api/v1/webhook-subscriptions`
