import { z } from 'zod';

export const createAutomationRuleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  eventName: z.string().min(1),
  conditions: z.array(z.record(z.unknown())),
  actions: z.array(z.record(z.unknown())),
  isActive: z.boolean().default(true),
});
export type CreateAutomationRuleDto = z.infer<typeof createAutomationRuleSchema>;

export const updateAutomationRuleSchema = createAutomationRuleSchema.partial();
export type UpdateAutomationRuleDto = z.infer<typeof updateAutomationRuleSchema>;

export interface AutomationRuleDto {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  eventName: string;
  conditions: Record<string, unknown>[];
  actions: Record<string, unknown>[];
  isActive: boolean;
  createdAt: string;
}
