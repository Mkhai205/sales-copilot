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
  @OnEvent('message.created')
  handleMessageCreated(payload: MessageCreatedEvent): void {
    if (!payload?.workspaceId) return;

    const { workspaceId, conversationId, message } = payload;
    const data = message || payload;

    // Broadcast to conversation room and workspace room
    if (conversationId) {
      this.broadcastSafe(`conversation_${conversationId}`, WsServerEvent.MESSAGE_CREATED, data);
    }
    this.broadcastSafe(`workspace_${workspaceId}`, WsServerEvent.MESSAGE_CREATED, data);
  }

  @OnEvent(DomainEvent.MESSAGE_UPDATED)
  @OnEvent('message.updated')
  handleMessageUpdated(payload: MessageUpdatedEvent): void {
    if (!payload?.workspaceId) return;

    const { workspaceId, conversationId, message } = payload;
    const data = message || payload;

    if (conversationId) {
      this.broadcastSafe(`conversation_${conversationId}`, WsServerEvent.MESSAGE_UPDATED, data);
    }
    this.broadcastSafe(`workspace_${workspaceId}`, WsServerEvent.MESSAGE_UPDATED, data);
  }

  @OnEvent(DomainEvent.MESSAGE_DELETED)
  @OnEvent('message.deleted')
  handleMessageDeleted(payload: MessageDeletedEvent): void {
    if (!payload?.workspaceId) return;

    const { workspaceId, conversationId, messageId } = payload;
    const data = { conversationId, messageId };

    if (conversationId) {
      this.broadcastSafe(`conversation_${conversationId}`, WsServerEvent.MESSAGE_DELETED, data);
    }
    this.broadcastSafe(`workspace_${workspaceId}`, WsServerEvent.MESSAGE_DELETED, data);
  }

  @OnEvent(DomainEvent.MESSAGE_DELIVERY_STATUS_UPDATED)
  @OnEvent('message.delivery_status_updated')
  handleMessageDeliveryStatusUpdated(payload: MessageDeliveryStatusUpdatedEvent): void {
    if (!payload?.workspaceId) return;

    const { workspaceId, conversationId, message } = payload;
    const data = message || payload;

    if (conversationId) {
      this.broadcastSafe(
        `conversation_${conversationId}`,
        WsServerEvent.MESSAGE_DELIVERY_STATUS_UPDATED,
        data,
      );
    }
    this.broadcastSafe(
      `workspace_${workspaceId}`,
      WsServerEvent.MESSAGE_DELIVERY_STATUS_UPDATED,
      data,
    );
  }

  // ==========================================================================
  // 2. Conversation Domain Event Handlers
  // ==========================================================================

  @OnEvent(DomainEvent.CONVERSATION_CREATED)
  @OnEvent('conversation.created')
  handleConversationCreated(payload: ConversationCreatedEvent): void {
    if (!payload?.workspaceId) return;

    const { workspaceId, conversation } = payload;
    const data = conversation || payload;

    // New conversation broadcast to entire workspace
    this.broadcastSafe(`workspace_${workspaceId}`, WsServerEvent.CONVERSATION_CREATED, data);
  }

  @OnEvent(DomainEvent.CONVERSATION_STATUS_UPDATED)
  @OnEvent('conversation.status_updated')
  handleConversationStatusUpdated(payload: ConversationStatusUpdatedEvent): void {
    if (!payload?.workspaceId) return;

    const { workspaceId, conversationId, conversation } = payload;
    const data = conversation || payload;

    if (conversationId) {
      this.broadcastSafe(
        `conversation_${conversationId}`,
        WsServerEvent.CONVERSATION_STATUS_UPDATED,
        data,
      );
    }
    this.broadcastSafe(`workspace_${workspaceId}`, WsServerEvent.CONVERSATION_STATUS_UPDATED, data);
  }

  @OnEvent(DomainEvent.CONVERSATION_REOPENED)
  @OnEvent('conversation.reopened')
  handleConversationReopened(payload: ConversationReopenedEvent): void {
    if (!payload?.workspaceId) return;

    const { workspaceId, conversationId, conversation } = payload;
    const data = conversation || payload;

    if (conversationId) {
      this.broadcastSafe(
        `conversation_${conversationId}`,
        WsServerEvent.CONVERSATION_REOPENED,
        data,
      );
    }
    this.broadcastSafe(`workspace_${workspaceId}`, WsServerEvent.CONVERSATION_REOPENED, data);
  }

  @OnEvent(DomainEvent.CONVERSATION_ASSIGNED)
  @OnEvent('conversation.assigned')
  handleConversationAssigned(payload: ConversationAssignedEvent): void {
    const { workspaceId, conversationId, previousAssigneeId, newAssigneeId, conversation } =
      payload;
    const data = conversation || payload;

    // 1. Broadcast to workspace room
    if (workspaceId) {
      this.broadcastSafe(`workspace_${workspaceId}`, WsServerEvent.CONVERSATION_ASSIGNED, data);
    }

    // 2. Broadcast to specific conversation room
    if (conversationId) {
      this.broadcastSafe(
        `conversation_${conversationId}`,
        WsServerEvent.CONVERSATION_ASSIGNED,
        data,
      );
    }

    // 3. Direct notification room for newly assigned agent
    if (newAssigneeId) {
      this.broadcastSafe(`user_${newAssigneeId}`, WsServerEvent.CONVERSATION_ASSIGNED, data);
    }

    // 4. Direct notification room for previous assignee if reassigned
    if (previousAssigneeId && previousAssigneeId !== newAssigneeId) {
      this.broadcastSafe(`user_${previousAssigneeId}`, WsServerEvent.CONVERSATION_ASSIGNED, data);
    }
  }

  @OnEvent(DomainEvent.CONVERSATION_PRIORITY_UPDATED)
  @OnEvent('conversation.priority_updated')
  handleConversationPriorityUpdated(payload: ConversationPriorityUpdatedEvent): void {
    if (!payload?.workspaceId) return;

    const { workspaceId, conversationId, conversation } = payload;
    const data = conversation || payload;

    if (conversationId) {
      this.broadcastSafe(
        `conversation_${conversationId}`,
        WsServerEvent.CONVERSATION_PRIORITY_UPDATED,
        data,
      );
    }
    this.broadcastSafe(
      `workspace_${workspaceId}`,
      WsServerEvent.CONVERSATION_PRIORITY_UPDATED,
      data,
    );
  }

  @OnEvent(DomainEvent.CONVERSATION_LABELS_UPDATED)
  @OnEvent('conversation.labels_updated')
  handleConversationLabelsUpdated(payload: ConversationLabelsUpdatedEvent): void {
    if (!payload?.workspaceId) return;

    const { workspaceId, conversationId, conversation } = payload;
    const data = conversation || payload;

    if (conversationId) {
      this.broadcastSafe(
        `conversation_${conversationId}`,
        WsServerEvent.CONVERSATION_LABELS_UPDATED,
        data,
      );
    }
    this.broadcastSafe(`workspace_${workspaceId}`, WsServerEvent.CONVERSATION_LABELS_UPDATED, data);
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
  @OnEvent('contact.merged')
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
  @OnEvent('channel_identity.created')
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
  @OnEvent('channel_identity.deleted')
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
  @OnEvent('label.created')
  handleLabelCreated(payload: LabelCreatedEvent): void {
    if (!payload?.workspaceId) return;
    const data = payload.label || payload;
    this.broadcastSafe(`workspace_${payload.workspaceId}`, WsServerEvent.LABEL_CREATED, data);
  }

  @OnEvent(DomainEvent.LABEL_UPDATED)
  @OnEvent('label.updated')
  handleLabelUpdated(payload: LabelUpdatedEvent): void {
    if (!payload?.workspaceId) return;
    const data = payload.label || payload;
    this.broadcastSafe(`workspace_${payload.workspaceId}`, WsServerEvent.LABEL_UPDATED, data);
  }

  @OnEvent(DomainEvent.LABEL_DELETED)
  @OnEvent('label.deleted')
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
  @OnEvent('channel.created')
  handleChannelCreated(payload: ChannelCreatedEvent): void {
    if (!payload?.workspaceId) return;
    this.broadcastSafe(`workspace_${payload.workspaceId}`, WsServerEvent.CHANNEL_CREATED, payload);
  }

  @OnEvent(DomainEvent.CHANNEL_UPDATED)
  @OnEvent('channel.updated')
  handleChannelUpdated(payload: ChannelUpdatedEvent): void {
    if (!payload?.workspaceId) return;
    this.broadcastSafe(`workspace_${payload.workspaceId}`, WsServerEvent.CHANNEL_UPDATED, payload);
  }

  @OnEvent(DomainEvent.CHANNEL_DELETED)
  @OnEvent('channel.deleted')
  handleChannelDeleted(payload: ChannelDeletedEvent): void {
    if (!payload?.workspaceId) return;
    this.broadcastSafe(`workspace_${payload.workspaceId}`, WsServerEvent.CHANNEL_DELETED, payload);
  }

  // ==========================================================================
  // 7. Typing Indicator Domain Event Handlers (Task 6)
  // ==========================================================================

  @OnEvent(DomainEvent.TYPING_START)
  @OnEvent('typing.start')
  handleTypingStart(payload: TypingEventPayload): void {
    if (!payload?.conversationId) return;
    const event = WsServerEvent.TYPING_START;
    this.broadcastSafe(`conversation_${payload.conversationId}`, event, payload);
    if (payload.workspaceId) {
      this.broadcastSafe(`workspace_${payload.workspaceId}`, event, payload);
    }
  }

  @OnEvent(DomainEvent.TYPING_STOP)
  @OnEvent('typing.stop')
  handleTypingStop(payload: TypingEventPayload): void {
    if (!payload?.conversationId) return;
    const event = WsServerEvent.TYPING_STOP;
    this.broadcastSafe(`conversation_${payload.conversationId}`, event, payload);
    if (payload.workspaceId) {
      this.broadcastSafe(`workspace_${payload.workspaceId}`, event, payload);
    }
  }

  // ==========================================================================
  // 8. Presence Domain Event Handlers (Task 9)
  // ==========================================================================

  @OnEvent(DomainEvent.PRESENCE_UPDATED)
  @OnEvent('presence.updated')
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
  // 9. Helper Method with Robust Error Isolation
  // ==========================================================================

  /**
   * Broadcasts a typed event envelope to a specific Socket.io room.
   * Catches all exceptions to ensure downstream domain workflows are not interrupted.
   */
  private broadcastSafe(room: string, event: WsServerEvent | string, data: unknown): void {
    try {
      if (!this.gateway?.server) {
        return;
      }

      const payload = {
        event,
        data,
      };

      // Emit on typed event channel (e.g. client listening to socket.on('message.created', ...))
      this.gateway.server.to(room).emit(event, payload);

      // Also emit on generic 'event' channel for unified event stream listeners
      this.gateway.server.to(room).emit('event', payload);

      this.logger.debug(`Broadcasted '${event}' to room '${room}'`);
    } catch (err) {
      this.logger.error(
        `Failed to broadcast '${event}' to room '${room}': ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }
}
