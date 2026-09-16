import { BillingPlanType, WorkspaceRole } from '@sales-copilot/shared-contracts';

export interface WorkspaceContextData {
  id: string;
  name: string;
  slug: string;
  billingPlan: BillingPlanType | keyof typeof BillingPlanType;
  timezone: string;
  defaultLanguage: string;
  settings?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceContext {
  workspaceId: string;
  role: WorkspaceRole;
  workspace: WorkspaceContextData;
}
