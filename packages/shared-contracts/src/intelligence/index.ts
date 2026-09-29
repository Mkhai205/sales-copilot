export * from './schemas';
export * from './knowledge';

export interface AiAgentJobData {
  workspaceId: string;
  conversationId: string;
  messageId: string;
  inboxId: string;
  scheduledAt: number;
}

export interface AiAgentFollowUpJobData {
  workspaceId: string;
  conversationId: string;
  aiMessageTimestamp: number;
  followUpMessage?: string;
}

export type AiAutopilotJobData = AiAgentJobData | AiAgentFollowUpJobData;

export interface AiAgentTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

import type { AiDebugMetadata } from './schemas';

export interface AiAgentResult {
  skipped?: boolean;
  reason?: string;
  text?: string;
  stepsCount?: number;
  usage?: AiAgentTokenUsage;
  aiDebug?: AiDebugMetadata;
}
