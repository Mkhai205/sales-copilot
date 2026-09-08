import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  DomainEvent,
  POS_AUTOMATION_JOB,
  POS_ORDER_AUTOMATION_QUEUE,
  SenderType,
} from '@sales-copilot/shared-contracts';
import { RedisService } from '../../../infrastructure/redis/redis.service';

export interface PosAutomationJobData {
  workspaceId: string;
  conversationId: string;
  messageId: string;
  contactId?: string;
  content: string;
  scheduledAt: number;
}

const DEBOUNCE_MS = 400;

@Injectable()
export class PosOrderAutomationListener {
  private readonly logger = new Logger(PosOrderAutomationListener.name);

  constructor(
    @InjectQueue(POS_ORDER_AUTOMATION_QUEUE)
    private readonly automationQueue: Queue,
    private readonly redisService: RedisService,
  ) {}

  @OnEvent(DomainEvent.MESSAGE_CREATED, { async: true })
  @OnEvent('message.created', { async: true })
  async handleMessageCreated(payload: any): Promise<void> {
    try {
      const workspaceId = payload?.workspaceId;
      const conversationId = payload?.conversationId;
      const message = payload?.message || payload;

      if (!workspaceId || !conversationId || !message) return;

      // Filter: ONLY customer inbound messages, non-private
      if (message.senderType !== SenderType.CONTACT || message.isPrivate) {
        return;
      }

      const content = message.content?.trim();
      if (!content) return;

      // Debounce logic via Redis timestamp
      const now = Date.now();
      const debounceKey = `ws:${workspaceId}:pos:extract:debounce:${conversationId}`;
      await this.redisService.set(debounceKey, String(now), 10);

      const jobData: PosAutomationJobData = {
        workspaceId,
        conversationId,
        messageId: message.id,
        contactId: message.contactId || payload.contactId,
        content,
        scheduledAt: now,
      };

      const jobId = `pos-extract:${workspaceId}:${conversationId}:${now}`;

      await this.automationQueue.add(POS_AUTOMATION_JOB, jobData, {
        delay: DEBOUNCE_MS,
        jobId,
        attempts: 2,
        removeOnComplete: true,
      });

      this.logger.debug(
        `Scheduled POS automation job for message ${message.id} in conv ${conversationId}`,
      );
    } catch (err: any) {
      this.logger.error(`Failed to handle message for POS automation: ${err.message}`, err.stack);
    }
  }
}
