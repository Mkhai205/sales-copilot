# Queue Infrastructure Module (BullMQ)

## Overview

This module houses background queue configurations and processors for asynchronous, retryable, and high-latency tasks:

- **Channel Event Processing**: Ingestion and normalization of inbound webhooks (Facebook, Telegram, Web Chat) via `CHANNEL_INGESTION_QUEUE`.
- **Comment Guard**: Real-time scanning/masking of Facebook comments containing phone numbers via `COMMENT_GUARD_QUEUE`.

Other queues live next to their domain modules:

- **Commerce Reconciliation** (`COMMERCE_RECONCILIATION_QUEUE`, `apps/server/src/modules/commerce/reconciliation`).
- **AI Autopilot** (`AI_AUTOPILOT_QUEUE`, `apps/server/src/modules/intelligence/ai-agent`).

## Architecture

- Backend: Redis (`ioredis` / `@nestjs/bullmq` / `bullmq`).
- Adheres to modular boundaries defined in `AGENTS.md`.
