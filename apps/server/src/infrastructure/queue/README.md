# Queue Infrastructure Module (BullMQ)

## Overview

This module holds only generic BullMQ wiring: the Redis connection and the
global queue registrations that producers resolve via `@InjectQueue`. Queue
name constants live in `@sales-copilot/shared-contracts`
(`src/common/queues.ts`).

Processors live next to the domain modules that own their business logic:

- **Channel ingestion** (`CHANNEL_INGESTION_QUEUE`): inbound webhook ingestion
  and normalization — `modules/omnichannel/integrations/channel-ingestion.processor.ts`,
  provided by `IntegrationsModule`.
- **Comment Guard** (`COMMENT_GUARD_QUEUE`): Facebook comment scanning/masking —
  `modules/omnichannel/integrations/facebook/comment-guard.processor.ts`,
  provided by `FacebookModule`.
- **Commerce Reconciliation** (`COMMERCE_RECONCILIATION_QUEUE`):
  `modules/commerce/reconciliation`.
- **AI Autopilot** (`AI_AUTOPILOT_QUEUE`): `modules/intelligence/ai-agent`.

## Architecture

- Backend: Redis (`ioredis` / `@nestjs/bullmq` / `bullmq`).
- Adheres to modular boundaries defined in `AGENTS.md`: infrastructure stays
  domain-agnostic; domain logic never leaks into this layer.
