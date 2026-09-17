import { z } from 'zod';
import { LlmProvider, LlmRole } from './llm.enums';

export const llmRoleSchema = z.nativeEnum(LlmRole);

export const llmProviderSchema = z.nativeEnum(LlmProvider);

export const llmMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
});

export type LlmMessage = z.infer<typeof llmMessageSchema>;

export const llmCompletionOptionsSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  model: z.string().optional(),
  stream: z.boolean().optional(),
});

export type LlmCompletionOptions = z.infer<typeof llmCompletionOptionsSchema>;

export const llmUsageMetricsSchema = z.object({
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  latencyMs: z.number().nonnegative(),
  estimatedCostUsd: z.number().nonnegative().default(0),
  provider: llmProviderSchema,
  model: z.string(),
});

export type LlmUsageMetrics = z.infer<typeof llmUsageMetricsSchema>;

export const llmCompletionResultSchema = z.object({
  content: z.string(),
  metrics: llmUsageMetricsSchema,
  provider: llmProviderSchema,
  model: z.string(),
});

export type LlmCompletionResult = z.infer<typeof llmCompletionResultSchema>;

export const llmStreamChunkSchema = z.object({
  chunk: z.string(),
  isDone: z.boolean(),
  metrics: llmUsageMetricsSchema.optional(),
});

export type LlmStreamChunk = z.infer<typeof llmStreamChunkSchema>;

export const llmStructuredRequestSchema = z.object({
  workspaceId: z.string(),
  messages: z.array(llmMessageSchema),
  jsonSchema: z.record(z.any()),
  schemaName: z.string().optional(),
  options: llmCompletionOptionsSchema.optional(),
});

export type LlmStructuredRequest = z.infer<typeof llmStructuredRequestSchema>;
