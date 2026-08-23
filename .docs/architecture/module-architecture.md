# Module Architecture & Bounded Contexts (Phase 1)

## 1. Core Modules Matrix

| Module | Bounded Context | Owned Models | Public Service Interfaces |
| :--- | :--- | :--- | :--- |
| **`identity`** | Identity & Tenancy | `User`, `Workspace`, `WorkspaceMember`, `Team`, `TeamMember` | `AuthService`, `WorkspaceService`, `TeamService` |
| **`omnichannel`** | Omnichannel & Ingestion | `Channel`, `ChannelEvent`, `Inbox`, `InboxMember`, `Contact`, `ChannelIdentity` | `ChannelService`, `InboxService`, `ContactService`, `ChannelCredentialService` |
| **`conversation`** | Conversation & Messaging | `Conversation`, `ConversationLabel`, `Message`, `Attachment` | `ConversationService`, `MessageService` |
| **`operations`** | Operations & Automation | `Label`, `CannedResponse`, `AutomationRule`, `WebhookSubscription`, `WebhookDelivery`, `AuditLog` | `LabelService`, `CannedResponseService`, `AutomationEngine`, `WebhookDispatcher` |
| **`realtime`** | Realtime Gateway | None (In-memory + Redis) | `RealtimeGateway`, `EventDispatcher` |

---

## 2. Dependency Rules

```text
Controllers / Gateways (Presentation Layer)
       │
       ▼
Application Use Cases / Command Handlers
       │
       ▼
Domain Entities / Domain Events
       ▲
       │
Infrastructure Repositories / External Adapters
```

### Prohibitions:
1. Module A **KHÔNG ĐƯỢC** import trực tiếp Repository hoặc Prisma model của Module B.
2. Module A chỉ tương tác với Module B thông qua **Public Application Service** hoặc **Domain Events**.
3. Không thực hiện truy vấn cơ sở dữ liệu trực tiếp trong Controller.
