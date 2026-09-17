export enum WebhookDeliveryStatus {
  PENDING = 'PENDING',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
  EXHAUSTED = 'EXHAUSTED',
}

/**
 * Standard domain event types supported for outbound webhook subscriptions.
 */
export enum WebhookEventType {
  // Conversation events
  CONVERSATION_CREATED = 'conversation.created',
  CONVERSATION_UPDATED = 'conversation.updated',
  CONVERSATION_STATUS_UPDATED = 'conversation.status_updated',
  CONVERSATION_REOPENED = 'conversation.reopened',
  CONVERSATION_ASSIGNED = 'conversation.assigned',
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

  // Channel identity events
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
}
