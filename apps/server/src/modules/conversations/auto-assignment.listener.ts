import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ConversationCreatedEvent,
  ConversationReopenedEvent,
  DomainEvent,
} from '@sales-copilot/shared-contracts';
import { AutoAssignmentService } from './auto-assignment.service';

/**
 * Event listener that triggers automated conversation assignment when eligible
 * conversation lifecycle events occur (Feature F-1.8.1).
 */
@Injectable()
export class AutoAssignmentListener {
  private readonly logger = new Logger(AutoAssignmentListener.name);

  constructor(private readonly autoAssignmentService: AutoAssignmentService) {}

  /**
   * Handles newly created conversations.
   * If conversation has no assigneeId, initiates auto-assignment.
   */
  @OnEvent(DomainEvent.CONVERSATION_CREATED)
  @OnEvent('conversation.created')
  async handleConversationCreated(payload: ConversationCreatedEvent): Promise<void> {
    if (!payload?.workspaceId || !payload?.conversation?.id) {
      return;
    }

    const { workspaceId, conversation } = payload;

    // Skip if conversation already has an assignee
    if (conversation.assigneeId) {
      return;
    }

    try {
      this.logger.debug(
        `Triggering auto-assignment for newly created conversation '${conversation.id}' in workspace '${workspaceId}'`,
      );
      await this.autoAssignmentService.assignConversation(workspaceId, conversation.id);
    } catch (err) {
      this.logger.error(
        `Failed auto-assignment for created conversation '${conversation.id}': ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  /**
   * Handles reopened conversations (RESOLVED / SNOOZED -> OPEN).
   * If conversation is unassigned, attempts auto-assignment.
   */
  @OnEvent(DomainEvent.CONVERSATION_REOPENED)
  @OnEvent('conversation.reopened')
  async handleConversationReopened(payload: ConversationReopenedEvent): Promise<void> {
    if (!payload?.workspaceId) {
      return;
    }

    const conversationId = payload.conversationId || payload.conversation?.id;
    if (!conversationId) {
      return;
    }

    // If conversation object is present and already assigned, skip
    if (payload.conversation?.assigneeId) {
      return;
    }

    try {
      this.logger.debug(
        `Triggering auto-assignment for reopened conversation '${conversationId}' in workspace '${payload.workspaceId}'`,
      );
      await this.autoAssignmentService.assignConversation(payload.workspaceId, conversationId);
    } catch (err) {
      this.logger.error(
        `Failed auto-assignment for reopened conversation '${conversationId}': ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }
}
