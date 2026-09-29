import { z } from 'zod';

export const personaToneSchema = z.enum(['shop_ban', 'em_anh_chi', 'minh_ban', 'chuyen_vien']);
export type PersonaTone = z.infer<typeof personaToneSchema>;

export const aiToolCallDebugSchema = z.object({
  name: z.string(),
  input: z.record(z.unknown()).default({}),
  outputSummary: z.string(),
  durationMs: z.number(),
});
export type AiToolCallDebug = z.infer<typeof aiToolCallDebugSchema>;

export const aiDebugMetadataSchema = z.object({
  provider: z.string(),
  model: z.string(),
  stepsCount: z.number(),
  totalDurationMs: z.number(),
  usage: z.object({
    input: z.number(),
    output: z.number(),
    total: z.number(),
  }),
  estimatedCostUsd: z.number(),
  toolCalls: z.array(aiToolCallDebugSchema).default([]),
});
export type AiDebugMetadata = z.infer<typeof aiDebugMetadataSchema>;

export const conversationAiUsageSchema = z.object({
  totalCostUsd: z.number(),
  totalTokens: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  aiMessagesCount: z.number(),
  lastCalculatedAt: z.string().optional(),
});
export type ConversationAiUsage = z.infer<typeof conversationAiUsageSchema>;
