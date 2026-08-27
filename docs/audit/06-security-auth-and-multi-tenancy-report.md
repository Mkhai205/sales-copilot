# Phase 6 — Security, Auth & Multi-Tenancy Audit Report

> **Document Status**: COMPLETED AUDIT REPORT  
> **Auditor**: Senior Backend Architect & Independent Code Reviewer  
> **Audit Phase**: Phase 6 — Security, Authentication, Authorization & Multi-Tenancy  
> **Target Scope**: Authentication Lifecycle (Argon2id, JWT, Token Rotation), Role-Based Access Control (`RolesGuard`), Multi-Tenancy (`WorkspaceGuard`), Secret Management & Encryption (`ChannelCredentialService`), Inbound Webhook Verification, CORS, Helmet, Throttling (`main.ts`, `apps/server/src/modules/auth/`, `apps/server/src/modules/workspaces/guards/`, `apps/server/src/integrations/`)  
> **Execution Date**: August 27, 2026

---

## 1. Executive Summary & Security Verdict

A comprehensive, defense-in-depth security audit was executed across all layers of the Sales Copilot backend. The audit evaluated identity verification, token lifecycle, tenant boundary enforcement, encryption at rest, webhook authenticity, and transport-level protections.

```text
                        SECURITY HEALTH SCORECARD
                                    │
       ┌────────────────────────────┼────────────────────────────┐
       ▼                            ▼                            ▼
AUTHENTICATION & HASHING      TENANT ISOLATION              SECRET MANAGEMENT
• Argon2id (OWASP Specs)      • WorkspaceGuard Robust       • AES-256-GCM Cryptography
• Redis Token Rotation (RFC)  • X-Workspace-Id Non-Spoofable• 🔴 Decrypted Plaintext Leak
• Atomic GETDEL Replay Check  • Last Owner Demote Guard     • 🔴 Impersonation on Send
```

### Key Security Strengths:
1. **Industry-Leading Password Hashing**: `PasswordService` uses Argon2id with OWASP-recommended parameters: 64 MB memory cost (`memoryCost: 65536`), 3 iterations (`timeCost: 3`), and 4 parallel threads.
2. **State-of-the-Art Refresh Token Rotation**: `TokenService` implements atomic `GETDEL` rotation in Redis with token families, short-lived revoked markers, and replay attack detection that revokes entire token families on suspicious reuse.
3. **Non-Spoofable Multi-Tenancy Guard**: `WorkspaceGuard` requires `X-Workspace-Id`, authenticates the user JWT, and queries the database (`workspaceMember.findUnique({ where: { workspaceId_userId } })`) before granting tenant access. Supplying arbitrary workspace IDs fails with `403 Forbidden`.
4. **Workspace Ownership Safeguards**: `WorkspacesService` strictly forbids removing or demoting the last `OWNER` of a workspace and prevents `ADMIN` from modifying or deleting `OWNER` accounts.
5. **Constant-Time Signature Verification on Facebook**: `FacebookAdapter` uses `crypto.timingSafeEqual` to compare HMAC-SHA256 signatures, preventing timing side-channel attacks.

### Critical Vulnerabilities & Security Risks Identified:
1. **Plaintext Channel Credentials Exposed to Read-Only Viewers & Agents (`FINDING-P6-01`)**: `GET /api/v1/inboxes/:id` is accessible to all workspace roles (including `AGENT` and `VIEWER`) and returns **decrypted plaintext API keys and access tokens** (Facebook Page Access Token, Telegram Bot Token, Webchat secrets). Violates `AGENTS.md` Section 5.
2. **Agent Impersonation via Mutable `senderId` in Message Creation (`FINDING-P6-02`)**: `MessagesController.create` and `MessagesService.create` allow any authenticated caller to supply an arbitrary colleague's `senderId`. An agent can forge messages and private notes under the identity of another agent or workspace owner.
3. **Unauthenticated Telegram Webhook Ingestion (`FINDING-P6-03`)**: In `TelegramAdapter.verifyWebhook`, if a webhook secret is not explicitly configured on the channel, the adapter returns `true` unconditionally, allowing any external actor to post forged Telegram updates. Furthermore, secret comparison uses `===` instead of constant-time comparison.
4. **Hardcoded Fallback Encryption Key (`FINDING-P6-04`)**: `ChannelCredentialService` silently defaults to a public static 64-character hex key if `CHANNEL_ENCRYPTION_KEY` is omitted from `.env`.
5. **Wildcard CORS with Credentials & Missing Helmet (`FINDING-P6-05`)**: `main.ts` configures `app.enableCors({ origin: corsOrigins || '*', credentials: true })`, violating W3C Fetch security standards. Helmet middleware is completely missing.
6. **Missing Brute-Force Rate Limiting on Login Endpoint (`FINDING-P6-06`)**: `POST /auth/login` uses the global rate limit (100 req/min) without tighter route throttling or account lockout protection.

---

## 2. Security Controls & OWASP Compliance Matrix

| Control Category | Standard / Best Practice | Codebase Implementation | Compliance | Audit Remarks |
| :--- | :--- | :--- | :---: | :--- |
| **Password Storage** | OWASP Password Storage (Argon2id, 64MB) | `PasswordService:9-14` | ✅ **Compliant** | Memory: 64MB, Iterations: 3, Parallelism: 4. |
| **Token Expiry** | Short-lived Access Token (15m) | `TokenService:26` (900s) | ✅ **Compliant** | 15 minutes identity-only JWT. |
| **Token Rotation** | RFC 6749 / OWASP OAuth 2.0 BCP | `TokenService:140-220` | ✅ **Compliant** | Atomic `GETDEL`, token family revocation on replay. |
| **Session Revocation** | Server-side logout revokes tokens | `TokenService:225-255` | ✅ **Compliant** | Purges Redis token keys on logout. |
| **Tenant Isolation** | Verified against DB membership | `WorkspaceGuard:53-59` | ✅ **Compliant** | Validates `workspaceId` + `userId` in database. |
| **Secret Protection** | Zero plaintext exposure in API | `InboxesService:83-91` | 🔴 **NON-COMPLIANT** | Plaintext credentials returned to Viewers & Agents (`FINDING-P6-01`). |
| **Impersonation Guard** | Caller identity strictly enforced | `MessagesService:77-99` | 🔴 **NON-COMPLIANT** | Accepts arbitrary `senderId` belonging to workspace (`FINDING-P6-02`). |
| **Webhook HMAC** | Timing-safe HMAC-SHA256 | `FacebookAdapter:266` | ✅ **Compliant** | Constant-time `crypto.timingSafeEqual`. |
| **Telegram Secret** | Secret token required & timing-safe | `TelegramAdapter:195-220` | 🔴 **NON-COMPLIANT** | Unauthenticated fallback + non-constant time comparison (`FINDING-P6-03`). |
| **Security Headers** | Helmet (CSP, HSTS, X-Frame-Options) | `main.ts` | 🔴 **NON-COMPLIANT** | Helmet not installed or configured (`FINDING-P6-05`). |
| **CORS Policy** | Whitelist domains; no wildcard with creds | `main.ts:17-20` | ⚠️ **Partial** | Wildcard `*` paired with `credentials: true`. |
| **Brute-Force Guard** | Strict rate limits on `/auth/login` | `AppModule:41-46` | ⚠️ **Partial** | Global 100 req/min; no login-specific throttle (`FINDING-P6-06`). |

---

## 3. Detailed Security Findings

### [FINDING-P6-01] Plaintext Channel Credentials Exposed to Read-Only Viewers & Agents

- **Severity**: **CRITICAL**
- **Category**: Sensitive Data Exposure & Authorization
- **Location**: `apps/server/src/modules/inboxes/inboxes.controller.ts:69-82`, `apps/server/src/modules/inboxes/inboxes.service.ts:83-92, 230-266`
- **Requirement Reference**: `AGENTS.md` Section 5 ("Data Security"), `BR-2.3`

#### 1. Evidence
In `apps/server/src/modules/inboxes/inboxes.controller.ts`:
```typescript
@Get(':id')
@HttpCode(HttpStatus.OK)
@Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER) // ❌ Open to VIEWER & AGENT
@ApiOperation({ summary: 'Get detailed inbox information including decrypted credentials' })
async getInbox(
  @CurrentWorkspace() context: WorkspaceContext,
  @Param('id') inboxId: string,
): Promise<InboxDetailDto> {
  return this.inboxesService.getInboxById(context.workspaceId, inboxId);
}
```

In `apps/server/src/modules/inboxes/inboxes.service.ts`:
```typescript
private mapChannelDetail(channel: any): ChannelDetailDto | null {
  if (!channel) return null;
  const summary = this.mapChannelSummary(channel);
  if (!summary) return null;

  return {
    ...summary,
    // ❌ Decrypts and embeds sensitive tokens in API response:
    credentials: this.decryptCredentials(channel.credentials),
  };
}
```

#### 2. Problem Description
`GET /api/v1/inboxes/:id` is accessible to every role in the workspace, including `AGENT` and `VIEWER`. The endpoint decrypts and returns the raw channel credentials dictionary:
- Facebook Page Access Tokens and App Secrets.
- Telegram Bot Tokens.
- WebChat API secrets and HMAC signing keys.

This is a direct violation of the mandatory multi-tenancy rule in `AGENTS.md` Section 5:
> *"Never log, print, or expose plaintext access tokens, webhook secrets, or API keys in logs or responses."*

#### 3. Impact Analysis
Any low-privileged user (such as a temporary support agent or read-only reporting viewer) can query `GET /api/v1/inboxes/:id` and extract high-privilege third-party tokens, enabling full impersonation of the organization's official Facebook Page or Telegram Bot.

#### 4. Expected Behavior
1. Channel credentials must **NEVER** be returned in full plaintext in read endpoints.
2. Inboxes returned by `GET /api/v1/inboxes/:id` should only return masked credentials (e.g. `{ hasCredentials: true, tokenPreview: "...abcd" }`).
3. If raw credential inspection is ever required, it must be isolated to a dedicated endpoint restricted strictly to `WorkspaceRole.OWNER` and audited in `AuditLog`.

#### 5. Recommended Fix
In `inboxes.service.ts`, replace `this.decryptCredentials` in `mapChannelDetail` with a masked summary:
```typescript
private mapChannelDetail(channel: any): ChannelDetailDto | null {
  if (!channel) return null;
  const summary = this.mapChannelSummary(channel);
  return {
    ...summary,
    credentials: {
      isConfigured: channel.isConnected,
      hasSecret: Boolean(channel.credentials?.encrypted),
    },
  };
}
```

#### 6. Verification Method
Log in as a user with `VIEWER` role, call `GET /api/v1/inboxes/:id`, and verify that `credentials` contains no plaintext tokens.

---

### [FINDING-P6-02] Agent Impersonation via Mutable `senderId` in Message Creation

- **Severity**: **HIGH**
- **Category**: Authorization & Identity Spoofing
- **Location**: `apps/server/src/modules/messages/messages.controller.ts:116-118`, `apps/server/src/modules/messages/messages.service.ts:77-99`
- **Requirement Reference**: `BR-5.1`, OWASP Top 10 Broken Access Control

#### 1. Evidence
In `apps/server/src/modules/messages/messages.controller.ts`:
```typescript
// Default senderId to authenticated user ID only if NOT supplied in body:
if (!payload.senderId && user?.userId) {
  payload.senderId = user.userId;
}

const validatedDto: CreateMessageDto = createMessageSchema.parse(payload);
return this.messagesService.create(context.workspaceId, conversationId, validatedDto, files);
```

In `apps/server/src/modules/messages/messages.service.ts`:
```typescript
} else if (senderType === SenderType.USER) {
  if (!dto.senderId) {
    throw new BadRequestException({ code: 'INVALID_SENDER', message: 'Sender ID is required...' });
  }

  // ❌ Only checks that the supplied senderId is A member of the workspace:
  const member = await client.workspaceMember.findFirst({
    where: {
      workspaceId,
      userId: dto.senderId,
    },
  });

  if (!member) {
    throw new BadRequestException({ code: 'INVALID_SENDER', message: 'Sender must be a valid member...' });
  }
  // ❌ Accepts dto.senderId without verifying that it matches the authenticated user:
  resolvedSenderId = dto.senderId;
}
```

#### 2. Problem Description
When an authenticated agent calls `POST /api/v1/conversations/:id/messages`, they can specify any arbitrary `senderId` in the JSON body.
`MessagesService.create` only checks that the user with `dto.senderId` exists in the workspace. It never verifies that `dto.senderId === authenticatedUser.userId`.

#### 3. Impact Analysis
Any agent in the workspace can author customer-facing messages or internal private notes under the identity of another agent, manager, or workspace owner. This creates severe non-repudiation and audit trail corruption risks.

#### 4. Expected Behavior
For `senderType === SenderType.USER`, `senderId` must always be forcibly overwritten with the authenticated user's ID (`user.userId`). Client-supplied `senderId` must be ignored or rejected if it doesn't match `user.userId`.

#### 5. Recommended Fix
In `MessagesController.create`, force `senderId` to the authenticated caller:
```typescript
if (user?.userId) {
  payload.senderId = user.userId;
}
```
And in `MessagesService.create`, pass the authenticated `actorUserId` to ensure `dto.senderId === actorUserId`.

#### 6. Verification Method
Authenticate as Agent Bob and call `POST /conversations/:id/messages` with `senderId: <AliceId>`. Verify that the API rejects the request with `403 Forbidden` or automatically sets `senderId = Bob`.

---

### [FINDING-P6-03] Unauthenticated Telegram Webhook Ingestion & Timing Attack

- **Severity**: **HIGH**
- **Category**: Webhook Security & Timing Attack
- **Location**: `apps/server/src/integrations/telegram/telegram.adapter.ts:191-220`
- **Requirement Reference**: `AGENTS.md` Section 5 ("Webhook Inbound Validation"), `NFR-4`

#### 1. Evidence
In `apps/server/src/integrations/telegram/telegram.adapter.ts`:
```typescript
verifyWebhook(
  request: WebhookVerificationRequest,
  credentials?: Record<string, unknown>,
): boolean {
  const configuredSecret =
    credentials?.webhookSecret || credentials?.secret_token || credentials?.secretToken;

  const secretHeader =
    request.headers['x-telegram-bot-api-secret-token'] ||
    request.headers['X-Telegram-Bot-Api-Secret-Token'];

  const secretTokenValue = Array.isArray(secretHeader) ? secretHeader[0] : secretHeader;

  // If secret configured, verify equality:
  if (configuredSecret && typeof configuredSecret === 'string') {
    if (!secretTokenValue) return false;
    // ❌ Vulnerability 1: Non-constant time string equality comparison
    return secretTokenValue === configuredSecret;
  }

  // If secret header passed without configured secret:
  if (secretTokenValue && !configuredSecret) return false;

  // ❌ Vulnerability 2: If NO secret configured on channel, returns TRUE unconditionally!
  return true;
}
```

#### 2. Problem Description
Two distinct security flaws exist in Telegram webhook authentication:
1. **Unauthenticated Default**: If an administrator connects a Telegram bot without explicitly populating `webhookSecret` in credentials, line 219 returns `true`. Any unauthenticated actor on the public internet who knows the channel UUID can submit arbitrary fake messages and fake sender payloads directly to `/api/v1/channels/:channelId/webhook`.
2. **Timing Side-Channel**: Line 210 uses standard JavaScript string comparison (`secretTokenValue === configuredSecret`), which terminates on the first mismatched byte, allowing attackers to measure response times and brute-force the secret token byte-by-byte.

#### 3. Impact Analysis
Attacker can inject forged customer conversations and fake support interactions into the agent inbox without possessing the Telegram bot token.

#### 4. Expected Behavior
1. Channels without a configured webhook secret must reject inbound webhook deliveries.
2. Secret comparison must use `crypto.timingSafeEqual`.

#### 5. Recommended Fix
Refactor `verifyWebhook` in `telegram.adapter.ts`:
```typescript
if (!configuredSecret || typeof configuredSecret !== 'string') {
  this.logger.warn('Telegram webhook rejected: Webhook secret is not configured');
  return false;
}

if (!secretTokenValue) return false;

const expectedBuffer = Buffer.from(configuredSecret);
const receivedBuffer = Buffer.from(secretTokenValue);

if (expectedBuffer.length !== receivedBuffer.length) {
  return false;
}

return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
```

#### 6. Verification Method
Send a POST request to a Telegram webhook endpoint without the `X-Telegram-Bot-Api-Secret-Token` header and verify that the request is rejected with `401 Unauthorized`.

---

### [FINDING-P6-04] Hardcoded Fallback Encryption Key in ChannelCredentialService

- **Severity**: **HIGH**
- **Category**: Cryptography & Key Management
- **Location**: `apps/server/src/modules/inboxes/channel-credential.service.ts:11-15`
- **Requirement Reference**: `BR-2.3`, `NFR-4`, `AGENTS.md` Section 5

#### 1. Evidence
In `apps/server/src/modules/inboxes/channel-credential.service.ts`:
```typescript
constructor(private readonly configService: ConfigService) {
  const rawKey =
    this.configService.get<string>('CHANNEL_ENCRYPTION_KEY') ||
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  this.encryptionKey = this.resolveKey(rawKey);
}
```

#### 2. Problem Description
If `CHANNEL_ENCRYPTION_KEY` is not explicitly set in the deployment environment variables, the system silently encrypts all channel credentials at rest using a publicly known static key (`0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef`).

#### 3. Impact Analysis
Anyone with database read access (e.g. compromised read replica, leaked database backup, or database analytics tool) can decrypt all third-party access tokens and API keys using the static key embedded in the repository source code.

#### 4. Expected Behavior
The backend should refuse to start up if `CHANNEL_ENCRYPTION_KEY` is missing or less than 32 bytes in length.

#### 5. Recommended Fix
Add `CHANNEL_ENCRYPTION_KEY` to the required environment schema in `apps/server/src/config/env.validation.ts`:
```typescript
CHANNEL_ENCRYPTION_KEY: z.string().min(32, 'CHANNEL_ENCRYPTION_KEY is required and must be at least 32 bytes'),
```
And remove the fallback string in `channel-credential.service.ts`.

#### 6. Verification Method
Remove `CHANNEL_ENCRYPTION_KEY` from `.env` and verify that the server fails to bootstrap with a clear configuration validation error.

---

### [FINDING-P6-05] Wildcard CORS with Credentials & Missing Helmet Middleware

- **Severity**: **MEDIUM**
- **Category**: Transport Security & Browser Protection
- **Location**: `apps/server/src/main.ts:16-20`
- **Requirement Reference**: OWASP Secure Headers & CORS Guidelines

#### 1. Evidence
In `apps/server/src/main.ts`:
```typescript
const corsOrigins = configService.get<string | string[]>('CORS_ORIGIN');
app.enableCors({
  origin: corsOrigins || '*',
  credentials: true, // ❌ Wildcard with credentials is an invalid/insecure CORS config
});
```

#### 2. Problem Description
1. Under the W3C Fetch specification, setting `Access-Control-Allow-Origin: *` while simultaneously setting `Access-Control-Allow-Credentials: true` is forbidden. Browsers will reject authenticated CORS requests with an error: *"The value of the 'Access-Control-Allow-Origin' header in the response must not be the wildcard '*' when the request's credentials mode is 'include'"*.
2. Helmet middleware (`helmet()`) is completely missing from `main.ts`. The backend omits crucial security headers:
   - `Strict-Transport-Security` (HSTS)
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: SAMEORIGIN` / `DENY`
   - `Content-Security-Policy` (CSP)

#### 3. Impact Analysis
- Frontend web applications using credentials/cookies fail to connect if `CORS_ORIGIN` is not defined in `.env`.
- Missing security headers leaves the application vulnerable to clickjacking and MIME-type confusion attacks.

#### 4. Expected Behavior
1. If `CORS_ORIGIN` is undefined in development, reflect the request origin dynamically instead of using wildcard `*` with credentials.
2. Enable `helmet()` globally in `main.ts`.

#### 5. Recommended Fix
In `main.ts`:
```typescript
import helmet from 'helmet';

// ...
app.use(helmet());

const corsOrigin = configService.get<string>('CORS_ORIGIN');
app.enableCors({
  origin: corsOrigin ? corsOrigin.split(',') : true, // reflects request origin in development
  credentials: true,
});
```

#### 6. Verification Method
Inspect HTTP response headers with `curl -I http://localhost:3000/api/v1/workspaces` and verify that `X-Frame-Options`, `X-Content-Type-Options`, and `Strict-Transport-Security` are present.

---

### [FINDING-P6-06] Missing Brute-Force Rate Limiting on Login Endpoint

- **Severity**: **MEDIUM**
- **Category**: Authentication & Denial of Service
- **Location**: `apps/server/src/app.module.ts:41-46`, `apps/server/src/modules/auth/auth.controller.ts:25-33`
- **Requirement Reference**: OWASP Authentication Guidelines

#### 1. Evidence
In `apps/server/src/app.module.ts`:
```typescript
ThrottlerModule.forRoot([
  {
    ttl: 60_000,
    limit: 100, // Global 100 requests per minute
  },
]),
```
In `apps/server/src/modules/auth/auth.controller.ts`:
```typescript
@Post('login')
@HttpCode(HttpStatus.OK)
// ❌ No @Throttle override on login endpoint!
async login(@ZodBody(loginSchema) dto: LoginDto): Promise<LoginResponseDto> {
  return this.authService.login(dto);
}
```

#### 2. Problem Description
The global rate limiter allows 100 requests per 60 seconds per IP across all routes.
The login endpoint (`POST /api/v1/auth/login`) does not override this limit with a dedicated, stricter policy. An attacker can launch 100 password guesses per minute per IP without triggering rate-limiting blocks.

#### 3. Impact Analysis
Exposes user accounts to credential stuffing and dictionary attacks against weak passwords.

#### 4. Expected Behavior
The login endpoint should be restricted to a maximum of 5 to 10 attempts per minute per IP using `@Throttle({ default: { limit: 5, ttl: 60000 } })`.

#### 5. Recommended Fix
Add `@Throttle` decorator to `AuthController.login`:
```typescript
@Throttle({ default: { limit: 5, ttl: 60000 } })
@Post('login')
async login(@ZodBody(loginSchema) dto: LoginDto) { ... }
```

#### 6. Verification Method
Send 6 rapid login attempts within 60 seconds and verify that the 6th request is rejected with `429 Too Many Requests`.

---

## 4. Phase 6 Security Sign-Off Assessment

| Dimension | Standard | Audit Result | Status |
| :--- | :--- | :--- | :---: |
| **Password Security** | Argon2id with 64MB memory cost | 100% OWASP compliant. | ✅ **Pass** |
| **Token Architecture** | JWT + Redis Rotation + Replay Guard | Atomic `GETDEL` & token family tracking. | ✅ **Pass** |
| **Tenant Isolation** | Verified against DB membership | `WorkspaceGuard` prevents header spoofing. | ✅ **Pass** |
| **Secret Protection** | Zero plaintext credentials in responses | Decrypted credentials returned in `GET /inboxes/:id` (`FINDING-P6-01`). | 🔴 **Critical Action Required** |
| **Identity Integrity** | Prevent sender spoofing | Sender ID spoofable in `POST /messages` (`FINDING-P6-02`). | 🔴 **Critical Action Required** |
| **Webhook Security** | HMAC verification & timing-safe compare | Telegram unauthenticated fallback (`FINDING-P6-03`). | 🔴 **Critical Action Required** |
| **Transport Security** | CORS & Helmet headers | Helmet missing; wildcard CORS with credentials (`FINDING-P6-05`). | 🟡 **Needs Hardening** |

### Summary Recommendation for Phase 6:
While core authentication (Argon2id, JWT, Token Rotation) and tenant guard isolation are exceptionally robust, three **Critical/High security vulnerabilities** must be resolved before production deployment:
1. Mask or strip credentials in `GET /api/v1/inboxes/:id`.
2. Restrict `senderId` to the authenticated caller in `MessagesController.create`.
3. Require webhook secret and use `crypto.timingSafeEqual` in `TelegramAdapter.verifyWebhook`.
4. Enforce mandatory `CHANNEL_ENCRYPTION_KEY` in environment validation.
