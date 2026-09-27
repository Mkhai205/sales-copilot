import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  AI_AUTOPILOT_QUEUE,
  MessageType,
  SenderType,
  type AiAgentJobData,
  type InboxAiCommercePolicyConfig,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { RedisService } from '../../../infrastructure/redis/redis.service';
import { MessagesService } from '../../omnichannel/messages/messages.service';
import { AI_AGENT_CONSTANTS, getAiDebounceKey } from './ai-agent.constants';
import { AiGuardrailService } from './services/ai-guardrail.service';

export interface InboundMessageCreatedEvent {
  workspaceId: string;
  conversationId: string;
  message: {
    id: string;
    senderType: SenderType;
    messageType: MessageType;
    content?: string | null;
    isPrivate: boolean;
  };
  isPrivate?: boolean;
}

@Injectable()
export class AiDispatcherListener {
  private readonly logger = new Logger(AiDispatcherListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly guardrailService: AiGuardrailService,
    private readonly messagesService: MessagesService,
    @InjectQueue(AI_AUTOPILOT_QUEUE)
    private readonly aiQueue: Queue<AiAgentJobData>,
  ) {}

  @OnEvent('message.created')
  async handleInboundMessage(payload: InboundMessageCreatedEvent): Promise<void> {
    const { workspaceId, conversationId, message } = payload;

    // 1. Only process messages from CONTACT
    if (message.senderType !== SenderType.CONTACT) {
      return;
    }

    // 2. Skip non-incoming messages or private notes
    if (message.messageType !== MessageType.INCOMING || payload.isPrivate || message.isPrivate) {
      return;
    }

    const client = this.prisma.getClient();

    // 2.1. Update lastContactMessageAt for proactive follow-up tracking (Strict Multi-Tenancy)
    await client.conversation.updateMany({
      where: { id: conversationId, workspaceId },
      data: { lastContactMessageAt: new Date() },
    });

    // 2.5. Pre-dispatch guardrails (Content filter, Abuse detection, Rate limiting)
    const guardrailResult = await this.guardrailService.check({
      workspaceId,
      conversationId,
      messageContent: message.content,
    });

    if (!guardrailResult.allowed) {
      this.logger.warn(
        `Guardrail blocked message '${message.id}' in conv '${conversationId}': ${guardrailResult.reason}`,
      );

      if (guardrailResult.shouldReply && guardrailResult.replyText) {
        await this.messagesService.create(workspaceId, conversationId, {
          content: guardrailResult.replyText,
          senderType: SenderType.SYSTEM,
          messageType: MessageType.OUTGOING,
          isPrivate: false,
          metadata: {
            isAiGenerated: true,
            guardrailReason: guardrailResult.reason,
          },
        });
      }

      return;
    }

    // 3. Load conversation + inbox (Strict Multi-Tenancy)
    const conversation = await client.conversation.findFirst({
      where: { id: conversationId, workspaceId },
      include: {
        inbox: true,
      },
    });

    if (!conversation) {
      return;
    }

    // 4. Skip if Human Takeover is active
    if (conversation.isAiPaused) {
      this.logger.debug(
        `Conversation '${conversationId}' has isAiPaused=true. Skipping AI dispatch.`,
      );
      return;
    }

    // 5. Check if inbox has AI enabled in aiCommercePolicy
    const inboxSettings = conversation.inbox?.settings as Record<string, unknown> | undefined;
    const aiPolicy = inboxSettings?.aiCommercePolicy as InboxAiCommercePolicyConfig | undefined;

    if (!aiPolicy || !aiPolicy.enabled) {
      return;
    }

    // 6. Set Redis debounce timestamp
    const now = Date.now();
    const debounceKey = getAiDebounceKey(workspaceId, conversationId);
    await this.redisService.set(
      debounceKey,
      now.toString(),
      AI_AGENT_CONSTANTS.DEBOUNCE_KEY_TTL_SECONDS,
    );

    // 7. Enqueue BullMQ job with 500ms debounce delay
    await this.aiQueue.add(
      'process-message',
      {
        workspaceId,
        conversationId,
        messageId: message.id,
        inboxId: conversation.inboxId,
        scheduledAt: now,
      },
      {
        delay: AI_AGENT_CONSTANTS.DEFAULT_DEBOUNCE_DELAY_MS,
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: true,
      },
    );

    this.logger.debug(
      `Dispatched message '${message.id}' in conversation '${conversationId}' to ${AI_AUTOPILOT_QUEUE} queue with delay ${AI_AGENT_CONSTANTS.DEFAULT_DEBOUNCE_DELAY_MS}ms`,
    );
  }
}
