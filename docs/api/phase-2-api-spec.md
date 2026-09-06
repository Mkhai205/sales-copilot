# Phase 2 API & Realtime Event Specifications: Sales Intelligence & AI Copilot

- **Version**: 2.0.0-RFC
- **Status**: APPROVED ARCHITECTURAL SPECIFICATION
- **Base URL**: `/api/v1`
- **Realtime Gateway**: `/realtime` (WebSocket / Socket.io)
- **Applicable Context**: Phase 2 — Sales Intelligence & AI Copilot Core
- **Reference Standard**: NestJS Modular Monolith, Multi-Tenant Isolation (`workspaceId`), Zod Data Contracts

---

## 1. Request & Response Standards

### 1.1 Protocol & Authentication
- **Transport**: HTTPS (REST API), WSS (WebSocket Gateway)
- **Headers**:
  - `Authorization: Bearer <jwt_access_token>`
  - `Content-Type: application/json`
  - `Accept: application/json`
- **Tenant Context**: All Phase 2 routes are explicitly scoped by `:workspaceId` path parameter (e.g., `/api/v1/workspaces/:workspaceId/...`). Backend guards (`WorkspaceAuthGuard`, `JwtAuthGuard`) verify the authenticated user is an active member of the specified workspace and enforce role permissions.

### 1.2 Success Response Envelope
All successful HTTP endpoints return an envelope formatted by NestJS `TransformInterceptor`:

```typescript
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
    nextCursor?: string;
    [key: string]: unknown;
  };
}
```

### 1.3 Error Response Envelope
All exceptions caught by `HttpExceptionFilter` return a typed, uniform error response:

```typescript
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }> | Record<string, unknown> | null;
  };
}
```

### 1.4 Standard Phase 2 Error Codes

| HTTP Status | Error Code (`error.code`) | Description / Trigger Condition |
| :--- | :--- | :--- |
| **400** | `BAD_REQUEST` | Malformed request body, invalid JSON syntax |
| **400 / 422** | `VALIDATION_FAILED` | Zod schema validation failed (returns `details` array) |
| **401** | `UNAUTHORIZED` | Missing, expired, or invalid JWT token |
| **403** | `FORBIDDEN` | Insufficient role permissions or cross-workspace access |
| **404** | `LEAD_NOT_FOUND` | Lead does not exist in the requested workspace |
| **404** | `OPPORTUNITY_NOT_FOUND` | Opportunity does not exist in the requested workspace |
| **404** | `SALES_EVIDENCE_NOT_FOUND` | Evidence record does not exist |
| **404** | `SUGGESTION_NOT_FOUND` | Copilot suggestion not found |
| **404** | `TEMPLATE_NOT_FOUND` | Prompt template does not exist |
| **409** | `LEAD_ALREADY_EXISTS` | Active lead already exists for the specified contact |
| **409** | `LEAD_ALREADY_CONVERTED` | Attempted to convert or modify an already converted lead |
| **409** | `INVALID_STAGE_TRANSITION` | Disallowed stage progression (e.g., from closed to open) |
| **409** | `SUGGESTION_ALREADY_RESOLVED`| Attempted to accept/dismiss an already resolved suggestion |
| **409** | `DUPLICATE_TEMPLATE_VERSION`| A prompt template with identical name and version exists |
| **429** | `LLM_RATE_LIMIT_EXCEEDED` | Upstream AI provider (Gemini / OpenAI) rate limit hit |
| **502** | `LLM_GATEWAY_ERROR` | AI provider unavailable, quota exceeded, or parse failure |
| **500** | `INTERNAL_SERVER_ERROR` | Unhandled server exception |

---

## 2. Common Data Types & Enums

```typescript
import { z } from 'zod';

export const LeadStatusSchema = z.enum([
  'NEW',
  'CONTACTED',
  'ENGAGED',
  'QUALIFIED',
  'UNQUALIFIED',
  'CONVERTED',
  'DISQUALIFIED',
]);
export type LeadStatus = z.infer<typeof LeadStatusSchema>;

export const LeadStageSchema = z.enum([
  'DISCOVERY',
  'EVALUATION',
  'PROPOSAL',
  'NEGOTIATION',
  'WON',
  'LOST',
]);
export type LeadStage = z.infer<typeof LeadStageSchema>;

export const LeadGradeSchema = z.enum(['HOT', 'WARM', 'COLD', 'JUNK']);
export type LeadGrade = z.infer<typeof LeadGradeSchema>;

export const OpportunityStageSchema = z.enum([
  'PROSPECTING',
  'QUALIFICATION',
  'PROPOSAL',
  'NEGOTIATION',
  'CLOSED_WON',
  'CLOSED_LOST',
]);
export type OpportunityStage = z.infer<typeof OpportunityStageSchema>;

export const BuyingSignalTypeSchema = z.enum([
  'BUDGET_CONFIRMED',
  'AUTHORITY_IDENTIFIED',
  'NEED_EXPRESSED',
  'TIMELINE_DEFINED',
  'COMPETITOR_MENTION',
  'OBJECTION_RAISED',
  'PURCHASE_INTENT',
  'CHURN_RISK',
  'ENGAGEMENT_SPIKE',
]);
export type BuyingSignalType = z.infer<typeof BuyingSignalTypeSchema>;

export const ScoreTriggerEventSchema = z.enum([
  'INITIAL_CALCULATION',
  'MESSAGE_RECEIVED',
  'EVIDENCE_DETECTED',
  'STAGE_CHANGED',
  'MANUAL_RECALCULATION',
  'TIME_DECAY',
]);
export type ScoreTriggerEvent = z.infer<typeof ScoreTriggerEventSchema>;

export const CopilotSuggestionTypeSchema = z.enum([
  'RECOMMENDED_REPLY',
  'NEXT_BEST_ACTION',
  'OBJECTION_HANDLING',
  'DISCOUNT_PROPOSAL',
  'MEETING_SCHEDULE',
  'FOLLOW_UP_REMINDER',
]);
export type CopilotSuggestionType = z.infer<typeof CopilotSuggestionTypeSchema>;

export const SuggestionStatusSchema = z.enum([
  'PENDING',
  'ACCEPTED',
  'DISMISSED',
  'EXPIRED',
]);
export type SuggestionStatus = z.infer<typeof SuggestionStatusSchema>;

export const LlmProviderSchema = z.enum(['GEMINI', 'OPENAI', 'ANTHROPIC', 'DEEPSEEK']);
export type LlmProvider = z.infer<typeof LlmProviderSchema>;
```

---

## 3. Leads REST API

### 3.1 `POST /api/v1/workspaces/:workspaceId/leads`
Create a new Lead for an existing Contact.

- **Role Required**: `OWNER`, `ADMIN`, `AGENT`
- **Invariants**:
  - `contactId` must belong to `:workspaceId`.
  - A Contact can only have one active (non-CONVERTED, non-DISQUALIFIED) Lead at any given time. Duplicate requests return `409 LEAD_ALREADY_EXISTS`.
  - Automatically initializes baseline `LeadScore` record (initial score 0, grade `COLD`).

#### Request Zod Schema
```typescript
export const createLeadSchema = z.object({
  contactId: z.string().uuid('Invalid contactId format'),
  status: LeadStatusSchema.optional().default('NEW'),
  stage: LeadStageSchema.optional().default('DISCOVERY'),
  assignedUserId: z.string().uuid().optional().nullable(),
  estimatedValue: z.number().positive('Estimated value must be positive').optional().nullable(),
  currency: z.string().length(3, 'Currency must be 3-letter ISO code').default('USD'),
  metadata: z.record(z.unknown()).optional().default({}),
});
export type CreateLeadDto = z.infer<typeof createLeadSchema>;
```

#### Response Example (`201 Created`)
```json
{
  "success": true,
  "data": {
    "id": "7b8e1a2f-5301-447a-8f3b-58bbdf138a01",
    "workspaceId": "e305e94e-2895-467b-99d6-c9bc65fe95f1",
    "contactId": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    "status": "NEW",
    "stage": "DISCOVERY",
    "score": 0,
    "grade": "COLD",
    "assignedUserId": "4b5c6d7e-8f9a-0b1c-2d3e-4f5a6b7c8d9e",
    "estimatedValue": 15000.00,
    "currency": "USD",
    "metadata": {
      "leadSource": "WEB_CHAT",
      "company": "Acme Global"
    },
    "createdAt": "2026-09-06T07:30:00.000Z",
    "updatedAt": "2026-09-06T07:30:00.000Z"
  }
}
```

---

### 3.2 `GET /api/v1/workspaces/:workspaceId/leads`
Query a paginated list of leads with multi-dimensional filtering.

- **Role Required**: `OWNER`, `ADMIN`, `AGENT`, `VIEWER`

#### Query Parameters Schema
```typescript
export const listLeadsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: LeadStatusSchema.optional(),
  stage: LeadStageSchema.optional(),
  grade: LeadGradeSchema.optional(),
  assignedUserId: z.string().uuid().optional(),
  minScore: z.coerce.number().int().min(0).max(100).optional(),
  maxScore: z.coerce.number().int().min(0).max(100).optional(),
  search: z.string().trim().optional(),
  sortBy: z.enum(['score', 'createdAt', 'updatedAt', 'estimatedValue']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type ListLeadsQuery = z.infer<typeof listLeadsQuerySchema>;
```

#### Response Example (`200 OK`)
```json
{
  "success": true,
  "data": [
    {
      "id": "7b8e1a2f-5301-447a-8f3b-58bbdf138a01",
      "workspaceId": "e305e94e-2895-467b-99d6-c9bc65fe95f1",
      "contactId": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
      "contact": {
        "id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
        "name": "Jane Doe",
        "email": "jane@acme.com",
        "phoneNumber": "+14155552671"
      },
      "status": "QUALIFIED",
      "stage": "PROPOSAL",
      "score": 85,
      "grade": "HOT",
      "assignedUser": {
        "id": "4b5c6d7e-8f9a-0b1c-2d3e-4f5a6b7c8d9e",
        "name": "Alex Rep",
        "avatarUrl": "https://cdn.salescopilot.io/avatars/alex.png"
      },
      "estimatedValue": 25000.00,
      "currency": "USD",
      "createdAt": "2026-09-05T10:00:00.000Z",
      "updatedAt": "2026-09-06T06:15:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "hasMore": true
  }
}
```

---

### 3.3 `GET /api/v1/workspaces/:workspaceId/leads/:id`
Fetch single lead details including contact profile, score factors, and recent buying signals.

- **Role Required**: `OWNER`, `ADMIN`, `AGENT`, `VIEWER`

#### Response Example (`200 OK`)
```json
{
  "success": true,
  "data": {
    "id": "7b8e1a2f-5301-447a-8f3b-58bbdf138a01",
    "workspaceId": "e305e94e-2895-467b-99d6-c9bc65fe95f1",
    "contactId": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    "contact": {
      "id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
      "name": "Jane Doe",
      "email": "jane@acme.com",
      "phoneNumber": "+14155552671",
      "customAttributes": { "role": "VP Operations" }
    },
    "status": "QUALIFIED",
    "stage": "PROPOSAL",
    "score": 85,
    "grade": "HOT",
    "assignedUserId": "4b5c6d7e-8f9a-0b1c-2d3e-4f5a6b7c8d9e",
    "estimatedValue": 25000.00,
    "currency": "USD",
    "metadata": { "annualRevenue": "$10M" },
    "scoreRecord": {
      "score": 85,
      "grade": "HOT",
      "scoreFactors": [
        { "factor": "BUDGET_CONFIRMED", "weight": 35, "points": 35, "rationale": "Explicit $25k budget mentioned" },
        { "factor": "AUTHORITY_IDENTIFIED", "weight": 25, "points": 25, "rationale": "VP Operations decision maker" },
        { "factor": "TIMELINE_DEFINED", "weight": 25, "points": 25, "rationale": "Q4 implementation target" }
      ],
      "calculatedAt": "2026-09-06T06:15:00.000Z"
    },
    "recentEvidences": [
      {
        "id": "9c8b7a6f-5e4d-3c2b-1a0f-9e8d7c6b5a4f",
        "signalType": "BUDGET_CONFIRMED",
        "confidence": 0.96,
        "snippet": "Our approved budget for this project is 25,000 USD.",
        "createdAt": "2026-09-06T06:10:00.000Z"
      }
    ],
    "createdAt": "2026-09-05T10:00:00.000Z",
    "updatedAt": "2026-09-06T06:15:00.000Z"
  }
}
```

---

### 3.4 `PATCH /api/v1/workspaces/:workspaceId/leads/:id`
Update lead properties, stage, status, or reassign sales owner.

- **Role Required**: `OWNER`, `ADMIN`, `AGENT`

#### Request Zod Schema
```typescript
export const updateLeadSchema = z.object({
  status: LeadStatusSchema.optional(),
  stage: LeadStageSchema.optional(),
  assignedUserId: z.string().uuid().optional().nullable(),
  estimatedValue: z.number().positive().optional().nullable(),
  currency: z.string().length(3).optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type UpdateLeadDto = z.infer<typeof updateLeadSchema>;
```

#### Response Example (`200 OK`)
```json
{
  "success": true,
  "data": {
    "id": "7b8e1a2f-5301-447a-8f3b-58bbdf138a01",
    "workspaceId": "e305e94e-2895-467b-99d6-c9bc65fe95f1",
    "status": "QUALIFIED",
    "stage": "NEGOTIATION",
    "estimatedValue": 28000.00,
    "assignedUserId": "4b5c6d7e-8f9a-0b1c-2d3e-4f5a6b7c8d9e",
    "updatedAt": "2026-09-06T07:45:00.000Z"
  }
}
```

---

### 3.5 `POST /api/v1/workspaces/:workspaceId/leads/:id/convert`
Convert a qualified Lead into a revenue Opportunity.

- **Role Required**: `OWNER`, `ADMIN`, `AGENT`
- **Invariants**:
  - Lead must NOT already be `CONVERTED` (returns `409 LEAD_ALREADY_CONVERTED`).
  - Automatically updates Lead `status` to `CONVERTED`.
  - Atomically creates an `Opportunity` record linked to `leadId`, `contactId`, and `workspaceId`.
  - Broadcasts `lead.converted` and `opportunity.created` realtime WebSocket events.

#### Request Zod Schema
```typescript
export const convertLeadSchema = z.object({
  title: z.string().min(3, 'Opportunity title must be at least 3 characters'),
  amount: z.number().positive('Opportunity amount must be greater than zero'),
  currency: z.string().length(3).default('USD'),
  expectedCloseDate: z.string().datetime('Must be valid ISO-8601 datetime').optional(),
  probability: z.number().int().min(0).max(100).default(50),
  assignedUserId: z.string().uuid().optional().nullable(),
});
export type ConvertLeadDto = z.infer<typeof convertLeadSchema>;
```

#### Response Example (`201 Created`)
```json
{
  "success": true,
  "data": {
    "lead": {
      "id": "7b8e1a2f-5301-447a-8f3b-58bbdf138a01",
      "status": "CONVERTED",
      "updatedAt": "2026-09-06T07:50:00.000Z"
    },
    "opportunity": {
      "id": "3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f",
      "workspaceId": "e305e94e-2895-467b-99d6-c9bc65fe95f1",
      "leadId": "7b8e1a2f-5301-447a-8f3b-58bbdf138a01",
      "contactId": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
      "title": "Acme Global - Enterprise Tier Q4",
      "stage": "QUALIFICATION",
      "amount": 28000.00,
      "currency": "USD",
      "probability": 60,
      "expectedCloseDate": "2026-11-30T17:00:00.000Z",
      "assignedUserId": "4b5c6d7e-8f9a-0b1c-2d3e-4f5a6b7c8d9e",
      "createdAt": "2026-09-06T07:50:00.000Z"
    }
  }
}
```

---

## 4. Opportunities & Pipeline REST API

### 4.1 `POST /api/v1/workspaces/:workspaceId/opportunities`
Create an opportunity directly (without lead conversion) or associate with an existing lead.

- **Role Required**: `OWNER`, `ADMIN`, `AGENT`

#### Request Zod Schema
```typescript
export const createOpportunitySchema = z.object({
  contactId: z.string().uuid('Invalid contactId format'),
  leadId: z.string().uuid().optional().nullable(),
  title: z.string().min(3, 'Opportunity title is required'),
  stage: OpportunityStageSchema.optional().default('PROSPECTING'),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().length(3).default('USD'),
  probability: z.number().int().min(0).max(100).default(50),
  expectedCloseDate: z.string().datetime().optional().nullable(),
  assignedUserId: z.string().uuid().optional().nullable(),
  metadata: z.record(z.unknown()).optional().default({}),
});
export type CreateOpportunityDto = z.infer<typeof createOpportunitySchema>;
```

#### Response Example (`201 Created`)
```json
{
  "success": true,
  "data": {
    "id": "3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f",
    "workspaceId": "e305e94e-2895-467b-99d6-c9bc65fe95f1",
    "contactId": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    "leadId": null,
    "title": "Beta Corp - Expansion License",
    "stage": "PROSPECTING",
    "amount": 12000.00,
    "currency": "USD",
    "probability": 30,
    "expectedCloseDate": "2026-10-15T00:00:00.000Z",
    "assignedUserId": "4b5c6d7e-8f9a-0b1c-2d3e-4f5a6b7c8d9e",
    "createdAt": "2026-09-06T08:00:00.000Z",
    "updatedAt": "2026-09-06T08:00:00.000Z"
  }
}
```

---

### 4.2 `GET /api/v1/workspaces/:workspaceId/opportunities`
List opportunities with pipeline filters.

- **Role Required**: `OWNER`, `ADMIN`, `AGENT`, `VIEWER`

#### Query Parameters Schema
```typescript
export const listOpportunitiesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  stage: OpportunityStageSchema.optional(),
  assignedUserId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  closeDateFrom: z.string().datetime().optional(),
  closeDateTo: z.string().datetime().optional(),
  sortBy: z.enum(['amount', 'probability', 'expectedCloseDate', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type ListOpportunitiesQuery = z.infer<typeof listOpportunitiesQuerySchema>;
```

---

### 4.3 `PATCH /api/v1/workspaces/:workspaceId/opportunities/:id/stage`
Transition opportunity stage in the pipeline with win/loss tracking.

- **Role Required**: `OWNER`, `ADMIN`, `AGENT`
- **Invariants**:
  - If stage transitions to `CLOSED_LOST`, `lostReason` is mandatory.
  - Automatically updates `probability` based on stage defaults unless explicitly specified.
  - Automatically sets `actualCloseDate` when entering `CLOSED_WON` or `CLOSED_LOST`.

#### Request Zod Schema
```typescript
export const updateOpportunityStageSchema = z.object({
  stage: OpportunityStageSchema,
  probability: z.number().int().min(0).max(100).optional(),
  lostReason: z.string().min(5, 'lostReason must be detailed if lost').optional(),
  actualCloseDate: z.string().datetime().optional(),
}).refine(
  (data) => data.stage !== 'CLOSED_LOST' || (data.lostReason && data.lostReason.trim().length >= 5),
  {
    message: "lostReason is mandatory when stage is CLOSED_LOST",
    path: ["lostReason"],
  }
);
export type UpdateOpportunityStageDto = z.infer<typeof updateOpportunityStageSchema>;
```

#### Response Example (`200 OK`)
```json
{
  "success": true,
  "data": {
    "id": "3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f",
    "workspaceId": "e305e94e-2895-467b-99d6-c9bc65fe95f1",
    "stage": "CLOSED_WON",
    "probability": 100,
    "actualCloseDate": "2026-09-06T08:15:00.000Z",
    "lostReason": null,
    "updatedAt": "2026-09-06T08:15:00.000Z"
  }
}
```

---

### 4.4 `GET /api/v1/workspaces/:workspaceId/pipeline`
Retrieve aggregated sales pipeline analytics grouped by stage.

- **Role Required**: `OWNER`, `ADMIN`, `AGENT`, `VIEWER`

#### Query Parameters Schema
```typescript
export const pipelineSummaryQuerySchema = z.object({
  assignedUserId: z.string().uuid().optional(),
  currency: z.string().length(3).default('USD'),
});
export type PipelineSummaryQuery = z.infer<typeof pipelineSummaryQuerySchema>;
```

#### Response Example (`200 OK`)
```json
{
  "success": true,
  "data": {
    "currency": "USD",
    "totalPipelineValue": 185000.00,
    "weightedPipelineValue": 104500.00,
    "stages": [
      {
        "stage": "PROSPECTING",
        "count": 5,
        "totalAmount": 30000.00,
        "weightedAmount": 6000.00,
        "averageProbability": 20
      },
      {
        "stage": "QUALIFICATION",
        "count": 4,
        "totalAmount": 45000.00,
        "weightedAmount": 18000.00,
        "averageProbability": 40
      },
      {
        "stage": "PROPOSAL",
        "count": 3,
        "totalAmount": 50000.00,
        "weightedAmount": 30000.00,
        "averageProbability": 60
      },
      {
        "stage": "NEGOTIATION",
        "count": 2,
        "totalAmount": 60000.00,
        "weightedAmount": 50500.00,
        "averageProbability": 84
      }
    ]
  }
}
```

---

## 5. Sales Evidence REST API

### 5.1 `GET /api/v1/workspaces/:workspaceId/leads/:leadId/evidence`
Retrieve chronological sales evidence timeline extracted for a specific Lead.

- **Role Required**: `OWNER`, `ADMIN`, `AGENT`, `VIEWER`

#### Query Parameters Schema
```typescript
export const listLeadEvidenceQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  signalType: BuyingSignalTypeSchema.optional(),
  minConfidence: z.coerce.number().min(0.0).max(1.0).optional().default(0.70),
});
export type ListLeadEvidenceQuery = z.infer<typeof listLeadEvidenceQuerySchema>;
```

#### Response Example (`200 OK`)
```json
{
  "success": true,
  "data": [
    {
      "id": "9c8b7a6f-5e4d-3c2b-1a0f-9e8d7c6b5a4f",
      "workspaceId": "e305e94e-2895-467b-99d6-c9bc65fe95f1",
      "leadId": "7b8e1a2f-5301-447a-8f3b-58bbdf138a01",
      "conversationId": "e1f2a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b",
      "messageId": "msg_89012345-6789-0123-4567-890123456789",
      "signalType": "BUDGET_CONFIRMED",
      "confidence": 0.96,
      "snippet": "Our approved budget for this project is 25,000 USD.",
      "reason": "Customer explicitly stated an approved procurement budget matching the target plan tier.",
      "metadata": {
        "extractedAmount": 25000,
        "extractedCurrency": "USD"
      },
      "createdAt": "2026-09-06T06:10:00.000Z"
    },
    {
      "id": "1d2e3f4a-5b6c-7d8e-9f0a-1b2c3d4e5f6a",
      "workspaceId": "e305e94e-2895-467b-99d6-c9bc65fe95f1",
      "leadId": "7b8e1a2f-5301-447a-8f3b-58bbdf138a01",
      "conversationId": "e1f2a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b",
      "messageId": "msg_90123456-7890-1234-5678-901234567890",
      "signalType": "TIMELINE_DEFINED",
      "confidence": 0.88,
      "snippet": "We need the solution fully deployed by November 1st before our seasonal peak.",
      "reason": "Customer declared an urgent deployment milestone timeline.",
      "metadata": { "targetDate": "2026-11-01" },
      "createdAt": "2026-09-06T06:12:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 2,
    "hasMore": false
  }
}
```

---

### 5.2 `GET /api/v1/workspaces/:workspaceId/conversations/:conversationId/evidence`
Retrieve buying signals and risk evidence detected within an individual conversation thread.

- **Role Required**: `OWNER`, `ADMIN`, `AGENT`, `VIEWER`

#### Response Example (`200 OK`)
```json
{
  "success": true,
  "data": [
    {
      "id": "9c8b7a6f-5e4d-3c2b-1a0f-9e8d7c6b5a4f",
      "conversationId": "e1f2a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b",
      "leadId": "7b8e1a2f-5301-447a-8f3b-58bbdf138a01",
      "messageId": "msg_89012345-6789-0123-4567-890123456789",
      "signalType": "BUDGET_CONFIRMED",
      "confidence": 0.96,
      "snippet": "Our approved budget for this project is 25,000 USD.",
      "reason": "Customer explicitly stated an approved procurement budget.",
      "createdAt": "2026-09-06T06:10:00.000Z"
    }
  ]
}
```

---

## 6. Lead Scoring REST API

### 6.1 `GET /api/v1/workspaces/:workspaceId/leads/:leadId/score`
Retrieve current lead score calculation, transparent score factor breakdown, and audit history.

- **Role Required**: `OWNER`, `ADMIN`, `AGENT`, `VIEWER`

#### Response Example (`200 OK`)
```json
{
  "success": true,
  "data": {
    "leadId": "7b8e1a2f-5301-447a-8f3b-58bbdf138a01",
    "score": 85,
    "grade": "HOT",
    "calculatedAt": "2026-09-06T06:15:00.000Z",
    "scoreFactors": [
      {
        "factor": "BUDGET_CONFIRMED",
        "category": "BANT",
        "weight": 35,
        "points": 35,
        "rationale": "Explicit $25k budget mentioned in conversation"
      },
      {
        "factor": "AUTHORITY_IDENTIFIED",
        "category": "BANT",
        "weight": 25,
        "points": 25,
        "rationale": "Contact title verified as VP Operations"
      },
      {
        "factor": "TIMELINE_DEFINED",
        "category": "BANT",
        "weight": 25,
        "points": 25,
        "rationale": "Deployment targeted within 60 days"
      },
      {
        "factor": "ENGAGEMENT_VELOCITY",
        "category": "BEHAVIOR",
        "weight": 15,
        "points": 0,
        "rationale": "Under minimum 5-message interactive threshold"
      }
    ],
    "recentHistory": [
      {
        "id": "hist_11223344-5566-7788-99aa-bbccddeeff00",
        "previousScore": 60,
        "newScore": 85,
        "reason": "Added 25 points for TIMELINE_DEFINED signal",
        "eventTrigger": "EVIDENCE_DETECTED",
        "createdAt": "2026-09-06T06:15:00.000Z"
      },
      {
        "id": "hist_22334455-6677-8899-aabb-ccddeeff0011",
        "previousScore": 25,
        "newScore": 60,
        "reason": "Added 35 points for BUDGET_CONFIRMED signal",
        "eventTrigger": "EVIDENCE_DETECTED",
        "createdAt": "2026-09-06T06:10:00.000Z"
      }
    ]
  }
}
```

---

### 6.2 `POST /api/v1/workspaces/:workspaceId/leads/:leadId/score/recalculate`
Force on-demand recalculation of lead score via AI scoring engine.

- **Role Required**: `OWNER`, `ADMIN`, `AGENT`
- **Behavior**: Dispatches job to BullMQ `ai-lead-scoring` queue with priority, updates `LeadScore` and `LeadScoreHistory`, and emits `lead_score.updated` WebSocket event.

#### Response Example (`200 OK`)
```json
{
  "success": true,
  "data": {
    "leadId": "7b8e1a2f-5301-447a-8f3b-58bbdf138a01",
    "previousScore": 85,
    "newScore": 92,
    "grade": "HOT",
    "delta": 7,
    "recalculatedAt": "2026-09-06T08:30:00.000Z"
  }
}
```

---

## 7. Copilot Suggestions REST API

### 7.1 `GET /api/v1/workspaces/:workspaceId/conversations/:conversationId/copilot/suggestions`
Fetch pending and active AI suggestions for an ongoing conversation thread.

- **Role Required**: `OWNER`, `ADMIN`, `AGENT`

#### Query Parameters Schema
```typescript
export const listSuggestionsQuerySchema = z.object({
  status: SuggestionStatusSchema.optional().default('PENDING'),
});
export type ListSuggestionsQuery = z.infer<typeof listSuggestionsQuerySchema>;
```

#### Response Example (`200 OK`)
```json
{
  "success": true,
  "data": [
    {
      "id": "sug_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "workspaceId": "e305e94e-2895-467b-99d6-c9bc65fe95f1",
      "conversationId": "e1f2a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b",
      "leadId": "7b8e1a2f-5301-447a-8f3b-58bbdf138a01",
      "suggestionType": "OBJECTION_HANDLING",
      "content": "I completely understand that migrating from your existing tool feels daunting. We provide a dedicated migration specialist and automated data sync that completes setup in under 48 hours with zero downtime.",
      "actionPayload": {
        "action": "INSERT_COMPOSER_DRAFT",
        "insertText": "I completely understand that migrating from your existing tool feels daunting. We provide a dedicated migration specialist and automated data sync that completes setup in under 48 hours with zero downtime."
      },
      "confidence": 0.92,
      "status": "PENDING",
      "createdAt": "2026-09-06T08:35:00.000Z"
    },
    {
      "id": "sug_b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "workspaceId": "e305e94e-2895-467b-99d6-c9bc65fe95f1",
      "conversationId": "e1f2a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b",
      "leadId": "7b8e1a2f-5301-447a-8f3b-58bbdf138a01",
      "suggestionType": "NEXT_BEST_ACTION",
      "content": "Prospect has expressed high budget intent and timeline urgency. Recommend booking a 20-minute architecture deep dive.",
      "actionPayload": {
        "action": "SCHEDULE_MEETING",
        "meetingType": "DEMO_CALL",
        "suggestedTitle": "Acme Global - Technical Architecture Demo"
      },
      "confidence": 0.89,
      "status": "PENDING",
      "createdAt": "2026-09-06T08:35:05.000Z"
    }
  ]
}
```

---

### 7.2 `POST /api/v1/workspaces/:workspaceId/copilot/suggestions/:id/accept`
Mark suggestion as accepted (agent adopted draft response or executed recommended action).

- **Role Required**: `OWNER`, `ADMIN`, `AGENT`
- **Invariants**:
  - Suggestion must currently be in `PENDING` status (returns `409 SUGGESTION_ALREADY_RESOLVED` if already resolved).
  - Sets `status` to `ACCEPTED`, records `resolvedByUserId` and `resolvedAt`.
  - Dispatches `copilot_suggestion.resolved` event.

#### Request Zod Schema
```typescript
export const acceptSuggestionSchema = z.object({
  actionTaken: z.enum(['INSERTED_TEXT', 'SENT_MESSAGE', 'SCHEDULED_EVENT', 'CUSTOM']).default('INSERTED_TEXT'),
  feedbackNotes: z.string().optional(),
});
export type AcceptSuggestionDto = z.infer<typeof acceptSuggestionSchema>;
```

#### Response Example (`200 OK`)
```json
{
  "success": true,
  "data": {
    "id": "sug_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "ACCEPTED",
    "resolvedByUserId": "4b5c6d7e-8f9a-0b1c-2d3e-4f5a6b7c8d9e",
    "resolvedAt": "2026-09-06T08:36:00.000Z"
  }
}
```

---

### 7.3 `POST /api/v1/workspaces/:workspaceId/copilot/suggestions/:id/dismiss`
Dismiss suggestion with optional quality feedback reason for continuous LLM prompt refinement.

- **Role Required**: `OWNER`, `ADMIN`, `AGENT`

#### Request Zod Schema
```typescript
export const dismissSuggestionSchema = z.object({
  reason: z.enum(['IRRELEVANT', 'INCORRECT_FACTS', 'WRONG_TONE', 'OTHER']).default('IRRELEVANT'),
  feedbackNotes: z.string().optional(),
});
export type DismissSuggestionDto = z.infer<typeof dismissSuggestionSchema>;
```

#### Response Example (`200 OK`)
```json
{
  "success": true,
  "data": {
    "id": "sug_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "DISMISSED",
    "resolvedByUserId": "4b5c6d7e-8f9a-0b1c-2d3e-4f5a6b7c8d9e",
    "resolvedAt": "2026-09-06T08:36:30.000Z"
  }
}
```

---

## 8. Prompt Templates REST API

### 8.1 `GET /api/v1/workspaces/:workspaceId/copilot/templates`
List configured LLM prompt engineering templates.

- **Role Required**: `OWNER`, `ADMIN`, `AGENT`

#### Query Parameters Schema
```typescript
export const listTemplatesQuerySchema = z.object({
  provider: LlmProviderSchema.optional(),
  isActive: z.coerce.boolean().optional(),
});
export type ListTemplatesQuery = z.infer<typeof listTemplatesQuerySchema>;
```

#### Response Example (`200 OK`)
```json
{
  "success": true,
  "data": [
    {
      "id": "tpl_11223344-5566-7788-99aa-bbccddeeff00",
      "workspaceId": "e305e94e-2895-467b-99d6-c9bc65fe95f1",
      "name": "buying_signal_extractor",
      "version": 2,
      "provider": "GEMINI",
      "model": "gemini-2.0-flash",
      "inputVariables": ["conversation_history", "company_profile"],
      "temperature": 0.2,
      "maxTokens": 1024,
      "isDefault": true,
      "isActive": true,
      "createdAt": "2026-09-01T00:00:00.000Z",
      "updatedAt": "2026-09-05T12:00:00.000Z"
    }
  ]
}
```

---

### 8.2 `POST /api/v1/workspaces/:workspaceId/copilot/templates`
Create a new prompt template or increment template version.

- **Role Required**: `OWNER`, `ADMIN`

#### Request Zod Schema
```typescript
export const createPromptTemplateSchema = z.object({
  name: z.string().min(3).regex(/^[a-z0-9_-]+$/, 'name must be lowercase alphanumeric with underscores/dashes'),
  version: z.number().int().positive().default(1),
  provider: LlmProviderSchema.default('GEMINI'),
  model: z.string().min(2).default('gemini-2.0-flash'),
  systemPrompt: z.string().min(10, 'systemPrompt must provide clear instructions'),
  userPromptTemplate: z.string().min(10, 'userPromptTemplate must contain interpolation tags'),
  inputVariables: z.array(z.string()).min(1, 'At least one input variable is required'),
  temperature: z.number().min(0.0).max(1.0).default(0.2),
  maxTokens: z.number().int().positive().max(8192).default(1024),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});
export type CreatePromptTemplateDto = z.infer<typeof createPromptTemplateSchema>;
```

#### Response Example (`201 Created`)
```json
{
  "success": true,
  "data": {
    "id": "tpl_99887766-5544-3322-1100-aabbccddeeff",
    "workspaceId": "e305e94e-2895-467b-99d6-c9bc65fe95f1",
    "name": "copilot_reply_recommender",
    "version": 1,
    "provider": "GEMINI",
    "model": "gemini-2.0-flash",
    "isDefault": true,
    "isActive": true,
    "createdAt": "2026-09-06T08:45:00.000Z",
    "updatedAt": "2026-09-06T08:45:00.000Z"
  }
}
```

---

### 8.3 `PUT /api/v1/workspaces/:workspaceId/copilot/templates/:id`
Update an existing prompt template's parameters or prompt text.

- **Role Required**: `OWNER`, `ADMIN`

#### Request Zod Schema
```typescript
export const updatePromptTemplateSchema = z.object({
  systemPrompt: z.string().min(10).optional(),
  userPromptTemplate: z.string().min(10).optional(),
  inputVariables: z.array(z.string()).optional(),
  temperature: z.number().min(0.0).max(1.0).optional(),
  maxTokens: z.number().int().positive().max(8192).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
export type UpdatePromptTemplateDto = z.infer<typeof updatePromptTemplateSchema>;
```

---

## 9. WebSocket Realtime Events Specification

### 9.1 Connection, Authentication & Channels
- **Endpoint**: `/realtime`
- **Transport**: `websocket` via Socket.io
- **Auth Handshake**:
  ```typescript
  import { io } from 'socket.io-client';

  const socket = io('https://api.salescopilot.io/realtime', {
    auth: { token: 'jwt_access_token' },
    transports: ['websocket'],
  });
  ```
- **Room Topology**:
  - `workspace_${workspaceId}`: Global workspace announcements (Leads, Pipeline, Score alerts).
  - `conversation_${conversationId}`: Contextual updates (Live Copilot Suggestions, Evidence citations).
  - `lead_${leadId}`: Granular timeline updates for lead detail drawers.
  - `user_${userId}`: Direct agent action notifications.

---

### 9.2 Realtime Event Registry

| Event Name | Room Target | Trigger Condition |
| :--- | :--- | :--- |
| `lead.created` | `workspace_${workspaceId}` | New Lead record created |
| `lead.updated` | `workspace_${workspaceId}`, `lead_${leadId}` | Status, stage, or owner modified |
| `lead.converted` | `workspace_${workspaceId}`, `lead_${leadId}` | Lead converted into Opportunity |
| `opportunity.created` | `workspace_${workspaceId}` | New Opportunity added to pipeline |
| `opportunity.stage_updated` | `workspace_${workspaceId}` | Opportunity moved across pipeline stages |
| `sales_evidence.detected` | `workspace_${workspaceId}`, `conversation_${conversationId}`, `lead_${leadId}` | AI detected new Buying Signal / Objection |
| `lead_score.updated` | `workspace_${workspaceId}`, `lead_${leadId}` | Lead score recalculation completed |
| `copilot_suggestion.created` | `conversation_${conversationId}` | AI generated Next Best Action / Reply |
| `copilot_suggestion.resolved`| `conversation_${conversationId}` | Agent accepted or dismissed suggestion |

---

### 9.3 Event Payloads & TypeScript Contracts

#### A. `lead.created`
```typescript
export interface LeadCreatedRealtimeEvent {
  event: 'lead.created';
  data: {
    workspaceId: string;
    lead: {
      id: string;
      contactId: string;
      status: LeadStatus;
      stage: LeadStage;
      score: number;
      grade: LeadGrade;
      assignedUserId: string | null;
      estimatedValue: number | null;
      currency: string;
      createdAt: string;
    };
  };
}
```

```json
{
  "event": "lead.created",
  "data": {
    "workspaceId": "e305e94e-2895-467b-99d6-c9bc65fe95f1",
    "lead": {
      "id": "7b8e1a2f-5301-447a-8f3b-58bbdf138a01",
      "contactId": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
      "status": "NEW",
      "stage": "DISCOVERY",
      "score": 0,
      "grade": "COLD",
      "assignedUserId": "4b5c6d7e-8f9a-0b1c-2d3e-4f5a6b7c8d9e",
      "estimatedValue": 15000.00,
      "currency": "USD",
      "createdAt": "2026-09-06T07:30:00.000Z"
    }
  }
}
```

---

#### B. `lead.converted`
```typescript
export interface LeadConvertedRealtimeEvent {
  event: 'lead.converted';
  data: {
    workspaceId: string;
    leadId: string;
    opportunityId: string;
    convertedAt: string;
    opportunity: {
      id: string;
      title: string;
      amount: number;
      currency: string;
      stage: OpportunityStage;
      probability: number;
    };
  };
}
```

```json
{
  "event": "lead.converted",
  "data": {
    "workspaceId": "e305e94e-2895-467b-99d6-c9bc65fe95f1",
    "leadId": "7b8e1a2f-5301-447a-8f3b-58bbdf138a01",
    "opportunityId": "3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f",
    "convertedAt": "2026-09-06T07:50:00.000Z",
    "opportunity": {
      "id": "3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f",
      "title": "Acme Global - Enterprise Tier Q4",
      "amount": 28000.00,
      "currency": "USD",
      "stage": "QUALIFICATION",
      "probability": 60
    }
  }
}
```

---

#### C. `sales_evidence.detected`
```typescript
export interface SalesEvidenceDetectedRealtimeEvent {
  event: 'sales_evidence.detected';
  data: {
    workspaceId: string;
    leadId: string;
    conversationId: string;
    messageId: string | null;
    evidence: {
      id: string;
      signalType: BuyingSignalType;
      confidence: number;
      snippet: string;
      reason: string;
      createdAt: string;
    };
  };
}
```

```json
{
  "event": "sales_evidence.detected",
  "data": {
    "workspaceId": "e305e94e-2895-467b-99d6-c9bc65fe95f1",
    "leadId": "7b8e1a2f-5301-447a-8f3b-58bbdf138a01",
    "conversationId": "e1f2a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b",
    "messageId": "msg_89012345-6789-0123-4567-890123456789",
    "evidence": {
      "id": "9c8b7a6f-5e4d-3c2b-1a0f-9e8d7c6b5a4f",
      "signalType": "BUDGET_CONFIRMED",
      "confidence": 0.96,
      "snippet": "Our approved budget for this project is 25,000 USD.",
      "reason": "Customer confirmed explicit budget availability.",
      "createdAt": "2026-09-06T06:10:00.000Z"
    }
  }
}
```

---

#### D. `lead_score.updated`
```typescript
export interface LeadScoreUpdatedRealtimeEvent {
  event: 'lead_score.updated';
  data: {
    workspaceId: string;
    leadId: string;
    previousScore: number;
    newScore: number;
    grade: LeadGrade;
    delta: number;
    eventTrigger: ScoreTriggerEvent;
    calculatedAt: string;
  };
}
```

```json
{
  "event": "lead_score.updated",
  "data": {
    "workspaceId": "e305e94e-2895-467b-99d6-c9bc65fe95f1",
    "leadId": "7b8e1a2f-5301-447a-8f3b-58bbdf138a01",
    "previousScore": 60,
    "newScore": 85,
    "grade": "HOT",
    "delta": 25,
    "eventTrigger": "EVIDENCE_DETECTED",
    "calculatedAt": "2026-09-06T06:15:00.000Z"
  }
}
```

---

#### E. `copilot_suggestion.created`
```typescript
export interface CopilotSuggestionCreatedRealtimeEvent {
  event: 'copilot_suggestion.created';
  data: {
    workspaceId: string;
    conversationId: string;
    leadId: string | null;
    suggestion: {
      id: string;
      suggestionType: CopilotSuggestionType;
      content: string;
      actionPayload: Record<string, unknown>;
      confidence: number;
      createdAt: string;
    };
  };
}
```

```json
{
  "event": "copilot_suggestion.created",
  "data": {
    "workspaceId": "e305e94e-2895-467b-99d6-c9bc65fe95f1",
    "conversationId": "e1f2a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b",
    "leadId": "7b8e1a2f-5301-447a-8f3b-58bbdf138a01",
    "suggestion": {
      "id": "sug_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "suggestionType": "OBJECTION_HANDLING",
      "content": "I completely understand that migrating from your existing tool feels daunting. We provide a dedicated migration specialist and automated data sync that completes setup in under 48 hours with zero downtime.",
      "actionPayload": {
        "action": "INSERT_COMPOSER_DRAFT",
        "insertText": "I completely understand that migrating from your existing tool feels daunting. We provide a dedicated migration specialist and automated data sync that completes setup in under 48 hours with zero downtime."
      },
      "confidence": 0.92,
      "createdAt": "2026-09-06T08:35:00.000Z"
    }
  }
}
```

---

#### F. `copilot_suggestion.resolved`
```typescript
export interface CopilotSuggestionResolvedRealtimeEvent {
  event: 'copilot_suggestion.resolved';
  data: {
    workspaceId: string;
    conversationId: string;
    suggestionId: string;
    status: 'ACCEPTED' | 'DISMISSED' | 'EXPIRED';
    resolvedByUserId: string | null;
    resolvedAt: string;
  };
}
```

```json
{
  "event": "copilot_suggestion.resolved",
  "data": {
    "workspaceId": "e305e94e-2895-467b-99d6-c9bc65fe95f1",
    "conversationId": "e1f2a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b",
    "suggestionId": "sug_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "ACCEPTED",
    "resolvedByUserId": "4b5c6d7e-8f9a-0b1c-2d3e-4f5a6b7c8d9e",
    "resolvedAt": "2026-09-06T08:36:00.000Z"
  }
}
```
