# Queue Infrastructure Module (BullMQ)

## Overview

This module will house background queue configurations and workers for asynchronous, retryable, and high-latency tasks in Phase 1:

- **Outbound Webhooks**: Dispatching and retrying webhooks to third-party endpoints.
- **Channel Event Processing**: Ingestion and normalization of inbound webhooks (Facebook, Zalo, Telegram, Email).
- **Email Delivery**: Asynchronous transactional email processing.

## Architecture

- Backend: Redis (`ioredis` / `@nestjs/bullmq` / `bullmq`).
- Adheres to modular boundaries defined in `AGENTS.md`.
