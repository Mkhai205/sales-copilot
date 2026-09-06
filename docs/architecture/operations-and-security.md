# Operations & Security Architecture

## 1. Automation Rules Engine

The Automation Engine evaluates rules asynchronously upon trigger events (e.g. `MESSAGE_CREATED`, `CONVERSATION_OPENED`, `CONVERSATION_UPDATED`).

```text
[Event Triggered: MESSAGE_CREATED]
              │
              ▼
Fetch Active AutomationRules for Workspace (`isActive = true`)
              │
              ▼
Match Trigger & Evaluate JSON Conditions
  • Attribute: `message.content`, `contact.email`, `inbox.id`, `channel.type`
  • Operator: `contains`, `equals`, `starts_with`, `in_list`
              │
         ┌────┴────┐
       MATCH    NO MATCH ──► Skip
         │
         ▼
Execute Ordered Actions (Transactional execution):
  1. `add_label` (e.g. ["VIP", "Enterprise"])
  2. `assign_team` (e.g. teamId)
  3. `assign_user` (e.g. userId)
  4. `send_canned_response` (shortCode)
  5. `mute_conversation`
```

---

## 2. Outbound Webhook Delivery Engine

The Webhook Engine reliably sends subscribed events to external HTTP endpoints.

### Delivery Lifecycle & Retry Policy:
- **Model**: `WebhookDelivery` (`subscriptionId`, `eventId`, `status`, `attemptCount`, `nextRetryAt`).
- **Idempotency**: `@@unique([subscriptionId, eventId])`.
- **Retry Strategy**: Exponential backoff with jitter:
  - Attempt 1: Immediate
  - Attempt 2: +1 minute
  - Attempt 3: +5 minutes
  - Attempt 4: +30 minutes
  - Attempt 5: +2 hours ──► Mark `EXHAUSTED` if failed.
- **Security**: HMAC-SHA256 signature in `X-SalesCopilot-Signature` header calculated using `WebhookSubscription.secretKey`.

---

## 3. RBAC Matrix

| Permission / Action | OWNER | ADMIN | AGENT | VIEWER |
| :--- | :---: | :---: | :---: | :---: |
| **Manage Workspace & Billing** | ✅ | ❌ | ❌ | ❌ |
| **Manage Inboxes & Channels** | ✅ | ✅ | ❌ | ❌ |
| **Manage Team Members & Roles** | ✅ | ✅ | ❌ | ❌ |
| **Create Automation Rules & Webhooks** | ✅ | ✅ | ❌ | ❌ |
| **Manage Canned Responses & Labels** | ✅ | ✅ | ✅ | ❌ |
| **View Conversations in Assigned Inboxes** | ✅ | ✅ | ✅ | ✅ |
| **Reply & Send Messages** | ✅ | ✅ | ✅ | ❌ |
| **Assign Conversations** | ✅ | ✅ | ✅ | ❌ |
| **View Audit Logs** | ✅ | ✅ | ❌ | ❌ |

---

## 4. Audit Trail Specification

All sensitive security and administrative actions write to `AuditLog`:
- **Fields**: `workspaceId`, `userId`, `action`, `resourceType`, `resourceId`, `payload`, `ipAddress`, `createdAt`.
- **Audited Events**:
  - `workspace.member_added` / `workspace.member_removed`
  - `channel.connected` / `channel.disconnected` / `channel.credentials_updated`
  - `automation_rule.created` / `automation_rule.updated` / `automation_rule.deleted`
  - `webhook_subscription.created` / `webhook_subscription.deleted`
  - `contact.merged` / `contact.deleted`
