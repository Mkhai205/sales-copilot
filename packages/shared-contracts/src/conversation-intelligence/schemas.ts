import { z } from 'zod';
import { buyingSignalTypeSchema } from '../sales/enums';
import { conversationIntentSchema, sentimentPolaritySchema, urgencyLevelSchema } from './enums';

export const sentimentResultSchema = z.object({
  polarity: sentimentPolaritySchema,
  score: z
    .number()
    .min(-1.0, 'Sentiment score must be >= -1.0')
    .max(1.0, 'Sentiment score must be <= 1.0'),
  urgency: urgencyLevelSchema,
  reasoning: z.string().optional().default(''),
});
export type SentimentResultDto = z.infer<typeof sentimentResultSchema>;

export const detectedSignalSchema = z.object({
  signalType: buyingSignalTypeSchema,
  confidence: z
    .number()
    .min(0.0, 'Confidence must be >= 0.0')
    .max(1.0, 'Confidence must be <= 1.0'),
  snippet: z.string(),
  reasoning: z.string().optional().default(''),
  metadata: z.record(z.unknown()).optional().default({}),
});
export type DetectedSignalDto = z.infer<typeof detectedSignalSchema>;

export const conversationIntelligenceResultSchema = z.object({
  intent: conversationIntentSchema,
  sentiment: sentimentResultSchema,
  signals: z.array(detectedSignalSchema).default([]),
  summary: z.string().optional().default(''),
});
export type ConversationIntelligenceResultDto = z.infer<
  typeof conversationIntelligenceResultSchema
>;

export const analyzeInboundMessageJobSchema = z.object({
  workspaceId: z.string().uuid(),
  conversationId: z.string().uuid(),
  messageId: z.string(),
  contactId: z.string().optional().nullable(),
  messageContent: z.string(),
});
export type AnalyzeInboundMessageJobDto = z.infer<typeof analyzeInboundMessageJobSchema>;

export const conversationIntelligenceAnalyzedEventSchema = z.object({
  workspaceId: z.string(),
  conversationId: z.string(),
  messageId: z.string(),
  leadId: z.string().optional().nullable(),
  intent: conversationIntentSchema,
  sentiment: sentimentResultSchema,
  signalsCount: z.number().int().nonnegative(),
  detectedSignals: z.array(detectedSignalSchema),
});
export type ConversationIntelligenceAnalyzedEventPayload = z.infer<
  typeof conversationIntelligenceAnalyzedEventSchema
>;

export const conversationUrgentAlertEventSchema = z.object({
  workspaceId: z.string(),
  conversationId: z.string(),
  messageId: z.string(),
  contactId: z.string().optional().nullable(),
  urgency: urgencyLevelSchema,
  intent: conversationIntentSchema,
  sentimentScore: z.number(),
  snippet: z.string(),
  reasoning: z.string(),
});
export type ConversationUrgentAlertEventPayload = z.infer<
  typeof conversationUrgentAlertEventSchema
>;
