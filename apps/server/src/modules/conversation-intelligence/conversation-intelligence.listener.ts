import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  ANALYZE_INBOUND_MESSAGE_JOB,
  AnalyzeInboundMessageJobDto,
  CONVERSATION_INTELLIGENCE_QUEUE,
  DomainEvent,
  MessageContentType,
  MessageCreatedEvent,
  SenderType,
} from '@sales-copilot/shared-contracts';

@Injectable()
export class ConversationIntelligenceListener {
  private readonly logger = new Logger(ConversationIntelligenceListener.name);

  constructor(
    @InjectQueue(CONVERSATION_INTELLIGENCE_QUEUE)
    private readonly intelligenceQueue: Queue,
  ) {}

  /**
   * Intercepts message.created events asynchronously.
   * High-speed guardrails filter (< 5ms):
   * - Only incoming contact messages (senderType === CONTACT)
   * - Only non-private messages (!isPrivate)
   * - Only non-empty text messages
   */
  @OnEvent(DomainEvent.MESSAGE_CREATED, { async: true })
  async handleMessageCreated(payload: MessageCreatedEvent): Promise<void> {
    try {
      if (!payload?.workspaceId) return;

      const message = payload.message || (payload as any);
      if (!message || !message.id || !message.conversationId) return;

      // 1. Guardrail: only customer messages (CONTACT)
      if (message.senderType !== SenderType.CONTACT) {
        return;
      }

      // 2. Guardrail: ignore internal private notes
      if (message.isPrivate) {
        return;
      }

      // 3. Guardrail: only text messages with non-empty content
      if (!message.content || message.content.trim() === '') {
        return;
      }
      if (message.contentType && message.contentType !== MessageContentType.TEXT) {
        return;
      }

      const jobData: AnalyzeInboundMessageJobDto = {
        workspaceId: payload.workspaceId,
        conversationId: message.conversationId,
        messageId: message.id,
        contactId: message.senderId || null,
        messageContent: message.content,
      };

      const jobId = `job:analyze:${message.id}`;

      await this.intelligenceQueue.add(ANALYZE_INBOUND_MESSAGE_JOB, jobData, {
        jobId,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      });

      this.logger.debug(
        `Enqueued conversation intelligence job '${jobId}' for message '${message.id}'`,
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to enqueue conversation intelligence job: ${err.message}`,
        err.stack,
      );
    }
  }
}
