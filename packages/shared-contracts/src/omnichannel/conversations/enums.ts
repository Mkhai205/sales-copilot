export const ConversationStatus = {
  OPEN: 'OPEN',
  RESOLVED: 'RESOLVED',
  PENDING: 'PENDING',
  SNOOZED: 'SNOOZED',
} as const;

export type ConversationStatus = (typeof ConversationStatus)[keyof typeof ConversationStatus];

export const ConversationPriority = {
  URGENT: 'URGENT',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
} as const;

export type ConversationPriority = (typeof ConversationPriority)[keyof typeof ConversationPriority];
