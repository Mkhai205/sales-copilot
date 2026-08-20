# 07. API & Contracts Specification

## 1. REST API Standards

- **Base Path**: `/api/v1`
- **Authentication**: Bearer JWT (`Authorization: Bearer <token>`)
- **Tenant Context**: Automatically resolved from authenticated user's active `workspaceId`.
- **Validation**: Strict input validation using Zod schemas from `@sales-copilot/contracts`.
- **Response Structure**:
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
- **Error Response Structure**:
  ```json
  {
    "success": false,
    "error": {
      "code": "VALIDATION_FAILED",
      "message": "Invalid input payload",
      "details": [ ... ]
    }
  }
  ```

---

## 2. Core Resource Endpoints (Phase 1)

### Authentication & Workspace
- `POST /api/v1/auth/login` — User authentication.
- `POST /api/v1/auth/refresh` — Token rotation.
- `GET  /api/v1/workspaces/current` — Get active workspace metadata.
- `GET  /api/v1/workspaces/members` — List members in workspace.

### Inboxes & Channels
- `GET    /api/v1/inboxes` — List all inboxes in workspace.
- `POST   /api/v1/inboxes` — Create an inbox with channel configuration.
- `GET    /api/v1/inboxes/:id` — Get inbox details and connected channel.
- `PATCH  /api/v1/inboxes/:id` — Update inbox settings.
- `POST   /api/v1/channels/:id/webhook` — Public webhook receiver for channel events.

### Contacts
- `GET    /api/v1/contacts` — Search and paginate contacts.
- `POST   /api/v1/contacts` — Create a new contact.
- `GET    /api/v1/contacts/:id` — Get contact details with channel identities.
- `PATCH  /api/v1/contacts/:id` — Update contact information.
- `POST   /api/v1/contacts/merge` — Merge duplicate contacts.

### Conversations & Messages
- `GET    /api/v1/conversations` — Filter conversations (`status`, `inboxId`, `assigneeId`, `teamId`, `labelId`).
- `POST   /api/v1/conversations` — Start a new conversation.
- `GET    /api/v1/conversations/:id` — Get conversation details and labels.
- `PATCH  /api/v1/conversations/:id/status` — Change status (`OPEN`, `RESOLVED`, `PENDING`, `SNOOZED`).
- `PATCH  /api/v1/conversations/:id/assign` — Assign to agent or team.
- `GET    /api/v1/conversations/:id/messages` — Paginate conversation messages.
- `POST   /api/v1/conversations/:id/messages` — Send outgoing message (text or attachments).

### Operations
- `GET    /api/v1/labels` — List workspace labels.
- `POST   /api/v1/labels` — Create label.
- `GET    /api/v1/canned-responses` — List canned responses (supports query search by shortCode).
- `POST   /api/v1/canned-responses` — Create canned response.
- `GET    /api/v1/automation-rules` — List automation rules.
- `POST   /api/v1/automation-rules` — Create automation rule.
- `GET    /api/v1/webhook-subscriptions` — List webhook subscriptions.
- `POST   /api/v1/webhook-subscriptions` — Register outbound webhook subscription.
