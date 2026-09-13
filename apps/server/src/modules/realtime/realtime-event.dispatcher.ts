import { Injectable, Logger, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  DomainEvent,
  WsServerEvent,
  MessageCreatedEvent,
  MessageUpdatedEvent,
  MessageDeletedEvent,
  MessageDeliveryStatusUpdatedEvent,
  ConversationCreatedEvent,
  ConversationUpdatedEvent,
  ConversationStatusUpdatedEvent,
  ConversationAssignedEvent,
  ConversationPriorityUpdatedEvent,
  ConversationReopenedEvent,
  ConversationLabelsUpdatedEvent,
  ContactCreatedEvent,
  ContactUpdatedEvent,
  ContactDeletedEvent,
  ContactMergedEvent,
  ChannelIdentityCreatedEvent,
  ChannelIdentityDeletedEvent,
  LabelCreatedEvent,
  LabelUpdatedEvent,
  LabelDeletedEvent,
  ChannelCreatedEvent,
  ChannelUpdatedEvent,
  ChannelDeletedEvent,
  PresenceUpdatedEvent,
  TypingEventPayload,
  OrderCreatedEventPayload,
  OrderUpdatedEventPayload,
  OrderConfirmedEventPayload,
  OrderPaidEventPayload,
  OrderPartiallyPaidEventPayload,
  OrderCancelledEventPayload,
  InventoryUpdatedEventPayload,
  OrderShippedEventPayload,
  PosDraftSuggestedEventPayload,
} from '@sales-copilot/shared-contracts';
import { RealtimeGateway } from './realtime.gateway';

/**
 * Bridges internal domain events (via EventEmitter2) to WebSocket rooms
 * on the RealtimeGateway.
 *
 * Implements strict error isolation: if broadcasting to a socket room fails,
 * it will never crash or disrupt the domain event pipeline.
 */
@Injectable()
export class RealtimeEventDispatcher {
  private readonly logger = new Logger(RealtimeEventDispatcher.name);

  constructor(@Optional() private readonly gateway?: RealtimeGateway) {}

  // ==========================================================================
  // 1. Message Domain Event Handlers
  // ==========================================================================

  @OnEvent(DomainEvent.MESSAGE_CREATED)
  handleMessageCreated(payload: MessageCreatedEvent): void {
    if (!payload?.workspaceId) return;

    const { workspaceId, conversationId, message } = payload;
    const data = message || payload;

    const rooms: string[] = [`workspace_${workspaceId}`];
    if (conversationId) {
      rooms.push(`conversation_${conversationId}`);
    }
    this.broadcastSafe(rooms, WsServerEvent.MESSAGE_CREATED, data);
  }

  @OnEvent(DomainEvent.MESSAGE_UPDATED)
  handleMessageUpdated(payload: MessageUpdatedEvent): void {
    if (!payload?.workspaceId) return;

    const { workspaceId, conversationId, message } = payload;
    const data = message || payload;

    const rooms: string[] = [`workspace_${workspaceId}`];
    if (conversationId) {
      rooms.push(`conversation_${conversationId}`);
    }
    this.broadcastSafe(rooms, WsServerEvent.MESSAGE_UPDATED, data);
  }

  @OnEvent(DomainEvent.MESSAGE_DELETED)
  handleMessageDeleted(payload: MessageDeletedEvent): void {
    if (!payload?.workspaceId) return;

    const { workspaceId, conversationId, messageId } = payload;
    const data = { conversationId, messageId };

    const rooms: string[] = [`workspace_${workspaceId}`];
    if (conversationId) {
      rooms.push(`conversation_${conversationId}`);
    }
    this.broadcastSafe(rooms, WsServerEvent.MESSAGE_DELETED, data);
  }

  @OnEvent(DomainEvent.MESSAGE_DELIVERY_STATUS_UPDATED)
  handleMessageDeliveryStatusUpdated(payload: MessageDeliveryStatusUpdatedEvent): void {
    if (!payload?.workspaceId) return;

    const { workspaceId, conversationId, message } = payload;
    const data = message || payload;

    const rooms: string[] = [`workspace_${workspaceId}`];
    if (conversationId) {
      rooms.push(`conversation_${conversationId}`);
    }
    this.broadcastSafe(rooms, WsServerEvent.MESSAGE_DELIVERY_STATUS_UPDATED, data);
  }

  // ==========================================================================
  // 2. Conversation Domain Event Handlers
  // ==========================================================================

  @OnEvent(DomainEvent.CONVERSATION_CREATED)
  handleConversationCreated(payload: ConversationCreatedEvent): void {
    if (!payload?.workspaceId) return;

    const { workspaceId, conversation } = payload;
    const data = conversation || payload;

    // New conversation broadcast to entire workspace
    this.broadcastSafe(`workspace_${workspaceId}`, WsServerEvent.CONVERSATION_CREATED, data);
  }

  @OnEvent(DomainEvent.CONVERSATION_UPDATED)
  handleConversationUpdated(payload: ConversationUpdatedEvent): void {
    if (!payload?.workspaceId) return;

    const { workspaceId, conversationId, conversation } = payload;
    const data = conversation || payload;

    const rooms: string[] = [`workspace_${workspaceId}`];
    if (conversationId) {
      rooms.push(`conversation_${conversationId}`);
    }
    this.broadcastSafe(rooms, WsServerEvent.CONVERSATION_UPDATED, data);
  }

  @OnEvent(DomainEvent.CONVERSATION_STATUS_UPDATED)
  handleConversationStatusUpdated(payload: ConversationStatusUpdatedEvent): void {
    if (!payload?.workspaceId) return;

    const { workspaceId, conversationId, conversation } = payload;
    const data = conversation || payload;

    const rooms: string[] = [`workspace_${workspaceId}`];
    if (conversationId) {
      rooms.push(`conversation_${conversationId}`);
    }
    this.broadcastSafe(rooms, WsServerEvent.CONVERSATION_STATUS_UPDATED, data);
  }

  @OnEvent(DomainEvent.CONVERSATION_REOPENED)
  handleConversationReopened(payload: ConversationReopenedEvent): void {
    if (!payload?.workspaceId) return;

    const { workspaceId, conversationId, conversation } = payload;
    const data = conversation || payload;

    const rooms: string[] = [`workspace_${workspaceId}`];
    if (conversationId) {
      rooms.push(`conversation_${conversationId}`);
    }
    this.broadcastSafe(rooms, WsServerEvent.CONVERSATION_REOPENED, data);
  }

  @OnEvent(DomainEvent.CONVERSATION_ASSIGNED)
  handleConversationAssigned(payload: ConversationAssignedEvent): void {
    const { workspaceId, conversationId, previousAssigneeId, newAssigneeId, conversation } =
      payload;
    const data = conversation || payload;

    const rooms: string[] = [];
    if (workspaceId) rooms.push(`workspace_${workspaceId}`);
    if (conversationId) rooms.push(`conversation_${conversationId}`);
    if (newAssigneeId) rooms.push(`user_${newAssigneeId}`);
    if (previousAssigneeId && previousAssigneeId !== newAssigneeId) {
      rooms.push(`user_${previousAssigneeId}`);
    }

    this.broadcastSafe(rooms, WsServerEvent.CONVERSATION_ASSIGNED, data);
  }

  @OnEvent(DomainEvent.CONVERSATION_PRIORITY_UPDATED)
  handleConversationPriorityUpdated(payload: ConversationPriorityUpdatedEvent): void {
    if (!payload?.workspaceId) return;

    const { workspaceId, conversationId, conversation } = payload;
    const data = conversation || payload;

    const rooms: string[] = [`workspace_${workspaceId}`];
    if (conversationId) {
      rooms.push(`conversation_${conversationId}`);
    }
    this.broadcastSafe(rooms, WsServerEvent.CONVERSATION_PRIORITY_UPDATED, data);
  }

  @OnEvent(DomainEvent.CONVERSATION_LABELS_UPDATED)
  handleConversationLabelsUpdated(payload: ConversationLabelsUpdatedEvent): void {
    if (!payload?.workspaceId) return;

    const { workspaceId, conversationId, conversation } = payload;
    const data = conversation || payload;

    const rooms: string[] = [`workspace_${workspaceId}`];
    if (conversationId) {
      rooms.push(`conversation_${conversationId}`);
    }
    this.broadcastSafe(rooms, WsServerEvent.CONVERSATION_LABELS_UPDATED, data);
  }

  // ==========================================================================
  // 3. Contact Domain Event Handlers (Task 6)
  // ==========================================================================

  @OnEvent(DomainEvent.CONTACT_CREATED)
  @OnEvent('contact.created')
  handleContactCreated(payload: ContactCreatedEvent): void {
    if (!payload?.workspaceId) return;
    const data = payload.contact || payload;
    this.broadcastSafe(`workspace_${payload.workspaceId}`, WsServerEvent.CONTACT_CREATED, data);
  }

  @OnEvent(DomainEvent.CONTACT_UPDATED)
  @OnEvent('contact.updated')
  handleContactUpdated(payload: ContactUpdatedEvent): void {
    if (!payload?.workspaceId) return;
    const data = payload.contact || payload;
    this.broadcastSafe(`workspace_${payload.workspaceId}`, WsServerEvent.CONTACT_UPDATED, data);
  }

  @OnEvent(DomainEvent.CONTACT_DELETED)
  @OnEvent('contact.deleted')
  handleContactDeleted(payload: ContactDeletedEvent): void {
    if (!payload?.workspaceId) return;
    const data = {
      contactId: payload.contactId,
      contact: payload.contact,
    };
    this.broadcastSafe(`workspace_${payload.workspaceId}`, WsServerEvent.CONTACT_DELETED, data);
  }

  @OnEvent(DomainEvent.CONTACT_MERGED)
  handleContactMerged(payload: ContactMergedEvent): void {
    if (!payload?.workspaceId) return;
    const data = {
      primaryContactId: payload.primaryContactId,
      mergedContactId: payload.mergedContactId,
      mergedByUserId: payload.mergedByUserId,
      mergedAttributes: payload.mergedAttributes,
    };
    this.broadcastSafe(`workspace_${payload.workspaceId}`, WsServerEvent.CONTACT_MERGED, data);
  }

  // ==========================================================================
  // 4. Channel Identity Domain Event Handlers (Task 6)
  // ==========================================================================

  @OnEvent(DomainEvent.CHANNEL_IDENTITY_CREATED)
  handleChannelIdentityCreated(payload: ChannelIdentityCreatedEvent): void {
    if (!payload?.workspaceId) return;
    const data = payload.identity || payload;
    this.broadcastSafe(
      `workspace_${payload.workspaceId}`,
      WsServerEvent.CHANNEL_IDENTITY_CREATED,
      data,
    );
  }

  @OnEvent(DomainEvent.CHANNEL_IDENTITY_DELETED)
  handleChannelIdentityDeleted(payload: ChannelIdentityDeletedEvent): void {
    if (!payload?.workspaceId) return;
    const data = {
      identityId: payload.identityId,
      contactId: payload.contactId,
      identity: payload.identity,
    };
    this.broadcastSafe(
      `workspace_${payload.workspaceId}`,
      WsServerEvent.CHANNEL_IDENTITY_DELETED,
      data,
    );
  }

  // ==========================================================================
  // 5. Label Domain Event Handlers (Task 6)
  // ==========================================================================

  @OnEvent(DomainEvent.LABEL_CREATED)
  handleLabelCreated(payload: LabelCreatedEvent): void {
    if (!payload?.workspaceId) return;
    const data = payload.label || payload;
    this.broadcastSafe(`workspace_${payload.workspaceId}`, WsServerEvent.LABEL_CREATED, data);
  }

  @OnEvent(DomainEvent.LABEL_UPDATED)
  handleLabelUpdated(payload: LabelUpdatedEvent): void {
    if (!payload?.workspaceId) return;
    const data = payload.label || payload;
    this.broadcastSafe(`workspace_${payload.workspaceId}`, WsServerEvent.LABEL_UPDATED, data);
  }

  @OnEvent(DomainEvent.LABEL_DELETED)
  handleLabelDeleted(payload: LabelDeletedEvent): void {
    if (!payload?.workspaceId) return;
    const data = {
      labelId: payload.labelId,
      label: payload.label,
    };
    this.broadcastSafe(`workspace_${payload.workspaceId}`, WsServerEvent.LABEL_DELETED, data);
  }

  // ==========================================================================
  // 6. Channel Domain Event Handlers (Task 6)
  // ==========================================================================

  @OnEvent(DomainEvent.CHANNEL_CREATED)
  handleChannelCreated(payload: ChannelCreatedEvent): void {
    if (!payload?.workspaceId) return;
    this.broadcastSafe(`workspace_${payload.workspaceId}`, WsServerEvent.CHANNEL_CREATED, payload);
  }

  @OnEvent(DomainEvent.CHANNEL_UPDATED)
  handleChannelUpdated(payload: ChannelUpdatedEvent): void {
    if (!payload?.workspaceId) return;
    this.broadcastSafe(`workspace_${payload.workspaceId}`, WsServerEvent.CHANNEL_UPDATED, payload);
  }

  @OnEvent(DomainEvent.CHANNEL_DELETED)
  handleChannelDeleted(payload: ChannelDeletedEvent): void {
    if (!payload?.workspaceId) return;
    this.broadcastSafe(`workspace_${payload.workspaceId}`, WsServerEvent.CHANNEL_DELETED, payload);
  }

  // ==========================================================================
  // 7. Typing Indicator Domain Event Handlers (Task 6)
  // ==========================================================================

  @OnEvent(DomainEvent.TYPING_START)
  handleTypingStart(payload: TypingEventPayload): void {
    if (!payload?.conversationId) return;
    const event = WsServerEvent.TYPING_START;
    const rooms = payload.workspaceId
      ? [`conversation_${payload.conversationId}`, `workspace_${payload.workspaceId}`]
      : `conversation_${payload.conversationId}`;
    this.broadcastSafe(rooms, event, payload);
  }

  @OnEvent(DomainEvent.TYPING_STOP)
  handleTypingStop(payload: TypingEventPayload): void {
    if (!payload?.conversationId) return;
    const event = WsServerEvent.TYPING_STOP;
    const rooms = payload.workspaceId
      ? [`conversation_${payload.conversationId}`, `workspace_${payload.workspaceId}`]
      : `conversation_${payload.conversationId}`;
    this.broadcastSafe(rooms, event, payload);
  }

  // ==========================================================================
  // 8. Presence Domain Event Handlers (Task 9)
  // ==========================================================================

  @OnEvent(DomainEvent.PRESENCE_UPDATED)
  handlePresenceUpdated(payload: PresenceUpdatedEvent): void {
    if (!payload?.workspaceId) return;
    const data = {
      userId: payload.userId,
      status: payload.status,
      lastSeenAt: payload.lastSeenAt,
    };
    this.broadcastSafe(`workspace_${payload.workspaceId}`, WsServerEvent.PRESENCE_UPDATED, data);
  }

  // ==========================================================================
  // 9. POS & Order Domain Event Handlers (Milestone M1 & M2)
  // ==========================================================================

  @OnEvent(DomainEvent.ORDER_CREATED)
  handleOrderCreated(payload: OrderCreatedEventPayload): void {
    if (!payload?.workspaceId) return;

    const rooms = payload.conversationId
      ? [`workspace_${payload.workspaceId}`, `conversation_${payload.conversationId}`]
      : `workspace_${payload.workspaceId}`;

    this.broadcastSafe(rooms, WsServerEvent.ORDER_CREATED, payload);
  }

  @OnEvent(DomainEvent.ORDER_UPDATED)
  handleOrderUpdated(payload: OrderUpdatedEventPayload): void {
    if (!payload?.workspaceId) return;

    const rooms = payload.conversationId
      ? [`workspace_${payload.workspaceId}`, `conversation_${payload.conversationId}`]
      : `workspace_${payload.workspaceId}`;

    this.broadcastSafe(rooms, WsServerEvent.ORDER_UPDATED, payload);
  }

  @OnEvent(DomainEvent.ORDER_CONFIRMED)
  handleOrderConfirmed(payload: OrderConfirmedEventPayload): void {
    if (!payload?.workspaceId) return;

    const rooms = payload.conversationId
      ? [`workspace_${payload.workspaceId}`, `conversation_${payload.conversationId}`]
      : `workspace_${payload.workspaceId}`;

    this.broadcastSafe(rooms, WsServerEvent.ORDER_CONFIRMED, payload);
  }

  @OnEvent(DomainEvent.ORDER_PAID)
  handleOrderPaid(payload: OrderPaidEventPayload): void {
    if (!payload?.workspaceId) return;

    const rooms = payload.conversationId
      ? [`workspace_${payload.workspaceId}`, `conversation_${payload.conversationId}`]
      : `workspace_${payload.workspaceId}`;

    this.broadcastSafe(rooms, WsServerEvent.ORDER_PAID, payload);
  }

  @OnEvent(DomainEvent.ORDER_PARTIALLY_PAID)
  handleOrderPartiallyPaid(payload: OrderPartiallyPaidEventPayload): void {
    if (!payload?.workspaceId) return;

    const rooms = payload.conversationId
      ? [`workspace_${payload.workspaceId}`, `conversation_${payload.conversationId}`]
      : `workspace_${payload.workspaceId}`;

    this.broadcastSafe(rooms, WsServerEvent.ORDER_PARTIALLY_PAID, payload);
  }

  @OnEvent(DomainEvent.ORDER_CANCELLED)
  handleOrderCancelled(payload: OrderCancelledEventPayload): void {
    if (!payload?.workspaceId) return;

    const rooms = payload.conversationId
      ? [`workspace_${payload.workspaceId}`, `conversation_${payload.conversationId}`]
      : `workspace_${payload.workspaceId}`;

    this.broadcastSafe(rooms, WsServerEvent.ORDER_CANCELLED, payload);
  }

  @OnEvent(DomainEvent.INVENTORY_UPDATED)
  handleInventoryUpdated(payload: InventoryUpdatedEventPayload): void {
    if (!payload?.workspaceId) return;

    this.broadcastSafe(
      `workspace_${payload.workspaceId}`,
      WsServerEvent.INVENTORY_UPDATED,
      payload,
    );
  }

  @OnEvent(DomainEvent.ORDER_SHIPPED)
  handleOrderShipped(payload: OrderShippedEventPayload): void {
    if (!payload?.workspaceId) return;

    const rooms = payload.conversationId
      ? [`workspace_${payload.workspaceId}`, `conversation_${payload.conversationId}`]
      : `workspace_${payload.workspaceId}`;

    this.broadcastSafe(rooms, WsServerEvent.ORDER_SHIPPED, payload);
  }

  @OnEvent(DomainEvent.POS_DRAFT_SUGGESTED)
  handlePosDraftSuggested(payload: PosDraftSuggestedEventPayload): void {
    if (!payload?.workspaceId) return;

    const rooms = payload.conversationId
      ? [`workspace_${payload.workspaceId}`, `conversation_${payload.conversationId}`]
      : `workspace_${payload.workspaceId}`;

    this.broadcastSafe(rooms, WsServerEvent.POS_DRAFT_SUGGESTED, payload);
  }

  // ==========================================================================
  // 13. Helper Method with Robust Error Isolation
  // ==========================================================================

  /**
   * Broadcasts a typed event envelope to a specific Socket.io room or multiple rooms with socket deduplication.
   * Catches all exceptions to ensure downstream domain workflows are not interrupted.
   */
  private broadcastSafe(
    room: string | string[],
    event: WsServerEvent | string,
    data: unknown,
  ): void {
    try {
      if (!this.gateway?.server) {
        return;
      }

      const rooms = Array.isArray(room) ? room.filter(Boolean) : [room];
      if (rooms.length === 0) {
        return;
      }

      const payload = {
        event,
        data,
      };

      // Emit on typed event channel (e.g. client listening to socket.on('message.created', ...))
      // Passing an array to .to() performs a union and dedupes sockets in Socket.io
      this.gateway.server.to(rooms).emit(event, payload);

      // Also emit on generic 'event' channel for unified event stream listeners
      this.gateway.server.to(rooms).emit('event', payload);

      this.logger.debug(`Broadcasted '${event}' to room(s) '${rooms.join(', ')}'`);
    } catch (err) {
      this.logger.error(
        `Failed to broadcast '${event}' to room(s) '${Array.isArray(room) ? room.join(', ') : room}': ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }
}
