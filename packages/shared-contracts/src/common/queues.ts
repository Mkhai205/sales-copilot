// BullMQ queue names — the cross-process contract between producers and
// workers. All queue names live here so apps and future services share one
// source of truth.

export const CHANNEL_INGESTION_QUEUE = 'channel-ingestion';

export const COMMENT_GUARD_QUEUE = 'comment-guard';

export const COMMERCE_RECONCILIATION_QUEUE = 'commerce-reconciliation';

export const AI_AUTOPILOT_QUEUE = 'ai-autopilot';

export const MESSAGE_OUTBOUND_QUEUE = 'message-outbound';

export const KNOWLEDGE_EMBEDDING_QUEUE = 'knowledge-embedding';
