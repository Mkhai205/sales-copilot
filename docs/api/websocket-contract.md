# WebSocket Realtime Contracts (Phase 1)

## 1. Connection & Authentication

- **Gateway Endpoint**: `/realtime`
- **Transport**: `websocket` (Socket.io)
- **Handshake Auth**:
  ```javascript
  const socket = io('https://api.salescopilot.io/realtime', {
    auth: { token: 'jwt_access_token' }
  });
  ```

---

## 2. Rooms Architecture

| Room Name | Scope | Subscribed By |
| :--- | :--- | :--- |
| `workspace_${workspaceId}` | Toàn bộ Workspace | Mọi Agent/Admin thuộc Workspace |
| `conversation_${conversationId}` | Hội thoại cụ thể | Agent đang mở xem hội thoại |
| `user_${userId}` | Cá nhân Agent | Người dùng cụ thể (nhận direct assignment) |

---

## 3. Realtime Event Payloads

### 3.1 `message.created`
```json
{
  "event": "message.created",
  "data": {
    "id": "msg_uuid",
    "conversationId": "conv_uuid",
    "senderType": "CONTACT",
    "senderId": "contact_uuid",
    "messageType": "INCOMING",
    "contentType": "TEXT",
    "content": "Xin chào!",
    "deliveryStatus": "DELIVERED",
    "attachments": [],
    "createdAt": "2026-08-20T00:00:00.000Z"
  }
}
```

### 3.2 `conversation.status_updated`
```json
{
  "event": "conversation.status_updated",
  "data": {
    "conversationId": "conv_uuid",
    "previousStatus": "OPEN",
    "newStatus": "RESOLVED",
    "updatedByUserId": "user_uuid"
  }
}
```

### 3.3 `conversation.assigned`
```json
{
  "event": "conversation.assigned",
  "data": {
    "conversationId": "conv_uuid",
    "assigneeId": "user_uuid",
    "teamId": "team_uuid"
  }
}
```

### 3.4 `contact.created`

- **Emitted by**: `ContactResolutionService.resolveFromChannel()`, `ContactsService.create()`
- **Room**: `workspace_${workspaceId}`
- **TypeScript contract**: `ContactCreatedEvent` (`@sales-copilot/shared-contracts`)

```json
{
  "event": "contact.created",
  "data": {
    "workspaceId": "ws_uuid",
    "contact": {
      "id": "contact_uuid",
      "workspaceId": "ws_uuid",
      "name": "Alice Wonderland",
      "email": "alice@wonderland.com",
      "phoneNumber": "+84912345678",
      "avatarUrl": null,
      "identifier": "ext_user_123",
      "customAttributes": {},
      "additionalAttributes": {},
      "createdAt": "2026-08-20T00:00:00.000Z",
      "updatedAt": "2026-08-20T00:00:00.000Z",
      "identities": []
    }
  }
}
```

### 3.5 `contact.updated`

- **Emitted by**: `ContactIdentifyService.identify()`, `ContactsService.update()`
- **Room**: `workspace_${workspaceId}`
- **TypeScript contract**: `ContactUpdatedEvent` (`@sales-copilot/shared-contracts`)

```json
{
  "event": "contact.updated",
  "data": {
    "workspaceId": "ws_uuid",
    "contact": {
      "id": "contact_uuid",
      "workspaceId": "ws_uuid",
      "name": "Updated Name",
      "email": "updated@email.com",
      "phoneNumber": "+84912345678",
      "avatarUrl": "https://avatar.com/updated.jpg",
      "identifier": "ext_user_123",
      "customAttributes": { "vip": true },
      "additionalAttributes": { "locale": "vi" },
      "createdAt": "2026-08-20T00:00:00.000Z",
      "updatedAt": "2026-08-21T00:00:00.000Z"
    },
    "previousAttributes": {
      "customAttributes": { "vip": false },
      "additionalAttributes": {}
    }
  }
}
```

### 3.6 `contact.merged`

- **Emitted by**: `ContactMergeService.merge()`
- **Room**: `workspace_${workspaceId}`
- **TypeScript contract**: `ContactMergedEvent` (`@sales-copilot/shared-contracts`)
- **Note**: Emitted after transaction commit. Downstream listeners should refresh any cached contact data for both `primaryContactId` and `mergedContactId`.

```json
{
  "event": "contact.merged",
  "data": {
    "workspaceId": "ws_uuid",
    "primaryContactId": "contact_base_uuid",
    "mergedContactId": "contact_mergee_uuid",
    "mergedByUserId": "user_uuid",
    "mergedAttributes": {
      "name": "Base Contact Name",
      "email": "base@email.com",
      "phoneNumber": "+84912345678",
      "identifier": "ext_user_123"
    }
  }
}
```

### 3.7 `contact.deleted`

- **Emitted by**: `ContactsService.delete()`
- **Room**: `workspace_${workspaceId}`
- **TypeScript contract**: `ContactDeletedEvent` (`@sales-copilot/shared-contracts`)

```json
{
  "event": "contact.deleted",
  "data": {
    "workspaceId": "ws_uuid",
    "contactId": "contact_uuid",
    "contact": {
      "id": "contact_uuid",
      "workspaceId": "ws_uuid",
      "name": "Deleted Contact",
      "email": "deleted@email.com",
      "phoneNumber": null,
      "avatarUrl": null,
      "identifier": null,
      "customAttributes": {},
      "additionalAttributes": {},
      "createdAt": "2026-08-20T00:00:00.000Z",
      "updatedAt": "2026-08-20T00:00:00.000Z"
    }
  }
}
```

### 3.8 `channel_identity.created`

- **Emitted by**: `ChannelIdentityService.findOrCreate()`, `ChannelIdentityService.createForContact()`, `ContactResolutionService.resolveFromChannel()`
- **Room**: `workspace_${workspaceId}`
- **TypeScript contract**: `ChannelIdentityCreatedEvent` (`@sales-copilot/shared-contracts`)

```json
{
  "event": "channel_identity.created",
  "data": {
    "workspaceId": "ws_uuid",
    "identity": {
      "id": "identity_uuid",
      "contactId": "contact_uuid",
      "workspaceId": "ws_uuid",
      "channelId": "channel_uuid",
      "channelType": "FACEBOOK_MESSENGER",
      "externalContactId": "fb_psid_123",
      "username": "John Doe",
      "metadata": { "profileUrl": "https://fb.com/johndoe" },
      "createdAt": "2026-08-20T00:00:00.000Z",
      "updatedAt": "2026-08-20T00:00:00.000Z"
    }
  }
}
```

### 3.9 `channel_identity.deleted`

- **Emitted by**: `ChannelIdentityService.delete()`
- **Room**: `workspace_${workspaceId}`
- **TypeScript contract**: `ChannelIdentityDeletedEvent` (`@sales-copilot/shared-contracts`)

```json
{
  "event": "channel_identity.deleted",
  "data": {
    "workspaceId": "ws_uuid",
    "identityId": "identity_uuid",
    "contactId": "contact_uuid",
    "identity": {
      "id": "identity_uuid",
      "contactId": "contact_uuid",
      "workspaceId": "ws_uuid",
      "channelId": "channel_uuid",
      "channelType": "FACEBOOK_MESSENGER",
      "externalContactId": "fb_psid_123",
      "username": "John Doe",
      "metadata": {},
      "createdAt": "2026-08-20T00:00:00.000Z",
      "updatedAt": "2026-08-20T00:00:00.000Z"
    }
  }
}
```

---

## 4. Internal Domain Events (EventEmitter2)

In addition to client-facing WebSocket events, the backend publishes internal domain events for asynchronous decoupling:

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

