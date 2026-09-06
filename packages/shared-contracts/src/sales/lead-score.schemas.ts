import { z } from 'zod';
import { LeadGrade, leadGradeSchema, ScoreTriggerEvent, scoreTriggerEventSchema } from './enums';

// ============================================================================
// 1. Score Factor Breakdown & Factors Schemas
// ============================================================================

export const scoreFactorBreakdownSchema = z.object({
  factor: z.string(),
  points: z.number(),
  reason: z.string(),
});
export type ScoreFactorBreakdown = z.infer<typeof scoreFactorBreakdownSchema>;

export const leadScoreFactorsSchema = z.object({
  fitScore: z.number().min(0).max(25),
  velocityScore: z.number().min(0).max(25),
  signalScore: z.number().min(0).max(50),
  decayPenalty: z.number().min(0).max(50),
  totalScore: z.number().min(0).max(100),
  breakdown: z.array(scoreFactorBreakdownSchema),
});
export type LeadScoreFactors = z.infer<typeof leadScoreFactorsSchema>;

// ============================================================================
// 2. Lead Score Current Snapshot DTO & Schema
// ============================================================================

export const leadScoreResponseSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  leadId: z.string().uuid(),
  score: z.number().int().min(0).max(100),
  grade: leadGradeSchema,
  scoreFactors: leadScoreFactorsSchema,
  calculatedAt: z.string(),
  updatedAt: z.string(),
});
export type LeadScoreResponseDto = z.infer<typeof leadScoreResponseSchema>;

// ============================================================================
// 3. Lead Score History Ledger DTO & Schema
// ============================================================================

export const leadScoreHistoryItemSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  leadId: z.string().uuid(),
  previousScore: z.number().int().min(0).max(100),
  newScore: z.number().int().min(0).max(100),
  delta: z.number().int(),
  previousGrade: leadGradeSchema.nullable().optional(),
  newGrade: leadGradeSchema.nullable().optional(),
  reason: z.string(),
  eventTrigger: scoreTriggerEventSchema,
  scoreFactors: leadScoreFactorsSchema,
  createdAt: z.string(),
});
export type LeadScoreHistoryItemDto = z.infer<typeof leadScoreHistoryItemSchema>;

// ============================================================================
// 4. Query & Mutation DTOs & Schemas
// ============================================================================

export const listLeadScoreHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type ListLeadScoreHistoryQueryDto = z.input<typeof listLeadScoreHistoryQuerySchema>;
export type ListLeadScoreHistoryQueryOutput = z.output<typeof listLeadScoreHistoryQuerySchema>;

export const recalculateScoreSchema = z.object({
  reason: z.string().trim().optional(),
});
export type RecalculateScoreDto = z.infer<typeof recalculateScoreSchema>;

// ============================================================================
// 5. Queue & Async Job Constants
// ============================================================================

export const LEAD_SCORING_QUEUE = 'ai-lead-scoring';
export const RECALCULATE_LEAD_SCORE_JOB = 'recalculate-lead-score';

export interface RecalculateLeadScoreJobDto {
  workspaceId: string;
  leadId: string;
  scheduledAt: number;
  trigger: ScoreTriggerEvent;
  reason?: string;
}
