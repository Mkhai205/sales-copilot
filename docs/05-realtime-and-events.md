# 05. Realtime Engine & Event Dispatcher

## 1. Realtime Architecture

Sales Copilot uses **NestJS WebSocket Gateway (Socket.io) + Redis Pub/Sub Adapter** to maintain horizontally scalable, tenant-isolated realtime streams.

```text
┌─────────────────┐       ┌─────────────────┐
│ Next.js Client A│       │ Next.js Client B│
└────────┬────────┘       └────────┬────────┘
         │ WebSocket (Socket.io)   │ WebSocket
┌────────▼─────────────────────────▼────────┐
│        NestJS WebSocket Gateway           │
│     (Auth Guard: JWT / Handshake Token)   │
└────────────────────┬──────────────────────┘
                     │ Redis Pub/Sub
┌────────────────────▼──────────────────────┐
│                Redis 7                    │
│   Channels: `events:workspace_{id}`       │
└───────────────────────────────────────────┘
```

---

## 2. Room & Namespace Strategy

Clients join rooms based on authorization context:
1. **Workspace Room**: `workspace_${workspaceId}` (Receives high-level inbox stats, conversation badges, new conversation events).
2. **Conversation Room**: `conversation_${conversationId}` (Receives active live typing indicators, new messages, read receipts).
3. **Agent User Room**: `user_${userId}` (Receives direct assignment notifications and personal alerts).

---

## 3. Standard Realtime Event Catalog

| Event Name | Room Scope | Payload Description |
| :--- | :--- | :--- |
| `message.created` | `workspace_${wsId}`, `conversation_${convId}` | New incoming/outgoing message with attachments. |
| `message.updated` | `conversation_${convId}` | Delivery status updated (`SENT` ──► `DELIVERED` ──► `READ`). |
| `conversation.created` | `workspace_${wsId}` | New conversation opened from any channel. |
| `conversation.status_updated` | `workspace_${wsId}`, `conversation_${convId}` | Status changed (`OPEN` ──► `RESOLVED` / `SNOOZED`). |
| `conversation.assigned` | `workspace_${wsId}`, `user_${userId}` | Assignee or Team changed. |
| `conversation.typing_on` | `conversation_${convId}` | Customer or agent typing indicator. |
| `presence.update` | `workspace_${wsId}` | Agent online/offline/busy status. |

---

## 4. Internal Domain Events

All domain operations emit typed domain events for asynchronous decoupled workflows:

```typescript
export interface MessageReceivedPayload {
  messageId: string;
  conversationId: string;
  contactId: string;
  inboxId: string;
  content?: string;
  senderType: string;
  channelType: string;
}

export interface ConversationAssignedPayload {
  conversationId: string;
  previousAssigneeId?: string;
  newAssigneeId?: string;
  teamId?: string;
  assignedByUserId?: string;
}

export interface ContactMergedPayload {
  primaryContactId: string;
  mergedContactId: string;
  mergedByUserId: string;
}
```
