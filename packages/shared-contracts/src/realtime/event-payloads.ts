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

  // POS & Order Automation events (Milestone M1 & M2)
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
// 7. POS & Order Automation Event Payloads (Milestone M1)
// ============================================================================

export interface OrderCreatedEventPayload extends BaseDomainEventPayload {
  orderId: string;
  orderNumber: string;
  displayId: number;
  conversationId?: string | null;
  order: Record<string, unknown>;
}

export interface OrderUpdatedEventPayload extends BaseDomainEventPayload {
  orderId: string;
  orderNumber: string;
  displayId: number;
  conversationId?: string | null;
  order: Record<string, unknown>;
}

export interface OrderConfirmedEventPayload extends BaseDomainEventPayload {
  orderId: string;
  orderNumber: string;
  displayId: number;
  conversationId?: string | null;
  confirmedAt: string | Date;
  reservedItems?: Array<{ variantId: string; quantity: number }>;
  order: Record<string, unknown>;
}

export interface OrderPaidEventPayload extends BaseDomainEventPayload {
  orderId: string;
  orderNumber: string;
  displayId: number;
  conversationId?: string | null;
  paidAmount: number;
  paymentMethod: string;
  transactionCode?: string | null;
  order: Record<string, unknown>;
}

export interface OrderPartiallyPaidEventPayload extends BaseDomainEventPayload {
  orderId: string;
  orderNumber: string;
  displayId: number;
  conversationId?: string | null;
  paidAmount: number;
  totalAmount: number;
  remainingAmount: number;
  paymentMethod: string;
  transactionCode?: string | null;
  order: Record<string, unknown>;
}

export interface OrderCancelledEventPayload extends BaseDomainEventPayload {
  orderId: string;
  orderNumber: string;
  displayId: number;
  conversationId?: string | null;
  cancelReason?: string | null;
  releasedStock: boolean;
  order: Record<string, unknown>;
}

export interface InventoryUpdatedEventPayload extends BaseDomainEventPayload {
  variantId: string;
  sku: string;
  previousStock: number;
  newStock: number;
  previousReserved: number;
  newReserved: number;
  availableStock: number;
  reason?: string | null;
}

export interface PosCollisionStatusPayload extends BaseDomainEventPayload {
  conversationId: string;
  isLocked: boolean;
  lockedBy?: {
    userId: string;
    userName?: string;
    userEmail?: string;
    avatarUrl?: string;
    startedAt: string;
    lastHeartbeatAt: string;
  } | null;
  remainingTtlSeconds?: number;
}

export interface OrderShippedEventPayload extends BaseDomainEventPayload {
  orderId: string;
  orderNumber: string;
  displayId: number;
  conversationId?: string | null;
  trackingCode: string;
  shippingCarrier: string;
  shippedAt: string | Date;
  order: Record<string, unknown>;
}

export interface PosDraftSuggestedEventPayload extends BaseDomainEventPayload {
  conversationId: string;
  contactId?: string | null;
  suggestedCustomer?: {
    recipientName?: string;
    phoneNumber?: string;
    carrierNetwork?: string;
    streetAddress?: string;
    ward?: string;
    district?: string;
    province?: string;
  };
  suggestedItems?: Array<{
    productId?: string;
    variantId?: string;
    productName: string;
    variantName?: string;
    sku?: string;
    quantity: number;
    unitPrice?: number;
  }>;
  rawExtractedData?: Record<string, unknown>;
  confidenceScore: number;
  messageId?: string;
}
