import { z } from 'zod';
import { LLMMessage } from '../ports';

export interface PromptTemplate<TParams = Record<string, unknown>> {
  render(params: TParams): LLMMessage[];
}

export const conversationAnalysisOutputSchema = z.object({
  summary: z.string(),
  intent: z.string(),
  sentiment: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE']),
  keyTopics: z.array(z.string()),
  suggestedAction: z.string().optional(),
  suggestedReply: z.string().optional(),
  leadScoreAdjustment: z.number().min(-50).max(50).optional(),
  confidence: z.number().min(0).max(1),
});

export type ConversationAnalysisOutput = z.infer<typeof conversationAnalysisOutputSchema>;

export const leadScoringOutputSchema = z.object({
  score: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
  signals: z.array(z.string()),
  recommendedStage: z.enum([
    'NEW',
    'ENGAGED',
    'QUALIFIED',
    'HOT',
    'CONVERTED',
    'LOST',
    'DISQUALIFIED',
  ]),
});

export type LeadScoringOutput = z.infer<typeof leadScoringOutputSchema>;
