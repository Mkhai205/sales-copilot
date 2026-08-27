# Phase 7 — Realtime, WebSocket & Queue Processing Audit Report

> **Document Status**: COMPLETED AUDIT REPORT  
> **Auditor**: Senior Backend Architect & Independent Code Reviewer  
> **Audit Phase**: Phase 7 — Realtime Gateway, WebChat Gateway, Redis Clustering & BullMQ Queue Processing  
> **Target Scope**: Realtime Gateway (`/realtime`), Web Chat Gateway (`/widget`), Presence Service, Redis Pub/Sub Adapter, Outbound Dispatchers, BullMQ Processors (`channel-ingestion`, `webhook-delivery`)  
> **Execution Date**: August 27, 2026

---

## 1. Executive Summary & Realtime Infrastructure Verdict

A rigorous architectural and runtime audit was conducted across the realtime communication systems, WebSocket gateways, and background queue workers of the Sales Copilot backend monolith.

```text
                     REALTIME & QUEUE HEALTH SCORECARD
                                    │
       ┌────────────────────────────┼────────────────────────────┐
       ▼                            ▼                            ▼
  AGENT REALTIME GATEWAY       VISITOR WEBCHAT GATEWAY       BULLMQ QUEUE SYSTEM
  • Socket.io Redis Adapter OK • 🔴 No Redis Adapter (Local) • 3-Tier Backoff Working
  • Tenant Room Scoping Solid  • In-Memory Visitor Rooms     • Truncation Prevents DB Bloat
  • 🔴 DB Query on Each Typist • 🔴 DoS on Visitor Typing    • 🔴 Missing jobId Deduplication
```

### Key Realtime & Queue Strengths:
1. **Multi-Instance Agent Clustering (`RealtimeGateway`)**: Configured with `@socket.io/redis-adapter` across Redis pub/sub clients, enabling horizontal multi-instance scaling for agent dashboards with graceful degradation to in-memory mode if Redis is offline.
2. **Strict Agent Room Isolation**: `RealtimeGateway` verifies workspace membership before allowing agents to join `workspace_${workspaceId}` or `conversation_${conversationId}` rooms, preventing cross-tenant eavesdropping.
3. **Private Note Leakage Prevention**: `OutboundMessageListener` rigorously filters out private notes (`isPrivate: true`) and contact messages, ensuring agent-only private communication is never broadcast to external channels or visitors.
4. **Resilient Webhook Delivery Worker (`WebhookDeliveryProcessor`)**: Implements exponential backoff (30s, 120s, 480s), HMAC-SHA256 request signing with timestamp headers, and response truncation (2000 chars) to prevent database bloat.

### Realtime & Queue Deficiencies Identified:
1. **WebChatGateway Missing Redis Adapter Clustering (`FINDING-P7-01`)**: Unlike `RealtimeGateway`, `WebChatGateway` (/widget) runs purely in-memory. In multi-replica deployments, messages sent to a visitor connected to another server instance will fail to deliver.
2. **Database Query Flooding on Ephemeral Typing Events (`FINDING-P7-02`)**: `RealtimeGateway.handleTypingStatus` executes two database queries (`prisma.conversation.findFirst` and `prisma.workspaceMember.findFirst`) on **every single typing event** from agents, threatening database connection exhaustion under active chat loads.
3. **Unthrottled Visitor Typing Indicator Enables DoS (`FINDING-P7-03`)**: `WebChatGateway.handleTyping` has no rate limit or debounce. A visitor can emit thousands of typing events per second, spamming internal event buses.
4. **BullMQ Queues Omit Deduplication `jobId` (`FINDING-P7-04`)**: Jobs added to `channel-ingestion` and `webhook-delivery` do not specify `jobId`, relying on auto-generated IDs and forfeiting BullMQ's native queue-level deduplication.
5. **No Dead-Letter Queue (DLQ) Notification Pipeline (`FINDING-P7-05`)**: Permanently failed webhook deliveries (`status: FAILED`) accumulate in the database without administrative alerting or a DLQ retry mechanism.

---

## 2. Realtime Gateways & Namespaces Comparison Matrix

| Attribute | Agent Realtime Gateway (`/realtime`) | Visitor Web Chat Gateway (`/widget`) |
| :--- | :--- | :--- |
| **Namespace** | `/realtime` | `/widget` |
| **Authentication** | JWT Access Token (Handshake auth/query) | `widget_token` (Channel resolved via DB) |
| **User Identity** | Authenticated `User` (`userId`, `role`) | Anonymous or Identified `Contact` (`contactId`) |
| **Redis Pub/Sub Clustering** | ✅ **Enabled** (`@socket.io/redis-adapter`) | 🔴 **Disabled** (Local in-memory only) |
| **Room Partitioning** | `user_${id}`, `workspace_${id}`, `conversation_${id}` | `widget:${channelId}:${contactId}`, `widget:${contactId}` |
| **Cross-Tenant Guard** | Verified against DB `workspaceMember` | Verified against `channel.inboxId` |
| **Typing Indicator** | Subscribes to `start_typing` / `stop_typing` | Subscribes to `widget:typing` |
| **Typing Throttling** | 🔴 2 DB queries per typing event | 🔴 No debounce or rate limit |

---

## 3. Detailed Realtime & Queue Findings

### [FINDING-P7-01] WebChatGateway Lacks Redis Adapter for Multi-Instance Clustering

- **Severity**: **HIGH**
- **Category**: Scalability & Cluster Synchronization
- **Location**: `apps/server/src/integrations/web-chat/web-chat.gateway.ts:112-114, 419-435`
- **Requirement Reference**: `docs/04-system-architecture.md`, `NFR-3`

#### 1. Evidence
In `apps/server/src/modules/realtime/realtime.gateway.ts`:
```typescript
async afterInit(server: Server): Promise<void> {
  // ...
  await this.setupRedisAdapter(server); // ✅ Configures Redis Adapter
}
```

In `apps/server/src/integrations/web-chat/web-chat.gateway.ts`:
```typescript
afterInit(_server: Server) {
  // ❌ Empty logger; does NOT configure Redis Adapter!
  this.logger.log('WebChatGateway initialized on namespace /widget');
}

@OnEvent('widget.outbound_message')
@OnEvent('widget:message')
handleOutboundMessage(payload: WebChatOutboundEventPayload) {
  // ...
  // ❌ Emits only to local Socket.io server instance:
  this.server.to(`widget:${channelId}:${recipientExternalId}`).emit('widget:message', message);
}
```

#### 2. Problem Description
`WebChatGateway` manages real-time chat for anonymous web visitors. When an agent replies to a web chat visitor:
1. `OutboundMessageListener` emits `widget.outbound_message`.
2. `WebChatGateway.handleOutboundMessage` broadcasts the message to the visitor's socket room (`widget:${channelId}:${recipientExternalId}`).
3. However, because `WebChatGateway` does not configure `@socket.io/redis-adapter`, the broadcast is strictly local to the Node.js process where the agent's message was processed.
4. In any multi-instance production deployment (e.g. 2 backend replicas behind an AWS ALB or Nginx load balancer):
   - Visitor connects to Instance 2.
   - Agent is connected to Instance 1.
   - Instance 1 receives the agent reply and broadcasts locally on Instance 1.
   - The visitor on Instance 2 **never receives the message in real-time** until they refresh the browser page.

#### 3. Impact Analysis
High severity runtime bug in clustered production environments. Web visitors experience dropped or missing agent replies during live chat sessions.

#### 4. Expected Behavior
Both `/realtime` and `/widget` gateways must initialize the Socket.io Redis adapter using `REDIS_URL` so that broadcasts cross server instances seamlessly.

#### 5. Recommended Fix
Refactor `WebChatGateway` to inject `ConfigService` and attach the Redis adapter during `afterInit`:
```typescript
async afterInit(server: Server): Promise<void> {
  const redisUrl = this.configService?.get<string>('REDIS_URL');
  if (redisUrl) {
    this.pubClient = createClient({ url: redisUrl });
    this.subClient = this.pubClient.duplicate();
    await Promise.all([this.pubClient.connect(), this.subClient.connect()]);
    server.adapter(createAdapter(this.pubClient, this.subClient));
  }
}
```

#### 6. Verification Method
Deploy 2 backend instances connected to Redis. Connect a visitor to Instance A and send an agent reply from Instance B; verify that the visitor receives the message via WebSocket without refreshing.

---

### [FINDING-P7-02] Database Flooding on High-Frequency Ephemeral Typing Events

- **Severity**: **HIGH**
- **Category**: Performance & Resource Exhaustion
- **Location**: `apps/server/src/modules/realtime/realtime.gateway.ts:674-700`
- **Requirement Reference**: `NFR-1` (Low Latency), `NFR-3` (High Scalability)

#### 1. Evidence
In `apps/server/src/modules/realtime/realtime.gateway.ts`:
```typescript
private async handleTypingStatus(client: Socket, payload: unknown, isTyping: boolean) {
  // ...
  const { conversationId } = parseResult.data;

  // ❌ Database query 1 on every typing event:
  const conversation = await this.prisma.getClient().conversation.findFirst({
    where: { id: conversationId },
    select: { id: true, workspaceId: true },
  });

  // ❌ Database query 2 on every typing event:
  const isMember =
    socketData.availableWorkspaceIds.includes(conversation.workspaceId) ||
    Boolean(
      await this.prisma.getClient().workspaceMember.findFirst({
        where: { userId: socketData.userId, workspaceId: conversation.workspaceId },
      }),
    );
  // ...
}
```

#### 2. Problem Description
Typing indicators are transient, high-frequency signals. When an agent types a response, the web client emits `start_typing` on keystrokes and `stop_typing` on pause.
For every single typing status received, `handleTypingStatus` executes **two relational database queries** against PostgreSQL:
1. Lookup conversation and workspace ID.
2. Verify workspace membership.

In an active contact center with 50 agents typing simultaneously, this generates up to 100 queries per second purely for typing indicators.

#### 3. Impact Analysis
PostgreSQL connection pool exhaustion, elevated database CPU, and degraded latency for critical transactions (like message ingestion and contact creation).

#### 4. Expected Behavior
Membership and conversation permissions should be validated **once** when the agent joins the conversation room (`handleJoinConversation`). Once joined, typing indicators must rely on in-memory socket session cache (`socketData.joinedConversations[conversationId]`).

#### 5. Recommended Fix
In `handleTypingStatus`, check memory cache and eliminate database queries:
```typescript
const workspaceId = socketData.joinedConversations?.[conversationId];
if (!workspaceId) {
  // Client hasn't joined this conversation room; reject without querying DB
  return { success: false, error: { code: 'NOT_JOINED', message: 'Must join conversation before emitting typing' } };
}
// Broadcast directly to room:
client.to(`conversation_${conversationId}`).emit(WsServerEvent.TYPING_INDICATOR, ...);
```

#### 6. Verification Method
Send 100 rapid `start_typing` events over a WebSocket connection and verify using database query logging that 0 SQL queries are executed.

---

### [FINDING-P7-03] Unthrottled Visitor Typing Indicator Enables DoS Attack

- **Severity**: **MEDIUM**
- **Category**: Security & Event Flooding
- **Location**: `apps/server/src/integrations/web-chat/web-chat.gateway.ts:395-413`
- **Requirement Reference**: `NFR-4` (Security)

#### 1. Evidence
In `apps/server/src/integrations/web-chat/web-chat.gateway.ts`:
```typescript
@SubscribeMessage('widget:typing')
async handleTyping(client: Socket, payload: WidgetTypingPayload) {
  const data = client.data as WidgetSocketData | undefined;
  if (!data || !data.workspaceId || !data.contactId) {
    return { success: false };
  }

  // ❌ No rate limiting, debounce, or cooldown:
  if (this.eventEmitter) {
    this.eventEmitter.emit('widget.visitor_typing', {
      workspaceId: data.workspaceId,
      channelId: data.channelId,
      contactId: data.contactId,
      externalContactId: data.externalContactId,
      isTyping: Boolean(payload?.isTyping),
    });
  }

  return { success: true };
}
```

#### 2. Problem Description
The visitor WebSocket gateway accepts `widget:typing` events without any rate limiting, debounce, or timestamp tracking. A malicious actor running a simple loop (`while (true) socket.emit('widget:typing', { isTyping: true })`) can flood the backend with thousands of events per second, spamming the Node.js event loop and consuming CPU cycles across all event listeners.

#### 3. Impact Analysis
Denial of service on the backend event loop, starving legitimate event handlers (`conversation.created`, `message.created`).

#### 4. Expected Behavior
Enforce a minimum cooldown (e.g. 1000ms debounce) per socket connection for typing indicator emissions.

#### 5. Recommended Fix
Store `lastTypingEmittedAt` on `client.data` and drop emissions arriving within 1000ms:
```typescript
const now = Date.now();
if (data.lastTypingAt && now - data.lastTypingAt < 1000) {
  return { success: true }; // Silently ignore rapid bursts
}
data.lastTypingAt = now;
```

#### 6. Verification Method
Emit 50 `widget:typing` events within 500ms and verify that only 1 internal event is emitted.

---

### [FINDING-P7-04] BullMQ Queue Ingestion Omits Deduplication `jobId`

- **Severity**: **MEDIUM**
- **Category**: Queue Reliability & Idempotency
- **Location**: `apps/server/src/modules/webhooks/webhooks.service.ts:227-244`, `apps/server/src/modules/webhooks/webhook-dispatcher.listener.ts:96-116`
- **Requirement Reference**: `BR-2.2` (Webhook Idempotency)

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
  },
  {
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: true,
    removeOnFail: false,
    // ❌ jobId is omitted! BullMQ assigns an auto-generated random ID.
  },
);
```

In `apps/server/src/modules/webhooks/webhook-dispatcher.listener.ts`:
```typescript
await this.deliveryQueue.add(
  'deliver-webhook',
  {
    deliveryId: delivery.id,
    subscriptionId: sub.id,
    // ...
  },
  {
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
    // ❌ jobId is omitted!
  },
);
```

#### 2. Problem Description
BullMQ supports native job deduplication when a deterministic `jobId` is provided. When `jobId` is omitted, BullMQ assigns a random auto-generated integer/UUID.
If an upstream webhook provider resends an event or if a network glitch triggers a retry at the HTTP controller level before the first transaction commits, two identical jobs will be enqueued and processed simultaneously.

#### 3. Impact Analysis
Risk of duplicate message ingestion or duplicate outbound webhook deliveries to client endpoints.

#### 4. Expected Behavior
Always supply a deterministic `jobId`:
- Ingestion Queue: `jobId: `${channelId}:${externalEventId}`` or `jobId: channelEvent.id`.
- Delivery Queue: `jobId: delivery.id`.

#### 5. Recommended Fix
Add `jobId` to queue options:
```typescript
{
  jobId: `ingest:${channelId}:${channelEvent.id}`,
  attempts: 3,
  backoff: { type: 'exponential', delay: 30_000 },
}
```

#### 6. Verification Method
Attempt to add two jobs with the same deterministic `jobId` and verify that BullMQ ignores the second enqueue.

---

### [FINDING-P7-05] Missing Dead Letter Queue (DLQ) Notification Pipeline

- **Severity**: **LOW**
- **Category**: Queue Observability & Recovery
- **Location**: `apps/server/src/infrastructure/queue/webhook-delivery.processor.ts:150-180`
- **Requirement Reference**: `NFR-2` (Reliability)

#### 1. Evidence
In `apps/server/src/infrastructure/queue/webhook-delivery.processor.ts`:
```typescript
if (isFinalAttempt) {
  await client.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      status: WebhookDeliveryStatus.FAILED,
      responseCode: errStatus,
      responseBody: this.truncate(errBody),
    },
  });
  this.logger.error(
    `Webhook delivery '${deliveryId}' failed permanently after ${currentAttempt} attempts`,
  );
  // ❌ No DLQ queue, no alert emitted, no retryable dead letter mechanism
}
```

#### 2. Problem Description
When an outbound webhook delivery fails all 3 retry attempts, it marks the record `FAILED` in the database and logs an error.
There is no automated notification (e.g. Slack/Email alert to workspace admins) and no separate Dead Letter Queue (DLQ) where failed jobs can be inspected and manually replayed once the recipient endpoint is fixed.

#### 3. Impact Analysis
Administrators are unaware that their webhook endpoints are failing until critical customer events have already been lost.

#### 4. Expected Behavior
Emit a `webhook.delivery_failed_permanently` event and provide an API endpoint (`POST /api/v1/webhook-deliveries/:id/retry`) allowing admins to replay failed deliveries.

#### 5. Recommended Fix
Emit a domain event on final failure and add a manual retry endpoint in `WebhookSubscriptionsController`.

#### 6. Verification Method
Deliver to an invalid URL, exhaust 3 retries, and verify that the failure event is emitted.

---

## 4. Phase 7 Realtime & Queue Sign-Off Assessment

| Dimension | Standard | Audit Result | Status |
| :--- | :--- | :--- | :---: |
| **Agent Gateway Clustering** | Redis Pub/Sub Adapter enabled | Configured in `RealtimeGateway`. | ✅ **Pass** |
| **Visitor Gateway Clustering** | Redis Pub/Sub Adapter enabled | Missing in `WebChatGateway` (`FINDING-P7-01`). | 🔴 **Critical Action Required** |
| **Tenant Room Isolation** | Verified room membership | Correctly enforced on `/realtime` and `/widget`. | ✅ **Pass** |
| **Private Note Protection** | Internal notes omitted from external broadcasts | Filtered cleanly in `OutboundMessageListener`. | ✅ **Pass** |
| **Typing Indicator Efficiency** | Zero DB overhead on keystrokes | 2 DB queries per typing event (`FINDING-P7-02`). | 🔴 **Critical Action Required** |
| **Queue Deduplication** | Deterministic `jobId` on queues | Missing `jobId` in ingestion & delivery (`FINDING-P7-04`). | 🟡 **Needs Hardening** |
| **Retry & Backoff Policy** | Exponential backoff configured | 30s/120s/480s retry logic implemented. | ✅ **Pass** |

### Summary Recommendation for Phase 7:
The WebSocket and queue foundation exhibits good architectural separation. However, two **Critical/High scalability defects** must be resolved before deploying in a clustered environment:
1. Attach the Redis pub/sub adapter to `WebChatGateway` to enable multi-instance visitor messaging.
2. Eliminate database queries from `RealtimeGateway.handleTypingStatus` to prevent database connection exhaustion under active chat loads.
