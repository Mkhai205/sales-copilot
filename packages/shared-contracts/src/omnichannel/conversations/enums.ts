export enum ConversationStatus {
  OPEN = 'OPEN',
  RESOLVED = 'RESOLVED',
  PENDING = 'PENDING',
  SNOOZED = 'SNOOZED',
}

export enum Priority {
  URGENT = 'URGENT',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export { Priority as ConversationPriority };
