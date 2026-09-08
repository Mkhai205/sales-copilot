import { z } from 'zod';
import { LeadGrade } from '../sales/enums';

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

  // Conversation Intelligence events (Milestone 2B - Epic 2.4 & Epic 2.5)
  CONVERSATION_INTELLIGENCE_ANALYZED = 'conversation.intelligence_analyzed',
  CONVERSATION_URGENT_ALERT = 'conversation.urgent_alert',
  LEAD_SCORE_UPDATED = 'lead_score.updated',

  // Sales Copilot events (Milestone 2C - Epic 2.6)
  COPILOT_SUGGESTION_GENERATED = 'copilot.suggestion_generated',
  COPILOT_SUGGESTION_CHUNK = 'copilot.suggestion_chunk',
  COPILOT_SUGGESTION_ACTED = 'copilot.suggestion_acted',

  // POS & Order events (Milestone M1 & M2)
  ORDER_CREATED = 'order.created',
  ORDER_UPDATED = 'order.updated',
  ORDER_CONFIRMED = 'order.confirmed',
  ORDER_PAID = 'order.paid',
  ORDER_PARTIALLY_PAID = 'order.partially_paid',
  ORDER_CANCELLED = 'order.cancelled',
  INVENTORY_UPDATED = 'inventory.updated',
  POS_COLLISION_STATUS = 'pos.collision_status',
  ORDER_SHIPPED = 'order.shipped',
  POS_DRAFT_SUGGESTED = 'pos.draft_suggested',
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

  // POS Collision events (Milestone M2)
  POS_EDITING_START = 'pos.editing_start',
  POS_EDITING_HEARTBEAT = 'pos.editing_heartbeat',
  POS_EDITING_STOP = 'pos.editing_stop',
  POS_EDITING_TAKEOVER = 'pos.editing_takeover',
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

export const leadScoreUpdatedEventPayloadSchema = z.object({
  workspaceId: z.string().uuid('Invalid workspace ID format (UUID expected)'),
  leadId: z.string().uuid('Invalid lead ID format (UUID expected)'),
  score: z.number().int().min(0).max(100),
  grade: z.nativeEnum(LeadGrade),
  previousScore: z.number().int().min(0).max(100).optional(),
  previousGrade: z.nativeEnum(LeadGrade).optional(),
  scoreFactors: z.record(z.unknown()),
  triggerReason: z.string(),
});
export type LeadScoreUpdatedEventPayloadDto = z.infer<typeof leadScoreUpdatedEventPayloadSchema>;

export const posEditingActionSchema = z.object({
  workspaceId: z.string().uuid('Invalid workspace ID format (UUID expected)'),
  conversationId: z.string().uuid('Invalid conversation ID format (UUID expected)'),
});
export type PosEditingActionDto = z.infer<typeof posEditingActionSchema>;

export const orderShippedEventPayloadSchema = z.object({
  workspaceId: z.string().uuid(),
  orderId: z.string().uuid(),
  orderNumber: z.string(),
  displayId: z.number(),
  conversationId: z.string().uuid().optional().nullable(),
  trackingCode: z.string(),
  shippingCarrier: z.string(),
  shippedAt: z.union([z.string(), z.date()]),
  order: z.record(z.unknown()),
});
export type OrderShippedEventPayloadDto = z.infer<typeof orderShippedEventPayloadSchema>;

export const posDraftSuggestedEventPayloadSchema = z.object({
  workspaceId: z.string().uuid(),
  conversationId: z.string().uuid(),
  contactId: z.string().uuid().optional().nullable(),
  suggestedCustomer: z
    .object({
      recipientName: z.string().optional(),
      phoneNumber: z.string().optional(),
      carrierNetwork: z.string().optional(),
      streetAddress: z.string().optional(),
      ward: z.string().optional(),
      district: z.string().optional(),
      province: z.string().optional(),
    })
    .optional(),
  suggestedItems: z
    .array(
      z.object({
        productId: z.string().optional(),
        variantId: z.string().optional(),
        productName: z.string(),
        variantName: z.string().optional().nullable(),
        sku: z.string().optional().nullable(),
        quantity: z.number(),
        unitPrice: z.number().optional(),
      }),
    )
    .optional(),
  rawExtractedData: z.record(z.unknown()).optional(),
  confidenceScore: z.number(),
  messageId: z.string().optional(),
});
export type PosDraftSuggestedEventPayloadDto = z.infer<typeof posDraftSuggestedEventPayloadSchema>;
