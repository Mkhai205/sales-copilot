import { z } from 'zod';
import { ConversationPriority, ConversationStatus } from '../conversations/enums';

export enum AutomationEventTrigger {
  MESSAGE_CREATED = 'MESSAGE_CREATED',
  CONVERSATION_CREATED = 'CONVERSATION_CREATED',
  CONVERSATION_STATUS_CHANGED = 'CONVERSATION_STATUS_CHANGED',
}

export enum AutomationAttribute {
  STATUS = 'status',
  INBOX_ID = 'inboxId',
  TEAM_ID = 'teamId',
  ASSIGNEE_ID = 'assigneeId',
  PRIORITY = 'priority',
  CONTENT = 'content',
  SENDER_TYPE = 'senderType',
}

export enum AutomationOperator {
  EQUAL = 'EQUAL',
  NOT_EQUAL = 'NOT_EQUAL',
  CONTAINS = 'CONTAINS',
  NOT_CONTAINS = 'NOT_CONTAINS',
  IS_PRESENT = 'IS_PRESENT',
  IS_NOT_PRESENT = 'IS_NOT_PRESENT',
}

export enum AutomationActionType {
  ASSIGN_AGENT = 'ASSIGN_AGENT',
  ASSIGN_TEAM = 'ASSIGN_TEAM',
  ADD_LABEL = 'ADD_LABEL',
  REMOVE_LABEL = 'REMOVE_LABEL',
  SEND_WEBHOOK = 'SEND_WEBHOOK',
  CHANGE_STATUS = 'CHANGE_STATUS',
  CHANGE_PRIORITY = 'CHANGE_PRIORITY',
}

// -----------------------------------------------------------------------------
// Condition DSL Schema
// -----------------------------------------------------------------------------
export const automationConditionSchema = z.object({
  attribute: z.nativeEnum(AutomationAttribute),
  operator: z.nativeEnum(AutomationOperator),
  values: z.array(z.string()).optional().default([]),
});
export type AutomationCondition = z.infer<typeof automationConditionSchema>;

// -----------------------------------------------------------------------------
// Action DSL Schemas (Discriminated Union)
// -----------------------------------------------------------------------------
export const assignAgentActionSchema = z.object({
  type: z.literal(AutomationActionType.ASSIGN_AGENT),
  params: z.object({
    agentId: z.string().min(1, 'Agent ID is required'),
  }),
});

export const assignTeamActionSchema = z.object({
  type: z.literal(AutomationActionType.ASSIGN_TEAM),
  params: z.object({
    teamId: z.string().min(1, 'Team ID is required'),
  }),
});

export const addLabelActionSchema = z.object({
  type: z.literal(AutomationActionType.ADD_LABEL),
  params: z.object({
    labelTitle: z.string().min(1, 'Label title is required').max(50),
  }),
});

export const removeLabelActionSchema = z.object({
  type: z.literal(AutomationActionType.REMOVE_LABEL),
  params: z.object({
    labelTitle: z.string().min(1, 'Label title is required').max(50),
  }),
});

export const sendWebhookActionSchema = z.object({
  type: z.literal(AutomationActionType.SEND_WEBHOOK),
  params: z.object({
    url: z.string().url('Invalid webhook URL format'),
  }),
});

export const changeStatusActionSchema = z.object({
  type: z.literal(AutomationActionType.CHANGE_STATUS),
  params: z.object({
    status: z.nativeEnum(ConversationStatus),
  }),
});

export const changePriorityActionSchema = z.object({
  type: z.literal(AutomationActionType.CHANGE_PRIORITY),
  params: z.object({
    priority: z.nativeEnum(ConversationPriority),
  }),
});

export const automationActionSchema = z.discriminatedUnion('type', [
  assignAgentActionSchema,
  assignTeamActionSchema,
  addLabelActionSchema,
  removeLabelActionSchema,
  sendWebhookActionSchema,
  changeStatusActionSchema,
  changePriorityActionSchema,
]);
export type AutomationAction = z.infer<typeof automationActionSchema>;

// -----------------------------------------------------------------------------
// CRUD Schemas
// -----------------------------------------------------------------------------
export const createAutomationRuleSchema = z.object({
  name: z.string().min(1, 'Rule name is required').max(100),
  description: z.string().max(500).optional().nullable(),
  eventTrigger: z.nativeEnum(AutomationEventTrigger),
  conditions: z.array(automationConditionSchema).default([]),
  actions: z.array(automationActionSchema).min(1, 'At least one action is required'),
  isActive: z.boolean().default(true),
});
export type CreateAutomationRuleDto = z.input<typeof createAutomationRuleSchema>;

export const updateAutomationRuleSchema = z.object({
  name: z.string().min(1, 'Rule name is required').max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  eventTrigger: z.nativeEnum(AutomationEventTrigger).optional(),
  conditions: z.array(automationConditionSchema).optional(),
  actions: z.array(automationActionSchema).min(1, 'At least one action is required').optional(),
  isActive: z.boolean().optional(),
});
export type UpdateAutomationRuleDto = z.input<typeof updateAutomationRuleSchema>;

export const automationRuleListQuerySchema = z.object({
  isActive: z
    .preprocess(val => {
      if (typeof val === 'string') {
        if (val.toLowerCase() === 'true') return true;
        if (val.toLowerCase() === 'false') return false;
      }
      return val;
    }, z.boolean().optional())
    .optional(),
  eventTrigger: z.nativeEnum(AutomationEventTrigger).optional(),
  search: z.string().optional(),
  q: z.string().optional(),
});
export type AutomationRuleListQueryDto = z.input<typeof automationRuleListQuerySchema>;

// -----------------------------------------------------------------------------
// Response DTO
// -----------------------------------------------------------------------------
export interface AutomationRuleDto {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  eventTrigger: AutomationEventTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
