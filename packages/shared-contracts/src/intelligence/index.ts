export * from './intelligence.schemas';

export const AI_AUTOPILOT_QUEUE = 'ai-autopilot';

export interface AiAgentJobData {
  workspaceId: string;
  conversationId: string;
  messageId: string;
  inboxId: string;
  scheduledAt: number;
}

export interface AiAgentTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AiAgentResult {
  skipped?: boolean;
  reason?: string;
  text?: string;
  stepsCount?: number;
  usage?: AiAgentTokenUsage;
}
