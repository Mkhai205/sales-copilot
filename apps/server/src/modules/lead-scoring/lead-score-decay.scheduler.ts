import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LeadStatus, ScoreTriggerEvent } from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { LeadScoringService } from './lead-scoring.service';

@Injectable()
export class LeadScoreDecayScheduler {
  private readonly logger = new Logger(LeadScoreDecayScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly leadScoringService: LeadScoringService,
  ) {}

  /**
   * Hourly cron job to apply inactivity score decay for leads dormant for > 48 hours.
   * Guarded by a distributed Redis lock to ensure only one cluster replica executes.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleHourlyDecay(): Promise<void> {
    const lockKey = 'ws:system:lead_scoring:decay_cron_lock';
    // 5 minutes lock TTL
    const lockToken = await this.redisService.acquireLock(lockKey, 300000);

    if (!lockToken) {
      this.logger.debug('Lead score decay cron job skipped: already running on another instance.');
      return;
    }

    try {
      this.logger.log('Starting hourly lead score inactivity decay cycle...');
      const cutoffTime = new Date(Date.now() - 48 * 3600 * 1000);
      const client = this.prisma.getClient();

      // Query active leads with score > 0 that have been inactive for > 48 hours
      const batchSize = 50;
      let cursor: string | undefined = undefined;
      let processedCount = 0;

      while (true) {
        const leads: any[] = await client.lead.findMany({
          where: {
            score: { gt: 0 },
            status: {
              notIn: [LeadStatus.CONVERTED, LeadStatus.DISQUALIFIED],
            },
            OR: [
              { lastActivityAt: { lt: cutoffTime } },
              {
                lastActivityAt: null,
                createdAt: { lt: cutoffTime },
              },
            ],
          },
          take: batchSize,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          orderBy: { id: 'asc' },
        });

        if (!leads || leads.length === 0) {
          break;
        }

        for (const lead of leads) {
          try {
            await this.leadScoringService.recalculateScore(
              lead.workspaceId,
              lead.id,
              ScoreTriggerEvent.TIME_DECAY,
              'Inactivity time decay recalculation',
            );
            processedCount++;
          } catch (leadError: any) {
            this.logger.error(
              `Failed decay recalculation for lead '${lead.id}': ${leadError.message}`,
              leadError.stack,
            );
          }
        }

        cursor = leads[leads.length - 1].id;
        if (leads.length < batchSize) {
          break;
        }
      }

      this.logger.log(
        `Completed lead score decay cycle. Processed ${processedCount} inactive lead(s).`,
      );
    } catch (err: any) {
      this.logger.error(`Error in lead score decay cron cycle: ${err.message}`, err.stack);
    } finally {
      await this.redisService.releaseLock(lockKey, lockToken);
    }
  }
}
