import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  LEAD_SCORING_QUEUE,
  RECALCULATE_LEAD_SCORE_JOB,
  RecalculateLeadScoreJobDto,
} from '@sales-copilot/shared-contracts';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { LeadScoringService } from './lead-scoring.service';

@Processor(LEAD_SCORING_QUEUE)
export class LeadScoringProcessor extends WorkerHost {
  private readonly logger = new Logger(LeadScoringProcessor.name);

  constructor(
    private readonly leadScoringService: LeadScoringService,
    private readonly redisService: RedisService,
  ) {
    super();
  }

  async process(job: Job<RecalculateLeadScoreJobDto>): Promise<any> {
    const { name, data } = job;
    if (name !== RECALCULATE_LEAD_SCORE_JOB) {
      this.logger.warn(`Unknown job name in ${LEAD_SCORING_QUEUE}: ${name}`);
      return { status: 'ignored' };
    }

    const { workspaceId, leadId, scheduledAt, trigger, reason } = data;

    // 1. Check debounce key in Redis
    const debounceKey = `ws:${workspaceId}:lead_scoring:debounce:${leadId}`;
    const latestTimestampStr = await this.redisService.get(debounceKey);

    if (latestTimestampStr) {
      const latestTimestamp = Number(latestTimestampStr);
      if (latestTimestamp > scheduledAt) {
        this.logger.debug(
          `Skipping redundant calculation for lead '${leadId}': newer event scheduled at ${latestTimestamp} > ${scheduledAt}`,
        );
        return { status: 'skipped', reason: 'superseded_by_newer_event' };
      }
    }

    // 2. Acquire distributed lock for this specific lead
    const lockKey = `ws:${workspaceId}:lead_scoring:lock:${leadId}`;
    const lockToken = await this.redisService.acquireLock(lockKey, 5000);

    if (!lockToken) {
      this.logger.warn(
        `Lead scoring recalculation for lead '${leadId}' is currently locked by another worker`,
      );
      return { status: 'locked' };
    }

    try {
      this.logger.log(
        `Processing lead score recalculation for lead '${leadId}' (trigger: ${trigger})`,
      );

      const result = await this.leadScoringService.recalculateScore(
        workspaceId,
        leadId,
        trigger,
        reason,
      );

      // Clean up debounce key after successful execution
      await this.redisService.del(debounceKey);

      return {
        status: 'success',
        leadId,
        score: result.score,
        grade: result.grade,
      };
    } catch (err: any) {
      this.logger.error(
        `Failed to recalculate lead score for lead '${leadId}': ${err.message}`,
        err.stack,
      );
      throw err;
    } finally {
      // Always release distributed lock
      await this.redisService.releaseLock(lockKey, lockToken);
    }
  }
}
