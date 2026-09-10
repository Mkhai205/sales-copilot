import { z } from 'zod';
import { paginationParamsSchema } from '../common';
import { BillingPlanType } from '../workspaces/enums';

// ==========================================
// 1. Query Schemas
// ==========================================
export const queryPlatformWorkspacesSchema = paginationParamsSchema.extend({
  search: z.string().trim().optional(),
  plan: z.nativeEnum(BillingPlanType).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  sortBy: z.enum(['createdAt', 'name', 'slug']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type QueryPlatformWorkspacesDto = z.infer<typeof queryPlatformWorkspacesSchema>;

// ==========================================
// 2. Mutation Schemas
// ==========================================
export const workspaceCustomQuotasSchema = z.object({
  maxAgents: z.number().int().min(1).optional(),
  maxChannels: z.number().int().min(1).optional(),
  storageLimitMb: z.number().int().min(100).optional(),
  aiMonthlyTokens: z.number().int().min(0).optional(),
});

export type WorkspaceCustomQuotasDto = z.infer<typeof workspaceCustomQuotasSchema>;

export const updateWorkspacePlanSchema = z
  .object({
    billingPlan: z.nativeEnum(BillingPlanType).optional(),
    quotas: workspaceCustomQuotasSchema.optional(),
  })
  .refine(
    data =>
      data.billingPlan !== undefined ||
      (data.quotas !== undefined && Object.values(data.quotas).some(v => v !== undefined)),
    {
      message: 'At least one of billingPlan or quotas must be provided',
    },
  );

export type UpdateWorkspacePlanDto = z.infer<typeof updateWorkspacePlanSchema>;

export const toggleWorkspaceStatusSchema = z
  .object({
    isSuspended: z.boolean(),
    reason: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.isSuspended && (!data.reason || data.reason.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Reason is required when suspending a workspace',
        path: ['reason'],
      });
    }
  });

export type ToggleWorkspaceStatusDto = z.infer<typeof toggleWorkspaceStatusSchema>;

// ==========================================
// 3. Response DTOs
// ==========================================
export interface PlatformWorkspaceOwnerDto {
  id: string;
  email: string;
  name: string;
}

export interface PlatformWorkspaceListItemDto {
  id: string;
  name: string;
  slug: string;
  billingPlan: BillingPlanType | string;
  isSuspended: boolean;
  suspendedReason?: string | null;
  suspendedAt?: string | Date | null;
  owner?: PlatformWorkspaceOwnerDto | null;
  memberCount: number;
  channelCount: number;
  createdAt: string | Date;
  updatedAt?: string | Date;
}

export interface PlatformWorkspaceQuotasDto {
  maxAgents: number;
  maxChannels: number;
  storageLimitMb: number;
  aiMonthlyTokens: number;
}

export interface PlatformWorkspaceUsageDto {
  currentAgents: number;
  currentChannels: number;
  storageUsedMb: number;
  aiUsedTokens: number;
}

export interface PlatformWorkspaceMemberDto {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: string;
  createdAt: string | Date;
}

export interface PlatformWorkspaceDetailDto {
  id: string;
  name: string;
  slug: string;
  billingPlan: BillingPlanType | string;
  isSuspended: boolean;
  suspendedReason?: string | null;
  suspendedAt?: string | Date | null;
  timezone: string;
  defaultLanguage: string;
  settings?: Record<string, unknown> | null;
  quotas: PlatformWorkspaceQuotasDto;
  usage: PlatformWorkspaceUsageDto;
  members: PlatformWorkspaceMemberDto[];
  createdAt: string | Date;
  updatedAt?: string | Date;
}
