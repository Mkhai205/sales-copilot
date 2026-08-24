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
  // 3. Helper Method with Robust Error Isolation
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
