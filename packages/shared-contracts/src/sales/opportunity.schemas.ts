import { z } from 'zod';
import { OpportunityStage, STAGE_DEFAULT_PROBABILITIES } from './enums';

// ============================================================================
// 1. Create Opportunity Schema & DTO
// ============================================================================

export const createOpportunityRawSchema = z.object({
  contactId: z.string().uuid('Invalid contact ID'),
  leadId: z.string().uuid('Invalid lead ID').optional().nullable(),
  title: z.string().trim().min(3, 'Title must have at least 3 characters'),
  stage: z.nativeEnum(OpportunityStage).default(OpportunityStage.PROSPECTING),
  amount: z.coerce.number().positive('Amount must be positive'),
  currency: z
    .string()
    .length(3, 'Currency must be a 3-letter ISO code')
    .toUpperCase()
    .default('USD'),
  probability: z.coerce.number().min(0).max(100).optional(),
  expectedCloseDate: z
    .string()
    .refine(val => !isNaN(Date.parse(val)), {
      message: 'expectedCloseDate must be a valid ISO-8601 date string',
    })
    .optional()
    .nullable(),
  assignedUserId: z.string().uuid('Invalid assigned user ID').optional().nullable(),
  metadata: z.record(z.unknown()).default({}),
});

export const createOpportunitySchema = createOpportunityRawSchema.transform(data => ({
  ...data,
  probability:
    data.probability !== undefined
      ? data.probability
      : (STAGE_DEFAULT_PROBABILITIES[data.stage] ?? 50),
}));

export type CreateOpportunityDto = z.input<typeof createOpportunitySchema>;
export type CreateOpportunityOutput = z.output<typeof createOpportunitySchema>;

// ============================================================================
// 2. Update Opportunity Stage Schema & DTO
// ============================================================================

export const updateOpportunityStageSchema = z
  .object({
    stage: z.nativeEnum(OpportunityStage),
    lostReason: z.string().optional().nullable(),
    probability: z.coerce.number().min(0).max(100).optional(),
  })
  .refine(
    data => {
      if (data.stage === OpportunityStage.CLOSED_LOST) {
        return typeof data.lostReason === 'string' && data.lostReason.trim().length >= 5;
      }
      return true;
    },
    {
      message:
        'lostReason is required and must have at least 5 characters when stage is CLOSED_LOST',
      path: ['lostReason'],
    },
  );

export type UpdateOpportunityStageDto = z.input<typeof updateOpportunityStageSchema>;
export type UpdateOpportunityStageOutput = z.output<typeof updateOpportunityStageSchema>;

// ============================================================================
// 3. List Opportunities Query Schema & DTO
// ============================================================================

export const opportunitySortBySchema = z.enum([
  'createdAt',
  'updatedAt',
  'amount',
  'expectedCloseDate',
]);
export type OpportunitySortBy = z.infer<typeof opportunitySortBySchema>;

export const listOpportunitiesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  stage: z.nativeEnum(OpportunityStage).optional(),
  assignedUserId: z.string().uuid('Invalid assigned user ID').optional(),
  startDate: z
    .string()
    .refine(val => !isNaN(Date.parse(val)), {
      message: 'startDate must be a valid date string',
    })
    .optional(),
  endDate: z
    .string()
    .refine(val => !isNaN(Date.parse(val)), {
      message: 'endDate must be a valid date string',
    })
    .optional(),
  sortBy: opportunitySortBySchema.default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ListOpportunitiesQueryDto = z.input<typeof listOpportunitiesQuerySchema>;
export type ListOpportunitiesQueryOutput = z.output<typeof listOpportunitiesQuerySchema>;

// ============================================================================
// 4. Pipeline Summary Query Schema & Types
// ============================================================================

export const pipelineSummaryQuerySchema = z.object({
  currency: z
    .string()
    .length(3, 'Currency must be a 3-letter ISO code')
    .toUpperCase()
    .default('USD'),
  assignedUserId: z.string().uuid('Invalid assigned user ID').optional(),
});

export type PipelineSummaryQueryDto = z.input<typeof pipelineSummaryQuerySchema>;
export type PipelineSummaryQueryOutput = z.output<typeof pipelineSummaryQuerySchema>;

export interface PipelineStageSummaryDto {
  stage: OpportunityStage;
  count: number;
  totalAmount: number;
  weightedAmount: number;
  averageProbability: number;
}

export interface PipelineSummaryResponseDto {
  currency: string;
  totalPipelineValue: number;
  weightedPipelineValue: number;
  totalDeals: number;
  stages: PipelineStageSummaryDto[];
}

// ============================================================================
// 5. Opportunity Response DTO
// ============================================================================

export interface OpportunityResponseDto {
  id: string;
  workspaceId: string;
  leadId: string | null;
  contactId: string;
  title: string;
  stage: OpportunityStage;
  amount: number;
  currency: string;
  probability: number;
  expectedCloseDate: string | null;
  actualCloseDate: string | null;
  lostReason: string | null;
  assignedUserId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  contact?: {
    id: string;
    name: string;
    email: string | null;
    phoneNumber: string | null;
    avatarUrl: string | null;
  };
  lead?: {
    id: string;
    status: string;
    stage: string;
    score: number;
  } | null;
  assignedUser?: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  } | null;
}
