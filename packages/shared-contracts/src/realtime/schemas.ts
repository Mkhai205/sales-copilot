import { z } from 'zod';

// ============================================================================
// 1. WebSocket Server Event Enums
// ============================================================================

export enum WsServerEvent {
  // Conversation events
  CONVERSATION_CREATED = 'conversation.created',
  CONVERSATION_UPDATED = 'conversation.updated',
  CONVERSATION_STATUS_CHANGED = 'conversation.status_changed',
  CONVERSATION_STATUS_UPDATED = 'conversation.status_updated',
  CONVERSATION_ASSIGNED = 'conversation.assigned',
  CONVERSATION_REOPENED = 'conversation.reopened',
  CONVERSATION_PRIORITY_UPDATED = 'conversation.priority_updated',
  CONVERSATION_LABELS_UPDATED = 'conversation.labels_updated',

  // Message events
  MESSAGE_CREATED = 'message.created',
  MESSAGE_UPDATED = 'message.updated',
  MESSAGE_DELETED = 'message.deleted',
  MESSAGE_DELIVERY_STATUS_UPDATED = 'message.delivery_status_updated',

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
  PRESENCE_UPDATE = 'presence.update',
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
// 2. WebSocket Client Event Enums
// ============================================================================

export enum WsClientEvent {
  JOIN_WORKSPACE = 'join_workspace',
  LEAVE_WORKSPACE = 'leave_workspace',
  JOIN_CONVERSATION = 'join_conversation',
  LEAVE_CONVERSATION = 'leave_conversation',
  START_TYPING = 'start_typing',
  STOP_TYPING = 'stop_typing',
  HEARTBEAT = 'heartbeat',
}

// ============================================================================
// 3. WebSocket Generic Event Envelope
// ============================================================================

export interface WsEventPayload<T = unknown> {
  event: WsServerEvent | string;
  workspaceId: string;
  timestamp?: string;
  data: T;
}

// ============================================================================
// 4. WebSocket Client Request Validation Schemas
// ============================================================================

export const joinWorkspaceSchema = z.object({
  workspaceId: z.string().uuid('Invalid workspace ID format (UUID expected)'),
});
export type JoinWorkspaceDto = z.infer<typeof joinWorkspaceSchema>;

export const leaveWorkspaceSchema = z.object({
  workspaceId: z.string().uuid('Invalid workspace ID format (UUID expected)'),
});
export type LeaveWorkspaceDto = z.infer<typeof leaveWorkspaceSchema>;

export const joinConversationSchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID format (UUID expected)'),
});
export type JoinConversationDto = z.infer<typeof joinConversationSchema>;

export const leaveConversationSchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID format (UUID expected)'),
});
export type LeaveConversationDto = z.infer<typeof leaveConversationSchema>;

export const typingIndicatorSchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID format (UUID expected)'),
  isTyping: z.boolean(),
});
export type TypingIndicatorDto = z.infer<typeof typingIndicatorSchema>;
