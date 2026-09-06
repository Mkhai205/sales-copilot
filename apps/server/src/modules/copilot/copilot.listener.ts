import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  COPILOT_SUGGESTIONS_QUEUE,
  GENERATE_COPILOT_SUGGESTIONS_JOB,
  GenerateCopilotSuggestionsJobDto,
  DomainEvent,
  SenderType,
} from '@sales-copilot/shared-contracts';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { CopilotService } from './copilot.service';

const COPILOT_DEBOUNCE_MS = 3000;

@Injectable()
export class CopilotListener {
  private readonly logger = new Logger(CopilotListener.name);

  constructor(
    @InjectQueue(COPILOT_SUGGESTIONS_QUEUE)
    private readonly copilotQueue: Queue,
    private readonly redisService: RedisService,
    private readonly copilotService: CopilotService,
  ) {}

  /**
   * Automatically invalidates previous suggestions when a new customer message arrives (BR-2.5.2)
   * and schedules a debounced suggestion generation job.
   */
  @OnEvent(DomainEvent.MESSAGE_CREATED, { async: true })
  @OnEvent('message.created', { async: true })
  async handleMessageCreated(payload: any): Promise<void> {
    try {
      const workspaceId = payload?.workspaceId;
      const conversationId = payload?.conversationId;
      const message = payload?.message || payload;

      if (!workspaceId || !conversationId) return;

      // Only inbound customer messages trigger auto-invalidation & suggestions
      if (message?.senderType !== SenderType.CONTACT || message?.isPrivate) {
        return;
      }

      // 1. Immediately expire older pending suggestions (BR-2.5.2)
      await this.copilotService.expireSuggestionsForConversation(
        workspaceId,
        conversationId,
        'NEW_CUSTOMER_MESSAGE',
      );

      // 2. Schedule debounced job
      await this.scheduleDebouncedJob(workspaceId, conversationId, message?.id);
    } catch (err: any) {
      this.logger.error(`Error in handleMessageCreated: ${err.message}`, err.stack);
    }
  }

  /**
   * When conversation intelligence detects buying signals or objections,
   * trigger copilot suggestions.
   */
  @OnEvent(DomainEvent.CONVERSATION_INTELLIGENCE_ANALYZED, { async: true })
  @OnEvent('conversation.intelligence_analyzed', { async: true })
  async handleIntelligenceAnalyzed(payload: any): Promise<void> {
    try {
      const { workspaceId, conversationId, messageId, leadId, signalsCount } = payload;
      if (!workspaceId || !conversationId) return;

      if (signalsCount > 0) {
        await this.scheduleDebouncedJob(workspaceId, conversationId, messageId, leadId);
      }
    } catch (err: any) {
      this.logger.error(`Error in handleIntelligenceAnalyzed: ${err.message}`, err.stack);
    }
  }

  private async scheduleDebouncedJob(
    workspaceId: string,
    conversationId: string,
    messageId?: string,
    leadId?: string,
  ): Promise<void> {
    const now = Date.now();
    const debounceKey = `ws:${workspaceId}:copilot:debounce:${conversationId}`;

    // Set latest debounce timestamp
    await this.redisService.set(debounceKey, String(now), 30);

    const jobData: GenerateCopilotSuggestionsJobDto & { scheduledAt: number } = {
      workspaceId,
      conversationId,
      messageId,
      leadId,
      scheduledAt: now,
    };

    const jobId = `copilot:${workspaceId}:${conversationId}:${now}`;

    await this.copilotQueue.add(GENERATE_COPILOT_SUGGESTIONS_JOB, jobData, {
      delay: COPILOT_DEBOUNCE_MS,
      jobId,
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });

    this.logger.debug(
      `Scheduled copilot suggestion job for conversation '${conversationId}' with ${COPILOT_DEBOUNCE_MS}ms debounce`,
    );
  }
}
