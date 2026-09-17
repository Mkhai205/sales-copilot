import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ConversationStatus,
  SenderType,
  type ConversationResponseDto,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../../infrastructure/database';
import { RedisService } from '../../../infrastructure/redis';
import { getAiDebounceKey } from './ai-agent.constants';

export interface UserMessageCreatedEvent {
  workspaceId: string;
  conversationId: string;
  message: {
    id: string;
    senderType: SenderType;
    isPrivate: boolean;
  };
  isPrivate?: boolean;
}

export interface ConversationStatusUpdatedEvent {
  workspaceId: string;
  conversationId: string;
  currentStatus: ConversationStatus;
  conversation: ConversationResponseDto;
}

@Injectable()
export class AiTakeoverListener {
  private readonly logger = new Logger(AiTakeoverListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Triggers Human Takeover when a human agent sends a public message.
   * Private notes (isPrivate: true) do NOT trigger takeover.
   */
  @OnEvent('message.created')
  async handleAgentMessage(payload: UserMessageCreatedEvent): Promise<void> {
    const { workspaceId, conversationId, message } = payload;

    // Only human agents (USER) can trigger takeover via messaging
    if (message.senderType !== SenderType.USER) {
      return;
    }

    // Private notes do not pause AI
    if (payload.isPrivate || message.isPrivate) {
      return;
    }

    const client = this.prisma.getClient();

    // Set isAiPaused = true (Strict Multi-Tenancy)
    const result = await client.conversation.updateMany({
      where: {
        id: conversationId,
        workspaceId,
        isAiPaused: false,
      },
      data: {
        isAiPaused: true,
      },
    });

    if (result.count > 0) {
      this.logger.log(
        `Human agent sent public message in conversation '${conversationId}'. AI paused (Human Takeover activated).`,
      );
    }

    // Clear any pending debounce key
    const debounceKey = getAiDebounceKey(workspaceId, conversationId);
    await this.redisService.del(debounceKey);
  }

  /**
   * Resets AI state when conversation is RESOLVED so AI can handle future inquiries.
   */
  @OnEvent('conversation.status_updated')
  async handleConversationStatusUpdated(payload: ConversationStatusUpdatedEvent): Promise<void> {
    const { workspaceId, conversationId, currentStatus } = payload;

    if (currentStatus === ConversationStatus.RESOLVED) {
      const client = this.prisma.getClient();

      await client.conversation.updateMany({
        where: {
          id: conversationId,
          workspaceId,
          isAiPaused: true,
        },
        data: {
          isAiPaused: false,
        },
      });

      const debounceKey = getAiDebounceKey(workspaceId, conversationId);
      await this.redisService.del(debounceKey);

      this.logger.debug(`Conversation '${conversationId}' resolved. AI pause flag reset to false.`);
    }
  }
}
