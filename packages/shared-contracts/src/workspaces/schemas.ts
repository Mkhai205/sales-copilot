import { z } from 'zod';
import { BillingPlanType } from './enums';
import { WorkspaceRole } from '../auth/enums';

export const createWorkspaceSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(100).optional(),
});
export type CreateWorkspaceDto = z.infer<typeof createWorkspaceSchema>;

export const updateWorkspaceSchema = createWorkspaceSchema.partial();
export type UpdateWorkspaceDto = z.infer<typeof updateWorkspaceSchema>;

export interface WorkspaceDto {
  id: string;
  name: string;
  slug: string;
  billingPlan: BillingPlanType;
  timezone: string;
  defaultLanguage: string;
  settings?: Record<string, unknown>;
  createdAt: string;
}

export interface WorkspaceMemberDto {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  createdAt: string;
}
