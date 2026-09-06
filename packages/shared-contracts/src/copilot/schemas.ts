import { z } from 'zod';
import { CopilotSuggestionType, SuggestionStatus } from './enums';

export const copilotSuggestionSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  conversationId: z.string().uuid(),
  messageId: z.string().uuid().nullable().optional(),
  leadId: z.string().uuid().nullable().optional(),
  suggestionType: z.nativeEnum(CopilotSuggestionType),
  title: z.string(),
  content: z.string(),
  actionPayload: z.record(z.unknown()).default({}),
  confidence: z.number().min(0).max(1),
  status: z.nativeEnum(SuggestionStatus).default(SuggestionStatus.PENDING),
  dismissedReason: z.string().nullable().optional(),
  resolvedByUserId: z.string().uuid().nullable().optional(),
  expiresAt: z.union([z.date(), z.string()]),
  resolvedAt: z.union([z.date(), z.string()]).nullable().optional(),
  createdAt: z.union([z.date(), z.string()]),
  updatedAt: z.union([z.date(), z.string()]),
});
export type CopilotSuggestionDto = z.infer<typeof copilotSuggestionSchema>;

export const generateCopilotSuggestionsJobSchema = z.object({
  workspaceId: z.string().uuid(),
  conversationId: z.string().uuid(),
  messageId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
});
export type GenerateCopilotSuggestionsJobDto = z.infer<typeof generateCopilotSuggestionsJobSchema>;

export const triggerCopilotGenerationSchema = z.object({
  messageId: z.string().uuid().optional(),
  force: z.boolean().optional().default(false),
});
export type TriggerCopilotGenerationDto = z.infer<typeof triggerCopilotGenerationSchema>;

export const streamReplyDraftSchema = z.object({
  customInstruction: z.string().max(500).optional(),
});
export type StreamReplyDraftDto = z.infer<typeof streamReplyDraftSchema>;

export const resolveSuggestionSchema = z.object({
  reason: z.string().max(500).optional(),
});
export type ResolveSuggestionDto = z.infer<typeof resolveSuggestionSchema>;

export const copilotMetricsSchema = z.object({
  totalSuggestions: z.number().int().nonnegative(),
  pendingCount: z.number().int().nonnegative(),
  acceptedCount: z.number().int().nonnegative(),
  appliedCount: z.number().int().nonnegative(),
  dismissedCount: z.number().int().nonnegative(),
  expiredCount: z.number().int().nonnegative(),
  acceptanceRate: z.number().min(0).max(100),
  dismissalReasons: z.record(z.number().int().nonnegative()),
});
export type CopilotMetricsDto = z.infer<typeof copilotMetricsSchema>;
