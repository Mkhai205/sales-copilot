import {
  AutomationActionType,
  AutomationAttribute,
  AutomationEventTrigger,
  AutomationOperator,
  ConversationPriority,
  ConversationStatus,
  SenderType,
} from '@sales-copilot/shared-contracts';

export interface TriggerOption {
  value: AutomationEventTrigger;
  label: string;
  description: string;
  badgeColor: string;
}

export const TRIGGER_OPTIONS: TriggerOption[] = [
  {
    value: AutomationEventTrigger.CONVERSATION_CREATED,
    label: 'Conversation Created',
    description: 'Runs immediately when a new conversation is started by a contact or agent.',
    badgeColor: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400',
  },
  {
    value: AutomationEventTrigger.MESSAGE_CREATED,
    label: 'Message Created',
    description: 'Runs whenever an inbound or outbound message is posted in any conversation.',
    badgeColor: 'border-violet-500/30 bg-violet-500/10 text-violet-400',
  },
  {
    value: AutomationEventTrigger.CONVERSATION_STATUS_CHANGED,
    label: 'Conversation Status Changed',
    description: 'Runs whenever a conversation status transitions (e.g. Open, Pending, Resolved).',
    badgeColor: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
  },
];

export type AttributeDataType =
  'string' | 'status' | 'priority' | 'inbox' | 'team' | 'agent' | 'sender_type';

export interface AttributeOption {
  value: AutomationAttribute;
  label: string;
  dataType: AttributeDataType;
  allowedOperators: AutomationOperator[];
}

export const ATTRIBUTE_OPTIONS: AttributeOption[] = [
  {
    value: AutomationAttribute.CONTENT,
    label: 'Message Content',
    dataType: 'string',
    allowedOperators: [
      AutomationOperator.CONTAINS,
      AutomationOperator.NOT_CONTAINS,
      AutomationOperator.EQUAL,
      AutomationOperator.IS_PRESENT,
      AutomationOperator.IS_NOT_PRESENT,
    ],
  },
  {
    value: AutomationAttribute.STATUS,
    label: 'Conversation Status',
    dataType: 'status',
    allowedOperators: [AutomationOperator.EQUAL, AutomationOperator.NOT_EQUAL],
  },
  {
    value: AutomationAttribute.PRIORITY,
    label: 'Priority',
    dataType: 'priority',
    allowedOperators: [AutomationOperator.EQUAL, AutomationOperator.NOT_EQUAL],
  },
  {
    value: AutomationAttribute.INBOX_ID,
    label: 'Inbox',
    dataType: 'inbox',
    allowedOperators: [
      AutomationOperator.EQUAL,
      AutomationOperator.NOT_EQUAL,
      AutomationOperator.IS_PRESENT,
      AutomationOperator.IS_NOT_PRESENT,
    ],
  },
  {
    value: AutomationAttribute.TEAM_ID,
    label: 'Assigned Team',
    dataType: 'team',
    allowedOperators: [
      AutomationOperator.EQUAL,
      AutomationOperator.NOT_EQUAL,
      AutomationOperator.IS_PRESENT,
      AutomationOperator.IS_NOT_PRESENT,
    ],
  },
  {
    value: AutomationAttribute.ASSIGNEE_ID,
    label: 'Assigned Agent',
    dataType: 'agent',
    allowedOperators: [
      AutomationOperator.EQUAL,
      AutomationOperator.NOT_EQUAL,
      AutomationOperator.IS_PRESENT,
      AutomationOperator.IS_NOT_PRESENT,
    ],
  },
  {
    value: AutomationAttribute.SENDER_TYPE,
    label: 'Sender Type',
    dataType: 'sender_type',
    allowedOperators: [AutomationOperator.EQUAL, AutomationOperator.NOT_EQUAL],
  },
];

export interface OperatorOption {
  value: AutomationOperator;
  label: string;
  requiresValue: boolean;
}

export const OPERATOR_OPTIONS: Record<AutomationOperator, OperatorOption> = {
  [AutomationOperator.EQUAL]: {
    value: AutomationOperator.EQUAL,
    label: 'is equal to',
    requiresValue: true,
  },
  [AutomationOperator.NOT_EQUAL]: {
    value: AutomationOperator.NOT_EQUAL,
    label: 'is not equal to',
    requiresValue: true,
  },
  [AutomationOperator.CONTAINS]: {
    value: AutomationOperator.CONTAINS,
    label: 'contains keyword',
    requiresValue: true,
  },
  [AutomationOperator.NOT_CONTAINS]: {
    value: AutomationOperator.NOT_CONTAINS,
    label: 'does not contain',
    requiresValue: true,
  },
  [AutomationOperator.IS_PRESENT]: {
    value: AutomationOperator.IS_PRESENT,
    label: 'is set / not empty',
    requiresValue: false,
  },
  [AutomationOperator.IS_NOT_PRESENT]: {
    value: AutomationOperator.IS_NOT_PRESENT,
    label: 'is not set / empty',
    requiresValue: false,
  },
};

export interface ActionTypeOption {
  value: AutomationActionType;
  label: string;
  description: string;
}

export const ACTION_TYPE_OPTIONS: ActionTypeOption[] = [
  {
    value: AutomationActionType.ASSIGN_AGENT,
    label: 'Assign to Agent',
    description: 'Assigns the conversation to a specific workspace team member.',
  },
  {
    value: AutomationActionType.ASSIGN_TEAM,
    label: 'Assign to Team',
    description: 'Routes the conversation to a specific team inbox queue.',
  },
  {
    value: AutomationActionType.ADD_LABEL,
    label: 'Add Label',
    description: 'Tags the conversation with a label (creates label if not present).',
  },
  {
    value: AutomationActionType.REMOVE_LABEL,
    label: 'Remove Label',
    description: 'Removes an existing label tag from the conversation.',
  },
  {
    value: AutomationActionType.CHANGE_STATUS,
    label: 'Change Status',
    description: 'Updates conversation state to Open, Pending, Resolved, or Snoozed.',
  },
  {
    value: AutomationActionType.CHANGE_PRIORITY,
    label: 'Change Priority',
    description: 'Sets urgency level: Urgent, High, Medium, Low, or None.',
  },
  {
    value: AutomationActionType.SEND_WEBHOOK,
    label: 'Send Webhook',
    description: 'Dispatches an instant HTTP POST webhook payload to an external endpoint.',
  },
];

export const STATUS_SELECT_OPTIONS = [
  { value: ConversationStatus.OPEN, label: 'Open' },
  { value: ConversationStatus.PENDING, label: 'Pending' },
  { value: ConversationStatus.SNOOZED, label: 'Snoozed' },
  { value: ConversationStatus.RESOLVED, label: 'Resolved' },
];

export const PRIORITY_SELECT_OPTIONS = [
  { value: ConversationPriority.URGENT, label: 'Urgent' },
  { value: ConversationPriority.HIGH, label: 'High' },
  { value: ConversationPriority.MEDIUM, label: 'Medium' },
  { value: ConversationPriority.LOW, label: 'Low' },
];

export const SENDER_TYPE_SELECT_OPTIONS = [
  { value: SenderType.CONTACT, label: 'Customer / Contact' },
  { value: SenderType.USER, label: 'Agent / Team Member' },
  { value: SenderType.SYSTEM, label: 'System' },
];
