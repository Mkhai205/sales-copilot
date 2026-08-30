# System Architecture (Phase 1)

## 1. High-Level Modular Monolith Architecture

```text
┌────────────────────────────────────────────────────────┐
│               Frontend: Next.js 16 (App Router)        │
│          React 19, TypeScript, Tailwind CSS, Base UI   │
└───────────────────────────┬────────────────────────────┘
                            │ REST API / WebSocket (Socket.io)
┌───────────────────────────▼────────────────────────────┐
│               Backend: NestJS 11 (Modular Monolith)    │
│  Controllers ──► Application Use Cases ──► Repositories │
└─────────┬─────────────────┬──────────────────┬─────────┘
          │                 │                  │
          ▼                 ▼                  ▼
┌──────────────────┐┌───────────────┐┌──────────────────┐
│  PostgreSQL 16   ││    Redis 7    ││     MinIO S3     │
│   (Prisma ORM)   ││ (Pub/Sub + Q) ││ (Object Storage) │
└──────────────────┘└───────────────┘└──────────────────┘
```

---

## 2. End-to-End Inbound Ingestion Pipeline

```text
[External Customer]
      │ (Nhắn tin qua Web Chat, Facebook, Zalo, Telegram)
      ▼
[Webhook Controller] (/api/v1/channels/:id/webhook)
      │
      ├── 1. Signature Verification (HMAC-SHA256)
      │
      ├── 2. Ingestion Deduplication (ChannelEvent @@unique([channelId, externalEventId]))
      │
      ├── 3. Async Queue Processing (BullMQ Worker)
            │
            ├── 4. Contact & ChannelIdentity Resolution (3NF)
            │
            ├── 5. Conversation Resolution (Find or Create OPEN Conversation)
            │
            ├── 6. Message Persistence & Attachments Stored (MinIO S3)
            │
            ├── 7. Auto-Assignment (Round-Robin with Online Presence check)
            │
            ├── 8. Automation Rules Engine Evaluation
            │
            ├── 9. Outbound Webhook Subscriptions Dispatch
            │
            └── 10. Realtime Event Broadcast (WebSocket Room: `workspace_${wsId}`)
```
