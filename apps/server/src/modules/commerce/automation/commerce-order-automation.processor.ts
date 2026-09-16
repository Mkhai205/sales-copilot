import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  COMMERCE_ORDER_AUTOMATION_QUEUE,
  COMMERCE_AUTOMATION_JOB,
  POS_AUTOMATION_JOB,
} from '@sales-copilot/shared-contracts';
import { RedisService } from '../../../infrastructure/redis/redis.service';
import { OrderExtractorService } from './order-extractor.service';
import { CommerceAutomationJobData } from './commerce-order-automation.listener';

@Processor(COMMERCE_ORDER_AUTOMATION_QUEUE, { concurrency: 5 })
@Injectable()
export class CommerceOrderAutomationProcessor extends WorkerHost {
  private readonly logger = new Logger(CommerceOrderAutomationProcessor.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly orderExtractorService: OrderExtractorService,
  ) {
    super();
  }

  async process(job: Job<CommerceAutomationJobData>): Promise<any> {
    if (job.name !== COMMERCE_AUTOMATION_JOB && job.name !== POS_AUTOMATION_JOB) {
      return;
    }

    const { workspaceId, conversationId, messageId, contactId, content, scheduledAt } = job.data;

    // 1. Debounce check: if a newer message scheduled after this one, skip
    const debounceKey = `ws:${workspaceId}:commerce:extract:debounce:${conversationId}`;
    let latestTimestamp = await this.redisService.get(debounceKey);
    if (!latestTimestamp) {
      latestTimestamp = await this.redisService.get(
        `ws:${workspaceId}:commerce:extract:debounce:${conversationId}`,
      );
    }

    if (latestTimestamp && Number(latestTimestamp) > scheduledAt) {
      this.logger.debug(
        `Skipping superseded commerce extraction job for conv ${conversationId} (${latestTimestamp} > ${scheduledAt})`,
      );
      return { skipped: true, reason: 'SUPERSEDED_BY_NEWER_MESSAGE' };
    }

    this.logger.log(
      `Processing AI order extraction for message ${messageId} in conv ${conversationId}`,
    );

    try {
      const extracted = await this.orderExtractorService.extractOrderFromMessage(
        workspaceId,
        conversationId,
        content,
        messageId,
        contactId,
      );

      return {
        success: true,
        confidenceScore: extracted.confidenceScore,
        itemsCount: extracted.suggestedItems?.length || 0,
      };
    } catch (err: any) {
      this.logger.error(
        `Failed to extract order from message ${messageId}: ${err.message}`,
        err.stack,
      );
      throw err;
    }
  }
}

export const PosOrderAutomationProcessor = CommerceOrderAutomationProcessor;
