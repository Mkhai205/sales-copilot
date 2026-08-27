# Phase 4 — Database & Persistence Audit Report

> **Document Status**: COMPLETED AUDIT REPORT  
> **Auditor**: Senior Backend Architect & Independent Code Reviewer  
> **Audit Phase**: Phase 4 — Database, Persistence, & Transactions  
> **Target Scope**: PostgreSQL 16 Schema (`prisma/schema.prisma`), Foreign Key Cascade Rules, Index Coverage & Query Optimization, N+1 Query Risks, Transaction Atomicity & Concurrency (`apps/server/src/infrastructure/database/`, `apps/server/src/modules/`)  
> **Execution Date**: August 27, 2026

---

## 1. Executive Summary & Persistence Verdict

A comprehensive deep-dive database audit was performed across the PostgreSQL 16 schema, Prisma configuration, connection pooling (`pg` Pool with `PrismaPg` adapter), transactional boundaries (`AsyncLocalStorage` transaction context in `PrismaService`), query execution paths, and concurrency controls.

```text
                     DATABASE & PERSISTENCE HEALTH MATRIX
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
  SCHEMA & MIGRATIONS           TRANSACTION ATOMICITY         INDEXES & EFFICIENCY
  • 21 Normalized Models        • ALS Ambient Tx Working      • Critical Indexes Missing
  • PrismaPg Pool Configured    • Postgres Abort Bug on Retry • Full Table Scans on Merge
  • Cascade Retention Risks     • Webhook Race Condition      • Global Seq Leaks Volume
```

### Key Findings Summary:
1. **Critical PostgreSQL Transaction Abort Bug (`FINDING-P4-01`)**: In `WorkspacesService.createWorkspace`, slug collision retries are executed inside an active database transaction. In real PostgreSQL, any statement that violates a unique constraint (`P2002`) permanently places the transaction into an `ABORTED` state (`25P02`), causing subsequent loop iterations to unconditionally crash.
2. **Dangerous Cascade Deletion on Contact (`FINDING-P4-02`)**: `Conversation` defines `onDelete: Cascade` on `contactId`. Deleting a contact irreversibly purges entire conversation, message, and attachment records without soft-deletion, and leaves physical files orphaned on MinIO S3.
3. **Global Scan & In-Memory Decryption Bottleneck (`FINDING-P4-03`)**: In `WebChatController.resolveChannelByToken`, when a direct lookup by `providerAccountId` fails, the system executes `channel.findMany({ where: { channelType: 'WEB_CHAT' } })` across all tenants in the entire database, looping and decrypting credentials in memory.
4. **Missing Crucial Database Indexes (`FINDING-P4-04`)**:
   - `Message`: Missing index on `[workspaceId, senderId]`, resulting in a full table scan across millions of messages during Contact Merging.
   - `InboxMember` & `TeamMember`: Missing index on `userId` (only compound unique index `[inboxId, userId]` exists), preventing index scans when finding inboxes/teams by agent.
   - `Conversation`: Missing indexes on `[workspaceId, teamId]` and `[workspaceId, priority]`.
5. **Concurrent Webhook Race Condition (`FINDING-P4-05`)**: Check-then-act pattern in `WebhooksService` throws unhandled Prisma `P2002` on duplicate deliveries, failing with HTTP 500 instead of returning HTTP 200 duplicate response.
6. **N+1 Sequential Query Loop in Label Assignment (`FINDING-P4-06`)**: `ConversationsService.assignLabels` executes individual `findUnique` and `create` queries inside a JavaScript `for` loop instead of `createMany({ skipDuplicates: true })`.
7. **Cross-Tenant Volume Leakage via Global Autoincrement (`FINDING-P4-07`)**: `Conversation.displayId` uses a global Postgres sequence instead of per-workspace numbering, exposing platform-wide metrics and creating non-contiguous ticket numbers.

---

## 2. Relational Schema & Cascade Strategy Evaluation

### 2.1. Foreign Key Referential Actions Matrix

| Relation / Foreign Key | Parent Table | Child Table | Referential Action | Audit Evaluation & Risk |
| :--- | :--- | :--- | :---: | :--- |
| `Conversation.contactId` | `Contact` | `Conversation` | `Cascade` | 🔴 **CRITICAL RISK**: Deleting a contact deletes all customer conversations and messages. Should be `Restrict` or soft-deleted. |
| `Message.conversationId` | `Conversation` | `Message` | `Cascade` | 🟢 **Acceptable**: Messages belong strictly to a conversation aggregate. |
| `Attachment.messageId` | `Message` | `Attachment` | `Cascade` | 🟡 **Storage Leak**: Database metadata is deleted, but MinIO S3 files are not cleaned up. |
| `Conversation.assigneeId` | `User` | `Conversation` | `SetNull` | 🟢 **Correct**: Deleting a user unassigns them without destroying ticket data. |
| `Conversation.teamId` | `Team` | `Conversation` | `SetNull` | 🟢 **Correct**: Deleting a team clears assignment without deleting conversations. |
| `ConversationLabel.conversationId` | `Conversation` | `ConversationLabel` | `Cascade` | 🟢 **Correct**: Junction records cleaned up. |
| `ConversationLabel.labelId` | `Label` | `ConversationLabel` | `Cascade` | 🟢 **Correct**: Removing a label cleans up conversation associations. |
| `Workspace.id` | `Workspace` | Operational tables | `Cascade` | 🟢 **Correct**: Hard deletion of workspace cleans tenant data. |
| `AuditLog.workspaceId` | `Workspace` | `AuditLog` | `SetNull` | 🟡 **Compliance Question**: Retains orphaned logs with `workspaceId = null` when a tenant is removed. |

---

## 3. Database Indexing & Query Efficiency Audit

### 3.1. Index Coverage Analysis Table

| Model | Existing Indexes / Constraints | Missing Critical Indexes | Query Impact / Risk |
| :--- | :--- | :--- | :--- |
| **`Message`** | `@@unique([conversationId, externalId])`<br>`@@index([conversationId, createdAt])`<br>`@@index([workspaceId, externalId])` | **`@@index([workspaceId, senderType, senderId])`** | **CRITICAL FULL TABLE SCAN**: During Contact Merge (`ContactMergeService.merge`), `updateMany` updates all messages where `senderId = mergeeId`. Without an index on `senderId`, Postgres must scan every row in `messages`. |
| **`InboxMember`** | `@@unique([inboxId, userId])` | **`@@index([userId])`** | Looking up all inboxes an agent belongs to requires a Seq Scan because `userId` is the second column in the composite index. |
| **`TeamMember`** | `@@unique([teamId, userId])` | **`@@index([userId])`** | Looking up all teams an agent belongs to requires a Seq Scan. |
| **`Conversation`** | `@@unique([workspaceId, displayId])`<br>`@@index([workspaceId, status])`<br>`@@index([workspaceId, assigneeId])`<br>`@@index([workspaceId, contactId])`<br>`@@index([workspaceId, inboxId])`<br>`@@index([workspaceId, lastActivityAt])` | **`@@index([workspaceId, teamId])`**<br>**`@@index([workspaceId, priority])`**<br>**`@@index([workspaceId, status, lastActivityAt])`** | Filtering by `teamId` or `priority` in the conversation inbox view causes Seq Scans. Filtering by `status` and sorting by `lastActivityAt` cannot utilize a single index. |
| **`AuditLog`** | `@@index([workspaceId, createdAt])`<br>`@@index([resourceType, resourceId])` | **`@@index([userId])`** | Security investigations filtering audit trails by actor/user trigger Seq Scans. |
| **`Channel`** | `@@unique([workspaceId, channelType, providerAccountId])`<br>`@@index([workspaceId, channelType])` | None | Well-indexed for tenant lookups. |

---

## 4. Detailed Database Findings

### [FINDING-P4-01] PostgreSQL Transaction Abort Bug in Workspace Slug Collision Retry

- **Severity**: **CRITICAL**
- **Category**: Transactions & Database Consistency
- **Location**: `apps/server/src/modules/workspaces/workspaces.service.ts:38-57, 407-436`
- **Requirement Reference**: `NFR-3`, ACID Transaction Standards

#### 1. Evidence
In `apps/server/src/modules/workspaces/workspaces.service.ts`:
```typescript
async createWorkspace(userId: string, dto: CreateWorkspaceDto): Promise<WorkspaceDto> {
  const baseSlug = dto.slug ? generateSlug(dto.slug) : generateSlug(dto.name);

  // 1. Transaction opened via PrismaService ALS context
  const created = await this.prisma.runInTransaction(async () => {
    const client = this.prisma.client;

    // 2. Calls helper with collision retry loop INSIDE the transaction
    const workspace = await this.createWorkspaceWithUniqueSlug(client, { ... });

    await client.workspaceMember.create({ ... });
    return workspace;
  });
  return this.mapToDto(created);
}

private async createWorkspaceWithUniqueSlug(
  client: ReturnType<PrismaService['getClient']>,
  data: { name: string; baseSlug: string; timezone: string; defaultLanguage: string },
): Promise<Workspace> {
  const attemptCreate = (slug: string) => client.workspace.create({ ... });

  // First attempt
  try {
    return await attemptCreate(baseSlug);
  } catch (err: any) {
    if (err?.code !== 'P2002') throw err; // Catches TypeScript error
  }

  // Retry loop on collision
  for (let i = 2; i <= 20; i++) {
    try {
      return await attemptCreate(`${baseSlug}-${i}`); // ❌ Fails unconditionally in real Postgres!
    } catch (err: any) {
      if (err?.code !== 'P2002') throw err;
    }
  }
  return attemptCreate(`${baseSlug}-${Date.now().toString(36)}`);
}
```

#### 2. Problem Description
In PostgreSQL, whenever a statement inside a transaction block fails (such as throwing `23505: duplicate key value violates unique constraint`), the entire PostgreSQL transaction is immediately placed in an **aborted state**:
```text
ERROR: 25P02: current transaction is aborted, commands ignored until end of transaction block
```
Even though the TypeScript code catches the error (`err?.code === 'P2002'`) and attempts to execute `attemptCreate(`${baseSlug}-2`)`, PostgreSQL refuses to execute any further commands on that connection. The subsequent query immediately crashes with error code `25P02`.
*Why did unit tests pass?* Unit tests mocked `client.workspace.create` to reject once and resolve on the second attempt. In real PostgreSQL with Prisma, this retry logic fails 100% of the time on slug collisions.

#### 3. Impact Analysis
Any workspace creation that encounters an existing slug will crash with an unhandled 500 internal server error instead of appending `-2` or `-3` as intended.

#### 4. Expected Behavior
Slug resolution must either:
1. Be resolved *before* entering the transaction (querying existing slugs or generating a unique nano-id/timestamp suffix), OR
2. Use PostgreSQL Savepoints (`SAVEPOINT`), which Prisma interactive transactions do not natively expose.

#### 5. Recommended Fix
Pre-generate a collision-resistant unique slug before invoking `this.prisma.runInTransaction`:
```typescript
const uniqueSlug = await this.resolveAvailableSlug(baseSlug);
const created = await this.prisma.runInTransaction(async () => {
  const workspace = await client.workspace.create({ data: { ...dto, slug: uniqueSlug } });
  await client.workspaceMember.create({ ... });
  return workspace;
});
```

#### 6. Verification Method
Run an integration test against a live PostgreSQL container where two workspaces with identical names are created concurrently. Verify that the second workspace successfully saves with slug `${name}-2`.

---

### [FINDING-P4-02] Dangerous Cascade Delete on Contact Destroying Entire Conversation & Message Histories

- **Severity**: **CRITICAL**
- **Category**: Data Integrity & Retention
- **Location**: `apps/server/prisma/schema.prisma:326`, `apps/server/src/modules/contacts/contacts.service.ts:346-378`
- **Requirement Reference**: `BR-3.3`, `BR-4.1`

#### 1. Evidence
In `apps/server/prisma/schema.prisma`:
```prisma
model Conversation {
  id String @id @default(uuid())
  ...
  contactId String
  contact   Contact @relation(fields: [contactId], references: [id], onDelete: Cascade) // ❌ Cascade delete
  ...
}

model Message {
  id String @id @default(uuid())
  conversationId String
  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  ...
}
```
In `apps/server/src/modules/contacts/contacts.service.ts`:
```typescript
async delete(workspaceId: string, contactId: string): Promise<{ success: boolean }> {
  // ...
  await client.contact.delete({
    where: { id: contactId },
  });
  // ❌ Automatically deletes all Conversations, Messages, and Attachments in DB
  // ❌ Does NOT delete physical files from MinIO S3
}
```

#### 2. Problem Description
Because `Conversation.contact` has `onDelete: Cascade`, if an agent or administrator deletes a contact record:
1. PostgreSQL immediately cascade-deletes all conversations associated with that contact.
2. It cascade-deletes all messages inside those conversations.
3. It cascade-deletes all attachment metadata.
4. **Physical file leak**: The actual files (images, PDFs, voice notes) in MinIO S3 are never deleted because `StorageService` is not notified, creating permanently orphaned storage artifacts.
5. In enterprise customer support / CRM platforms, conversation history is a legal audit trail. Deleting a contact should never silently erase tickets and audit histories.

#### 3. Impact Analysis
Catastrophic accidental data loss. A single call to `DELETE /api/v1/contacts/:id` permanently obliterates customer communication history across all channels.

#### 4. Expected Behavior
- Either enforce `onDelete: Restrict` on `Conversation.contactId` so contacts with existing conversations cannot be deleted without archiving them, OR
- Implement soft-delete (`deletedAt DateTime?`) on `Contact`, keeping conversation records intact.

#### 5. Recommended Fix
Change `onDelete: Cascade` to `onDelete: Restrict` in `schema.prisma`:
```prisma
contact Contact @relation(fields: [contactId], references: [id], onDelete: Restrict)
```
In `ContactsService.delete`, verify that the contact has no active conversations before deletion, or soft-delete the contact.

#### 6. Verification Method
Attempt to delete a contact with an active conversation and verify that the database prevents the deletion and returns a clear conflict error.

---

### [FINDING-P4-03] Global Scan & In-Memory Decryption Bottleneck in `resolveChannelByToken`

- **Severity**: **HIGH**
- **Category**: Query Performance & Data Isolation
- **Location**: `apps/server/src/integrations/web-chat/web-chat.controller.ts:314-338`
- **Requirement Reference**: `NFR-1`, `NFR-4`, `AGENTS.md` Section 5

#### 1. Evidence
In `apps/server/src/integrations/web-chat/web-chat.controller.ts`:
```typescript
private async resolveChannelByToken(token: string) {
  const client = this.prisma.getClient();

  // 1. Direct match by providerAccountId
  const directMatch = await client.channel.findFirst({
    where: { channelType: ChannelType.WEB_CHAT, providerAccountId: token },
    include: { inbox: true },
  });
  if (directMatch) return directMatch;

  // 2. ❌ Query all WEB_CHAT channels across ALL tenants and decrypt in memory:
  const webChatChannels = await client.channel.findMany({
    where: { channelType: ChannelType.WEB_CHAT },
    include: { inbox: true },
  });

  for (const chan of webChatChannels) {
    const creds = this.decryptCredentials(chan.credentials);
    const chanToken =
      (creds.widgetToken as string) ||
      (creds.website_token as string) ||
      (creds.token as string) ||
      chan.providerAccountId;

    if (chanToken === token) return chan;
  }
  return null;
}
```

#### 2. Problem Description
If a webchat visitor arrives with a token that doesn't match `providerAccountId` directly:
- The controller issues a database query fetching **every single web chat channel across all tenants in the platform**.
- It deserializes and loops through every record, performing an **AES-256-GCM decryption** operation in a synchronous loop on the Node.js event loop thread.
- This creates both a **severe denial-of-service vector** and a **multi-tenant data leakage risk** (tenant credentials from other workspaces are loaded into memory on unauthenticated public requests).

#### 3. Impact Analysis
In a production platform with 5,000 tenants, an unauthenticated attacker could trigger 100 requests per second to `/widget/config?token=invalid`, causing 500,000 AES decrypt operations and completely freezing the backend server.

#### 4. Expected Behavior
Webchat channels must always index their public token in `providerAccountId`. Lookups must be an exact single-row indexed query:
`client.channel.findFirst({ where: { channelType: 'WEB_CHAT', providerAccountId: token } })`.

#### 5. Recommended Fix
1. Ensure `providerAccountId` is strictly populated with the `widgetToken` upon channel creation.
2. Completely remove the fallback `findMany` loop from `WebChatController`.

#### 6. Verification Method
Verify that `findMany` is absent from `web-chat.controller.ts` and all channel token lookups use indexed `findFirst`.

---

### [FINDING-P4-04] Missing Crucial Database Indexes Causing Full Table Scans

- **Severity**: **HIGH**
- **Category**: Database Performance & Indexing
- **Location**: `apps/server/prisma/schema.prisma:355-379, 253-264, 287-299, 304-340, 488-505`
- **Requirement Reference**: `NFR-1`

#### 1. Evidence
In `apps/server/src/modules/contacts/contact-merge.service.ts`:
```typescript
// During contact merge:
await tx.message.updateMany({
  where: {
    workspaceId,
    senderType: 'CONTACT',
    senderId: mergeeContactId, // ❌ No index on senderId in messages table!
  },
  data: { senderId: baseContactId },
});
```
In `apps/server/prisma/schema.prisma`:
```prisma
model Message {
  ...
  senderId String?
  ...
  @@unique([conversationId, externalId])
  @@index([conversationId, createdAt])
  @@index([workspaceId, externalId])
  // ❌ Missing @@index([workspaceId, senderType, senderId])
}

model InboxMember {
  inboxId String
  userId String
  @@unique([inboxId, userId])
  // ❌ Missing @@index([userId])
}

model TeamMember {
  teamId String
  userId String
  @@unique([teamId, userId])
  // ❌ Missing @@index([userId])
}

model Conversation {
  ...
  teamId String?
  priority ConversationPriority
  // ❌ Missing @@index([workspaceId, teamId])
  // ❌ Missing @@index([workspaceId, priority])
}
```

#### 2. Problem Description
Several high-traffic or frequent lookup fields lack backing indexes:
1. `messages.senderId`: Updating or querying messages by sender during Contact Merge triggers a **Seq Scan on the entire `messages` table**.
2. `inbox_members.userId` and `team_members.userId`: Checking which inboxes or teams a user belongs to cannot use the composite index `(inboxId, userId)` because `userId` is not the leading column.
3. `conversations.teamId` & `conversations.priority`: Filtering conversations by team or priority results in full workspace table scans.

#### 3. Impact Analysis
As message volume reaches millions of rows, Contact Merge operations will hold database locks for seconds, causing lock contention, query timeouts, and slow user inbox loading.

#### 4. Expected Behavior
Every foreign key and frequently filtered column must be backed by a composite index prefixed with `workspaceId` (or single index on junction tables).

#### 5. Recommended Fix
Add the following indexes to `schema.prisma`:
```prisma
// In Message:
@@index([workspaceId, senderType, senderId])

// In InboxMember:
@@index([userId])

// In TeamMember:
@@index([userId])

// In Conversation:
@@index([workspaceId, teamId])
@@index([workspaceId, priority])
@@index([workspaceId, status, lastActivityAt(sort: Desc)])
```

#### 6. Verification Method
Run `EXPLAIN ANALYZE` on `SELECT * FROM messages WHERE workspace_id = $1 AND sender_type = 'CONTACT' AND sender_id = $2` and verify it uses an `Index Scan`.

---

### [FINDING-P4-05] Concurrent Webhook Ingestion Check-then-Act Race Condition (`P2002`)

- **Severity**: **HIGH**
- **Category**: Concurrency & Idempotency
- **Location**: `apps/server/src/modules/webhooks/webhooks.service.ts:196-224`
- **Requirement Reference**: `BR-2.2`, `NFR-3`

#### 1. Evidence
In `apps/server/src/modules/webhooks/webhooks.service.ts`:
```typescript
// 5. Deduplication check (Idempotency)
const existingEvent = await client.channelEvent.findUnique({
  where: {
    channelId_externalEventId: { channelId, externalEventId },
  },
});

if (existingEvent) {
  return { success: true, eventId: existingEvent.id, duplicated: true };
}

// 6. Persist ChannelEvent
const channelEvent = await client.channelEvent.create({
  data: { channelId, externalEventId, ... },
});
```

#### 2. Problem Description
Between `findUnique` and `create`, there is no transaction lock or atomic upsert. When third-party webhook dispatchers (e.g. Facebook Graph API retrying upon minor network latency) send two identical webhook payloads concurrently:
1. Both requests execute `findUnique` simultaneously; both find `null`.
2. Request 1 executes `create` and succeeds.
3. Request 2 executes `create` and throws a database unique constraint violation: `PrismaClientKnownRequestError: Unique constraint failed on the fields: (channelId, externalEventId) (P2002)`.
4. Because this exception is unhandled, Request 2 crashes with `500 Internal Server Error`. External webhooks receive HTTP 500 and initiate failure escalation.

#### 3. Impact Analysis
Spurious 500 errors on high-throughput webhook endpoints and potential webhook disabling by external platforms.

#### 4. Expected Behavior
The service should handle duplicate concurrent deliveries gracefully by intercepting `P2002` and treating it as a successful duplicate delivery (`{ success: true, duplicated: true }`).

#### 5. Recommended Fix
Wrap `channelEvent.create` in a try-catch block:
```typescript
try {
  const channelEvent = await client.channelEvent.create({ ... });
  // enqueue job
} catch (err: any) {
  if (err?.code === 'P2002') {
    this.logger.log(`Concurrent duplicate event '${externalEventId}' caught via unique constraint.`);
    return { success: true, duplicated: true };
  }
  throw err;
}
```

#### 6. Verification Method
Simulate two concurrent identical `POST /api/v1/channels/:id/webhook` requests using `Promise.all` and verify both return HTTP 200 OK.

---

### [FINDING-P4-06] N+1 Sequential Query Loop in Label Assignment

- **Severity**: **MEDIUM**
- **Category**: Query Performance
- **Location**: `apps/server/src/modules/conversations/conversations.service.ts:689-707`
- **Requirement Reference**: `NFR-1`

#### 1. Evidence
In `apps/server/src/modules/conversations/conversations.service.ts`:
```typescript
// 3. Idempotent create junction records
for (const labelId of labelIds) {
  const existing = await client.conversationLabel.findUnique({
    where: {
      conversationId_labelId: { conversationId, labelId },
    },
  });

  if (!existing) {
    await client.conversationLabel.create({
      data: { conversationId, labelId },
    });
  }
}
```

#### 2. Problem Description
Assigning $N$ labels to a conversation generates up to $2N$ sequential SQL roundtrips to PostgreSQL (`findUnique` followed by `create` in a loop). For a conversation updated with 5 labels, this causes 10 database queries where 1 query would suffice.

#### 3. Impact Analysis
Unnecessary database latency and connection pool starvation during bulk label tagging operations.

#### 4. Expected Behavior
Use PostgreSQL's native atomic batch insert with duplicate skipping:
```typescript
await client.conversationLabel.createMany({
  data: labelIds.map(labelId => ({ conversationId, labelId })),
  skipDuplicates: true,
});
```

#### 5. Recommended Fix
Replace the loop in lines 689–707 with a single `createMany` statement.

#### 6. Verification Method
Assign 5 labels and inspect Prisma query logs to verify that exactly one `INSERT INTO conversation_labels ... ON CONFLICT DO NOTHING` statement is executed.

---

### [FINDING-P4-07] Cross-Tenant Information Leakage via Global Autoincrement `displayId`

- **Severity**: **MEDIUM**
- **Category**: Multi-Tenancy & Data Privacy
- **Location**: `apps/server/prisma/schema.prisma:306, 333`
- **Requirement Reference**: `docs/04-data-and-security.md` Section 1.1

#### 1. Evidence
In `apps/server/prisma/schema.prisma`:
```prisma
model Conversation {
  id String @id @default(uuid())
  displayId Int @default(autoincrement()) // ❌ Global Postgres sequence
  workspaceId String
  ...
  @@unique([workspaceId, displayId])
}
```

#### 2. Problem Description
In PostgreSQL, `Int @default(autoincrement())` creates a single global database sequence: `conversations_displayId_seq`.
1. **Business Discrepancy**: If Tenant A creates a conversation, its ID is `#1`. If Tenant B creates a conversation next, its ID is `#2`. When Tenant A creates their second conversation, its ID is `#3`. A tenant's ticket numbering has arbitrary gaps.
2. **Business Intelligence Leakage**: A competitor with two test accounts can register Tenant 1 on Day 1 (getting `#100`) and Tenant 2 on Day 30 (getting `#5000`), immediately calculating exact platform-wide conversation volume (4,900 conversations) during that period.

#### 3. Impact Analysis
Violates customer expectation of clean, sequential per-workspace ticket numbers (`#1, #2, #3...`), and exposes platform transaction volume.

#### 4. Expected Behavior
Per-workspace incremental counter (e.g. tracking `lastConversationDisplayId` on the `Workspace` model and incrementing within a transaction or using a Redis atomic counter).

#### 5. Recommended Fix
Store `conversationDisplayCounter Int @default(0)` on `Workspace`. When creating a conversation inside a transaction:
```typescript
const ws = await tx.workspace.update({
  where: { id: workspaceId },
  data: { conversationDisplayCounter: { increment: 1 } },
  select: { conversationDisplayCounter: true },
});
const displayId = ws.conversationDisplayCounter;
```

#### 6. Verification Method
Verify that two different workspaces each have conversations starting at `#1`.

---

## 5. Phase 4 Database Sign-Off Assessment

| Dimension | Standard | Audit Result | Status |
| :--- | :--- | :--- | :---: |
| **Transaction Atomicity** | ACID guarantees across multi-step mutations | Failed on slug retry (`FINDING-P4-01`). | 🔴 **Critical Action Required** |
| **Data Retention & Integrity** | No accidental destruction of business records | Failed on contact cascade delete (`FINDING-P4-02`). | 🔴 **Critical Action Required** |
| **Index Coverage** | No Seq Scans on high-volume queries | Missing indexes on `Message.senderId`, `Members.userId`. | 🟡 **Needs Index Addition** |
| **Concurrency & Idempotency** | No unhandled race condition crashes | Failed on concurrent webhooks (`FINDING-P4-05`). | 🟡 **Needs Try-Catch Guard** |
| **Multi-Tenant Data Isolation** | Tenant isolation at database level | Global scan in WebChat controller (`FINDING-P4-03`). | 🔴 **Critical Action Required** |

### Summary Recommendation for Phase 4:
The database architecture has a solid foundation (clean relational normalization, pooled connections via `PrismaPg`, and ambient transactions via `AsyncLocalStorage`). 

However, three **Critical/High priority persistence defects** require immediate remediation in **Phase 10 (Hardening Sprint)**:
1. Fix the transaction abort bug in `createWorkspaceWithUniqueSlug`.
2. Change `onDelete: Cascade` to `onDelete: Restrict` on `Conversation.contact`.
3. Eliminate the global `findMany` scan in `WebChatController.resolveChannelByToken`.
4. Add the missing database indexes on `messages(workspaceId, senderType, senderId)` and junction tables.
