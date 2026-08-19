export interface DomainEvent<T = unknown> {
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  organizationId: string;
  workspaceId: string;
  timestamp: string;
  version: number;
  payload: T;
}

export interface MessageReceivedPayload {
  messageId: string;
  conversationId: string;
  contactId: string;
  inboxId: string;
  content: string;
  senderType: string;
  channelType: string;
}

export interface LeadScoreUpdatedPayload {
  leadId: string;
  contactId: string;
  previousScore?: number;
  newScore: number;
  confidence: number;
  reason: string;
  signals: string[];
}

export interface ConversationAssignedPayload {
  conversationId: string;
  previousAssigneeId?: string;
  newAssigneeId?: string;
  teamId?: string;
  assignedByUserId?: string;
}

export interface ContactMergedPayload {
  primaryContactId: string;
  mergedContactId: string;
  mergedByUserId: string;
}
