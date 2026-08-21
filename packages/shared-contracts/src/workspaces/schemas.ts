import { z } from 'zod';
import { BillingPlanType } from './enums';
import { WorkspaceRole } from '../auth/enums';

// Shared field schemas — reused across create and update to avoid duplication
const workspaceNameSchema = z
  .string()
  .trim()
  .min(2, 'Workspace name must be at least 2 characters')
  .max(100, 'Workspace name must not exceed 100 characters');

const workspaceTimezoneSchema = z.string().trim().min(1);
const workspaceLanguageSchema = z.string().trim().min(2).max(10);

export const createWorkspaceSchema = z.object({
  name: workspaceNameSchema,
  slug: z
    .string()
    .trim()
    .min(2, 'Slug must be at least 2 characters')
    .max(100, 'Slug must not exceed 100 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase alphanumeric characters and hyphens')
    .optional(),
  timezone: workspaceTimezoneSchema.optional(),
  defaultLanguage: workspaceLanguageSchema.optional(),
});
export type CreateWorkspaceDto = z.infer<typeof createWorkspaceSchema>;

export const updateWorkspaceSchema = z.object({
  name: workspaceNameSchema.optional(),
  timezone: workspaceTimezoneSchema.optional(),
  defaultLanguage: workspaceLanguageSchema.optional(),
  settings: z.record(z.unknown()).optional(),
});
export type UpdateWorkspaceDto = z.infer<typeof updateWorkspaceSchema>;

export interface WorkspaceDto {
  id: string;
  name: string;
  slug: string;
  billingPlan: BillingPlanType | keyof typeof BillingPlanType;
  timezone: string;
  defaultLanguage: string;
  settings?: Record<string, unknown> | null;
  createdAt: string | Date;
  updatedAt?: string | Date;
}

export interface UserWorkspaceDto extends WorkspaceDto {
  role: WorkspaceRole;
}

export interface WorkspaceMemberDto {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  createdAt: string | Date;
  updatedAt?: string | Date;
}
