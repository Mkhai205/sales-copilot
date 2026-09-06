import type { ChannelType } from '../inboxes/enums';
import type { MessageResponseDto } from '../messages/schemas';

// ============================================================================
// 1. Domain Event Name Constants
// ============================================================================

/**
 * Domain events emitted throughout the application lifecycle.
 * Consumed by RealtimeEventDispatcher, WebhookDispatcher, etc.
 */
export enum DomainEvent {
  // Message events
  MESSAGE_CREATED = 'message.created',
  MESSAGE_UPDATED = 'message.updated',
  MESSAGE_DELETED = 'message.deleted',
  MESSAGE_DELIVERY_STATUS_UPDATED = 'message.delivery_status_updated',

  // Conversation events
  CONVERSATION_CREATED = 'conversation.created',
  CONVERSATION_UPDATED = 'conversation.updated',
  CONVERSATION_STATUS_UPDATED = 'conversation.status_updated',
  CONVERSATION_REOPENED = 'conversation.reopened',
  CONVERSATION_ASSIGNED = 'conversation.assigned',
  CONVERSATION_PRIORITY_UPDATED = 'conversation.priority_updated',
  CONVERSATION_LABELS_UPDATED = 'conversation.labels_updated',

  // Contact events
  CONTACT_CREATED = 'contact.created',
  CONTACT_UPDATED = 'contact.updated',
  CONTACT_DELETED = 'contact.deleted',
  CONTACT_MERGED = 'contact.merged',

  // Channel Identity events
  CHANNEL_IDENTITY_CREATED = 'channel_identity.created',
  CHANNEL_IDENTITY_DELETED = 'channel_identity.deleted',

  // Label events
  LABEL_CREATED = 'label.created',
  LABEL_UPDATED = 'label.updated',
  LABEL_DELETED = 'label.deleted',

  // Channel events
  CHANNEL_CREATED = 'channel.created',
  CHANNEL_UPDATED = 'channel.updated',
  CHANNEL_DELETED = 'channel.deleted',

  // Presence events
  PRESENCE_UPDATED = 'presence.updated',

  // Typing events
  TYPING_START = 'typing.start',
  TYPING_STOP = 'typing.stop',

  // Sales events (Milestone 2A - Epic 2.1 & 2.2)
  LEAD_CREATED = 'lead.created',
  LEAD_UPDATED = 'lead.updated',
  LEAD_CONVERTED = 'lead.converted',
  OPPORTUNITY_CREATED = 'opportunity.created',
  OPPORTUNITY_STAGE_UPDATED = 'opportunity.stage_updated',
  SALES_EVIDENCE_DETECTED = 'sales_evidence.detected',
  SALES_EVIDENCE_INVALIDATED = 'sales_evidence.invalidated',
}

// ============================================================================
// 2. Base Event Payload
// ============================================================================

/**
 * All tenant-scoped domain events must include workspaceId.
 */
export interface BaseDomainEventPayload {
  workspaceId: string;
}

// ============================================================================
// 3. Presence Event & Types
// ============================================================================

export enum PresenceStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  AWAY = 'AWAY',
}

export interface PresenceEntry {
  userId: string;
  status: PresenceStatus;
  lastSeenAt: string;
}

export interface PresenceUpdatedEvent extends BaseDomainEventPayload {
  userId: string;
  status: PresenceStatus;
  lastSeenAt: string;
}

// ============================================================================
// 4. Typing Event Payload
// ============================================================================

export interface TypingEventPayload extends BaseDomainEventPayload {
  conversationId: string;
  userId?: string | null;
  contactId?: string | null;
  isTyping: boolean;
  isPrivate?: boolean;
}

// ============================================================================
// 5. Message Event Payloads
// ============================================================================

export interface MessageUpdatedEvent extends BaseDomainEventPayload {
  conversationId: string;
  messageId: string;
  message: MessageResponseDto;
  previousChanges?: Record<string, unknown>;
}

export interface MessageDeletedEvent extends BaseDomainEventPayload {
  conversationId: string;
  messageId: string;
}

// ============================================================================
// 6. Channel Event Payloads
// ============================================================================

export interface ChannelCreatedEvent extends BaseDomainEventPayload {
  inboxId: string;
  channelId: string;
  channelType: ChannelType;
}

export interface ChannelUpdatedEvent extends BaseDomainEventPayload {
  inboxId: string;
  channelId: string;
  channelType: ChannelType;
}

export interface ChannelDeletedEvent extends BaseDomainEventPayload {
  inboxId: string;
  channelId: string;
  channelType: ChannelType;
}

// ============================================================================
// 7. Sales Event Payloads (Epic 2.1)
// ============================================================================

export interface LeadCreatedEvent extends BaseDomainEventPayload {
  leadId: string;
  contactId: string;
  status: string;
  stage: string;
  score: number;
  assignedUserId?: string | null;
  lead: Record<string, unknown>;
}

export interface LeadUpdatedEvent extends BaseDomainEventPayload {
  leadId: string;
  contactId: string;
  status: string;
  stage: string;
  score: number;
  assignedUserId?: string | null;
  lead: Record<string, unknown>;
  previousChanges?: Record<string, unknown>;
}

export interface LeadConvertedEvent extends BaseDomainEventPayload {
  leadId: string;
  contactId: string;
  opportunityId: string;
  lead: Record<string, unknown>;
  opportunity: Record<string, unknown>;
}

export interface OpportunityCreatedEvent extends BaseDomainEventPayload {
  opportunityId: string;
  leadId?: string | null;
  contactId: string;
  stage: string;
  amount: number;
  currency: string;
  assignedUserId?: string | null;
  opportunity: Record<string, unknown>;
}

export interface OpportunityStageUpdatedEvent extends BaseDomainEventPayload {
  opportunityId: string;
  stage: string;
  previousStage?: string;
  lostReason?: string | null;
  opportunity: Record<string, unknown>;
}

export interface SalesEvidenceDetectedEvent extends BaseDomainEventPayload {
  leadId?: string | null;
  conversationId: string;
  messageId?: string | null;
  evidence: Record<string, unknown>;
}

export interface SalesEvidenceInvalidatedEvent extends BaseDomainEventPayload {
  leadId?: string | null;
  conversationId: string;
  evidenceId: string;
  invalidatedByUserId?: string | null;
  invalidationReason?: string | null;
  evidence: Record<string, unknown>;
}
