import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  DomainEvent,
  LEAD_SCORING_QUEUE,
  RECALCULATE_LEAD_SCORE_JOB,
  RecalculateLeadScoreJobDto,
  ScoreTriggerEvent,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';

@Injectable()
export class LeadScoringListener {
  private readonly logger = new Logger(LeadScoringListener.name);

  constructor(
    @InjectQueue(LEAD_SCORING_QUEUE)
    private readonly scoringQueue: Queue,
    private readonly redisService: RedisService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  @OnEvent(DomainEvent.SALES_EVIDENCE_DETECTED, { async: true })
  @OnEvent('sales_evidence.detected', { async: true })
  async handleSalesEvidenceDetected(payload: any): Promise<void> {
    await this.scheduleDebouncedRecalculation(
      payload,
      ScoreTriggerEvent.EVIDENCE_DETECTED,
      'New sales evidence detected',
    );
  }

  @OnEvent(DomainEvent.SALES_EVIDENCE_INVALIDATED, { async: true })
  @OnEvent('sales_evidence.invalidated', { async: true })
  async handleSalesEvidenceInvalidated(payload: any): Promise<void> {
    await this.scheduleDebouncedRecalculation(
      payload,
      ScoreTriggerEvent.EVIDENCE_INVALIDATED,
      'Sales evidence invalidated',
    );
  }

  @OnEvent(DomainEvent.MESSAGE_CREATED, { async: true })
  @OnEvent('message.created', { async: true })
  async handleMessageCreated(payload: any): Promise<void> {
    const message = payload.message || payload;
    // Only customer messages or agent responses trigger lead score recalculation
    if (!message || message.isPrivate) {
      return;
    }

    await this.scheduleDebouncedRecalculation(
      payload,
      ScoreTriggerEvent.MESSAGE_RECEIVED,
      `New message from ${message.senderType || 'participant'}`,
    );
  }

  /**
   * Dispatches a debounced lead scoring recalculation job to BullMQ.
   */
  private async scheduleDebouncedRecalculation(
    payload: any,
    trigger: ScoreTriggerEvent,
    reason: string,
  ): Promise<void> {
    try {
      const workspaceId = payload?.workspaceId;
      if (!workspaceId) return;

      let leadId = payload.leadId;

      // If leadId is not directly in payload, attempt resolution via conversationId
      if (!leadId && payload.conversationId) {
        const client = this.prisma.getClient();
        const conversation = await client.conversation.findFirst({
          where: { id: payload.conversationId, workspaceId },
        });

        if (conversation?.contactId) {
          const lead = await client.lead.findFirst({
            where: { contactId: conversation.contactId, workspaceId },
          });
          if (lead) {
            leadId = lead.id;
          }
        }
      }

      if (!leadId) {
        return;
      }

      const debounceMs = Number(this.configService.get<number>('LEAD_SCORE_DEBOUNCE_MS', 30000));

      const now = Date.now();
      const debounceKey = `ws:${workspaceId}:lead_scoring:debounce:${leadId}`;

      // Set latest timestamp with TTL (debounceMs + 30s buffer)
      const ttlSeconds = Math.max(60, Math.ceil((debounceMs + 30000) / 1000));
      await this.redisService.set(debounceKey, String(now), ttlSeconds);

      const jobData: RecalculateLeadScoreJobDto = {
        workspaceId,
        leadId,
        scheduledAt: now,
        trigger,
        reason,
      };

      const jobId = `lead_score:${workspaceId}:${leadId}:${now}`;

      await this.scoringQueue.add(RECALCULATE_LEAD_SCORE_JOB, jobData, {
        delay: debounceMs,
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
        `Scheduled debounced recalculation (${debounceMs}ms) for lead '${leadId}' on trigger '${trigger}'`,
      );
    } catch (err: any) {
      this.logger.error(`Failed to schedule lead scoring recalculation: ${err.message}`, err.stack);
    }
  }
}
