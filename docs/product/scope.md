# Sales Copilot Platform — Product Scope

## 1. Scope Phasing & Objectives

Sales Copilot Platform được chia thành 3 giai đoạn chiến lược:

```text
Phase 1: Omnichannel Conversation Platform Core (COMPLETED BASELINE)
  ├── Multi-Tenancy (Workspace, User, Roles)
  ├── Omnichannel Ingestion (Channels, Inboxes 1:1, ChannelEvents)
  ├── Contact & Identity (Contacts, ChannelIdentities 3NF)
  ├── Conversation & Messaging (Conversations, Messages, Attachments, Labels)
  ├── Operations (Canned Responses, Automation Rules, Webhooks, Audit Logs)
  └── Realtime Engine (WebSocket Gateway, Redis Pub/Sub)

Phase 2: Sales Intelligence & AI Copilot (CURRENT ACTIVE SCOPE)
  ├── Lead / Opportunity Lifecycle & Conversion State Machine
  ├── Sales Evidence Ledger (BANT: Budget, Authority, Need, Timeline)
  ├── AI Lead Scoring Engine with 48h Time-Decay
  ├── Conversation Intelligence Pipeline via BullMQ
  └── Sales Copilot Assistant Drawer & Next Best Actions (NBA)

Phase 3: Autonomous Sales Extensions (FUTURE SCOPE - FROZEN)
  ├── Autonomous Sales Agent Execution Engine
  ├── Tool Registry & Guardrails
  ├── Voice / SIP Integration (WebRTC)
  └── External CRM Sync (HubSpot, Salesforce)
```

---

## 2. Phase 1 Scope (Completed Baseline)

- **Multi-Tenancy**: Logical isolation per `Workspace`. Workspace roles (`OWNER`, `ADMIN`, `AGENT`, `VIEWER`).
- **Omnichannel Ingestion**: 1:1 Inbox-to-Channel binding (Web Chat, Facebook Messenger, Zalo OA, Telegram, Email). HMAC verification, AES-256-GCM credential encryption.
- **Contact & Identity Resolution**: Single contact per workspace, multiple channel identities, contact merge support.
- **Conversation & Messaging Core**: Lifecycle states (`OPEN`, `PENDING`, `RESOLVED`, `SNOOZED`), polymorphic message senders (`CONTACT`, `USER`, `SYSTEM`), MinIO S3 attachments, conversation labels.
- **Operations & Realtime**: Canned responses, automation rules engine, outbound webhooks with BullMQ retries, Socket.io realtime clustering.

---

## 3. Phase 2 Scope (Current Active Scope)

- **Lead & Opportunity Core**: Lead lifecycle (`NEW`, `CONTACTED`, `QUALIFIED`, `UNQUALIFIED`), Opportunity pipeline stages, win/loss tracking.
- **Multi-Provider LLM Gateway**: Provider adapter abstraction (`GeminiAdapter` primary, `OpenAiAdapter` fallback), token bucket rate limiting, circuit breaker.
- **Sales Evidence & Activity Timeline**: BANT evidence ledger linked to verbatim conversation quotes, unified timeline.
- **AI Lead Scoring Engine**: Fit score + Behavior score + Time-decay evaluation after 48h inactivity.
- **Sales Copilot Assistant Drawer**: Next Best Action suggestions, contextual draft replies, feedback collection (`accepted`, `edited`, `rejected`).

---

## 4. Explicitly Out of Scope for Phase 2 (Prohibited)

Các thành phần sau thuộc **Phase 3 và tuyệt đối không tạo code/schema trong Phase 2**:
- Autonomous Sales Agent loop & tool execution engine.
- Voice/SIP integration & VoIP softphones.
- External CRM bidirectional synchronization (HubSpot, Salesforce).
- Deep BI / Data warehousing analytics.
