import { z } from 'zod';
import {
  LeadGrade,
  LeadStage,
  LeadStatus,
  OpportunityStage,
  STAGE_DEFAULT_PROBABILITIES,
} from './enums';

// ============================================================================
// 1. Create Lead Schema & DTO
// ============================================================================

export const createLeadSchema = z.object({
  contactId: z.string().uuid('Invalid contact ID'),
  status: z.nativeEnum(LeadStatus).optional().default(LeadStatus.NEW),
  stage: z.nativeEnum(LeadStage).optional().default(LeadStage.DISCOVERY),
  assignedUserId: z.string().uuid('Invalid assigned user ID').optional().nullable(),
  estimatedValue: z.coerce
    .number()
    .positive('Estimated value must be greater than 0')
    .optional()
    .nullable(),
  currency: z
    .string()
    .length(3, 'Currency must be a 3-letter ISO code')
    .toUpperCase()
    .default('USD'),
  metadata: z.record(z.unknown()).default({}),
});

export type CreateLeadDto = z.input<typeof createLeadSchema>;
export type CreateLeadOutput = z.output<typeof createLeadSchema>;

// ============================================================================
// 2. Update Lead Schema & DTO
// ============================================================================

export const updateLeadSchema = z.object({
  status: z.nativeEnum(LeadStatus).optional(),
  stage: z.nativeEnum(LeadStage).optional(),
  assignedUserId: z.string().uuid('Invalid assigned user ID').nullable().optional(),
  estimatedValue: z.coerce
    .number()
    .positive('Estimated value must be greater than 0')
    .nullable()
    .optional(),
  currency: z.string().length(3, 'Currency must be a 3-letter ISO code').toUpperCase().optional(),
  metadata: z.record(z.unknown()).optional(),
  disqualifiedReason: z.string().optional().nullable(),
});

export type UpdateLeadDto = z.input<typeof updateLeadSchema>;
export type UpdateLeadOutput = z.output<typeof updateLeadSchema>;

// ============================================================================
// 3. List Leads Query Schema & DTO
// ============================================================================

export const leadSortBySchema = z.enum(['createdAt', 'updatedAt', 'score', 'lastActivityAt']);
export type LeadSortBy = z.infer<typeof leadSortBySchema>;

export const listLeadsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.nativeEnum(LeadStatus).optional(),
  stage: z.nativeEnum(LeadStage).optional(),
  grade: z.nativeEnum(LeadGrade).optional(),
  assignedUserId: z.string().uuid('Invalid assigned user ID').optional(),
  contactId: z.string().uuid('Invalid contact ID').optional(),
  minScore: z.coerce.number().min(0).max(100).optional(),
  maxScore: z.coerce.number().min(0).max(100).optional(),
  search: z.string().trim().optional(),
  sortBy: leadSortBySchema.default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ListLeadsQueryDto = z.input<typeof listLeadsQuerySchema>;
export type ListLeadsQueryOutput = z.output<typeof listLeadsQuerySchema>;

// ============================================================================
// 4. Convert Lead Schema & DTO
// ============================================================================

export const convertLeadRawSchema = z.object({
  title: z.string().trim().min(3, 'Title must have at least 3 characters').optional(),
  dealName: z.string().trim().min(3, 'Deal name must have at least 3 characters').optional(),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  currency: z
    .string()
    .length(3, 'Currency must be a 3-letter ISO code')
    .toUpperCase()
    .default('USD'),
  stage: z.nativeEnum(OpportunityStage).default(OpportunityStage.QUALIFICATION),
  probability: z.coerce.number().min(0).max(100).optional(),
  expectedCloseDate: z
    .string()
    .refine(val => !isNaN(Date.parse(val)), {
      message: 'expectedCloseDate must be a valid ISO-8601 date string',
    })
    .optional()
    .nullable(),
  assignedUserId: z.string().uuid('Invalid assigned user ID').optional().nullable(),
});

export const convertLeadSchema = convertLeadRawSchema
  .refine(data => Boolean(data.title || data.dealName), {
    message: 'Title or dealName is required with at least 3 characters',
    path: ['title'],
  })
  .transform(data => ({
    ...data,
    title: (data.title || data.dealName)!,
    probability:
      data.probability !== undefined
        ? data.probability
        : (STAGE_DEFAULT_PROBABILITIES[data.stage] ?? 25),
  }));

export type ConvertLeadDto = z.input<typeof convertLeadSchema>;
export type ConvertLeadOutput = z.output<typeof convertLeadSchema>;

// ============================================================================
// 5. Lead Response DTO
// ============================================================================

export interface LeadResponseDto {
  id: string;
  workspaceId: string;
  contactId: string;
  status: LeadStatus;
  stage: LeadStage;
  score: number;
  grade: LeadGrade;
  assignedUserId: string | null;
  estimatedValue: number | null;
  currency: string;
  metadata: Record<string, unknown>;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
  contact?: {
    id: string;
    name: string;
    email: string | null;
    phoneNumber: string | null;
    avatarUrl: string | null;
  };
  assignedUser?: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  } | null;
}
