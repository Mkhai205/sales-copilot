import type { MessageResponseDto } from '../../omnichannel/messages/schemas';
import type { ConversationResponseDto } from '../../omnichannel/conversations/schemas';
import type { ConversationAssignedEvent } from '../../omnichannel/conversations/schemas';
import type { ConversationLabelsUpdatedEvent } from '../../omnichannel/conversations/schemas';
import type { ConversationPriorityUpdatedEvent } from '../../omnichannel/conversations/schemas';
import type { ContactDto } from '../../omnichannel/contacts/schemas';
import type { ContactUpdatedEvent } from '../../omnichannel/contacts/schemas';
import type { WsServerEvent } from './schemas';
import type {
  ChannelCreatedEvent,
  ChannelDeletedEvent,
  ChannelUpdatedEvent,
  CommerceCollisionStatusPayload,
  InventoryUpdatedEventPayload,
  MessageDeletedEvent,
  OrderCancelledEventPayload,
  OrderCompletedEventPayload,
  OrderConfirmedEventPayload,
  OrderCreatedEventPayload,
  OrderPaidEventPayload,
  OrderPartiallyPaidEventPayload,
  OrderUpdatedEventPayload,
  PaymentTransactionEventPayload,
  PresenceUpdatedEvent,
  TypingEventPayload,
} from './event-payloads';

/**
 * Wire-shape type map for realtime server events.
 *
 * Keys are the `WsServerEvent` string constants; values describe the payload
 * AFTER the client unwraps the `{ event, data }` envelope emitted by
 * RealtimeEventDispatcher. Where the dispatcher can broadcast either a bare
 * DTO or a full domain-event object (e.g. conversation.assigned sends the
 * event only when no conversation snapshot is available), the union models
 * that reality.
 *
 * Events intentionally omitted (LABEL_*, CHANNEL_IDENTITY_*) have no client
 * listeners yet — they fall back to the `unknown` overload of useSocketEvent.
 */
export interface SocketEventPayloadMap {
  [WsServerEvent.MESSAGE_CREATED]: MessageResponseDto;
  [WsServerEvent.MESSAGE_UPDATED]: MessageResponseDto;
  [WsServerEvent.MESSAGE_DELETED]: MessageDeletedEvent;
  [WsServerEvent.MESSAGE_DELIVERY_STATUS_UPDATED]: MessageResponseDto;

  [WsServerEvent.CONVERSATION_CREATED]: ConversationResponseDto;
  [WsServerEvent.CONVERSATION_UPDATED]: ConversationResponseDto;
  [WsServerEvent.CONVERSATION_STATUS_UPDATED]: ConversationResponseDto;
  [WsServerEvent.CONVERSATION_STATUS_CHANGED]: ConversationResponseDto;
  [WsServerEvent.CONVERSATION_REOPENED]: ConversationResponseDto;
  [WsServerEvent.CONVERSATION_ASSIGNED]: ConversationAssignedEvent | ConversationResponseDto;
  [WsServerEvent.CONVERSATION_PRIORITY_UPDATED]:
    ConversationPriorityUpdatedEvent | ConversationResponseDto;
  [WsServerEvent.CONVERSATION_LABELS_UPDATED]:
    ConversationLabelsUpdatedEvent | ConversationResponseDto;

  [WsServerEvent.CONTACT_UPDATED]: ContactUpdatedEvent | ContactDto;

  [WsServerEvent.CHANNEL_CREATED]: ChannelCreatedEvent;
  [WsServerEvent.CHANNEL_UPDATED]: ChannelUpdatedEvent;
  [WsServerEvent.CHANNEL_DELETED]: ChannelDeletedEvent;

  [WsServerEvent.PRESENCE_UPDATED]: PresenceUpdatedEvent;
  [WsServerEvent.TYPING_START]: TypingEventPayload;
  [WsServerEvent.TYPING_STOP]: TypingEventPayload;

  [WsServerEvent.ORDER_CREATED]: OrderCreatedEventPayload;
  [WsServerEvent.ORDER_UPDATED]: OrderUpdatedEventPayload;
  [WsServerEvent.ORDER_CONFIRMED]: OrderConfirmedEventPayload;
  [WsServerEvent.ORDER_PAID]: OrderPaidEventPayload;
  [WsServerEvent.ORDER_PARTIALLY_PAID]: OrderPartiallyPaidEventPayload;
  [WsServerEvent.ORDER_CANCELLED]: OrderCancelledEventPayload;
  [WsServerEvent.ORDER_COMPLETED]: OrderCompletedEventPayload;
  [WsServerEvent.INVENTORY_UPDATED]: InventoryUpdatedEventPayload;
  [WsServerEvent.COMMERCE_COLLISION_STATUS]: CommerceCollisionStatusPayload;
  [WsServerEvent.PAYMENT_TRANSACTION_CREATED]: PaymentTransactionEventPayload;
  [WsServerEvent.PAYMENT_TRANSACTION_UPDATED]: PaymentTransactionEventPayload;
}
