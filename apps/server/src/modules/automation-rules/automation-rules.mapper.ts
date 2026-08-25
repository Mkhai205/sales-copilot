import type { AutomationRule } from '../../infrastructure/database/generated/client';
import type {
  AutomationAction,
  AutomationCondition,
  AutomationEventTrigger,
  AutomationRuleDto,
} from '@sales-copilot/shared-contracts';

/**
 * Maps a Prisma AutomationRule entity to its corresponding API response DTO.
 */
export function mapAutomationRuleToDto(rule: AutomationRule): AutomationRuleDto {
  return {
    id: rule.id,
    workspaceId: rule.workspaceId,
    name: rule.name,
    description: rule.description ?? null,
    eventTrigger: rule.eventTrigger as AutomationEventTrigger,
    conditions: (Array.isArray(rule.conditions) ? rule.conditions : []) as AutomationCondition[],
    actions: (Array.isArray(rule.actions) ? rule.actions : []) as AutomationAction[],
    isActive: rule.isActive,
    createdAt: rule.createdAt instanceof Date ? rule.createdAt.toISOString() : rule.createdAt,
    updatedAt: rule.updatedAt instanceof Date ? rule.updatedAt.toISOString() : rule.updatedAt,
  };
}
