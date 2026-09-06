import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  COPILOT_SUGGESTIONS_QUEUE,
  GENERATE_COPILOT_SUGGESTIONS_JOB,
  GenerateCopilotSuggestionsJobDto,
} from '@sales-copilot/shared-contracts';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { CopilotContextService } from './copilot-context.service';
import { CopilotEngineService } from './copilot-engine.service';
import { CopilotService } from './copilot.service';

@Processor(COPILOT_SUGGESTIONS_QUEUE)
export class CopilotProcessor extends WorkerHost {
  private readonly logger = new Logger(CopilotProcessor.name);

  constructor(
    private readonly contextService: CopilotContextService,
    private readonly engineService: CopilotEngineService,
    private readonly copilotService: CopilotService,
    private readonly redisService: RedisService,
  ) {
    super();
  }

  async process(
    job: Job<GenerateCopilotSuggestionsJobDto & { scheduledAt?: number }>,
  ): Promise<any> {
    const { name, data } = job;
    if (name !== GENERATE_COPILOT_SUGGESTIONS_JOB) {
      this.logger.warn(`Unknown job name in ${COPILOT_SUGGESTIONS_QUEUE}: ${name}`);
      return { status: 'ignored' };
    }

    const { workspaceId, conversationId, messageId, scheduledAt } = data;

    // 1. Debounce check
    const debounceKey = `ws:${workspaceId}:copilot:debounce:${conversationId}`;
    const latestTimestampStr = await this.redisService.get(debounceKey);

    if (latestTimestampStr && scheduledAt) {
      const latestTimestamp = Number(latestTimestampStr);
      if (latestTimestamp > scheduledAt) {
        this.logger.debug(
          `Skipping superseded copilot job for conversation '${conversationId}': ${latestTimestamp} > ${scheduledAt}`,
        );
        return { status: 'skipped', reason: 'superseded_by_newer_message' };
      }
    }

    // 2. Distributed lock
    const lockKey = `ws:${workspaceId}:copilot:lock:${conversationId}`;
    const lockToken = await this.redisService.acquireLock(lockKey, 10000);

    if (!lockToken) {
      this.logger.warn(
        `Copilot generation for conversation '${conversationId}' is currently locked`,
      );
      return { status: 'locked' };
    }

    try {
      this.logger.log(`Generating copilot suggestions for conversation '${conversationId}'`);

      // 3. Synthesize context
      const context = await this.contextService.buildContext(
        workspaceId,
        conversationId,
        messageId,
      );

      // 4. Run LLM suggestion engine
      const suggestions = await this.engineService.generateStructuredSuggestions(context);

      // 5. Persist suggestions (auto-expiring previous pending ones)
      const created = await this.copilotService.createSuggestions(
        workspaceId,
        conversationId,
        suggestions,
        {
          messageId,
          leadId: context.leadId || undefined,
        },
      );

      // 6. Cleanup debounce key
      await this.redisService.del(debounceKey);

      return {
        status: 'success',
        conversationId,
        generatedCount: created.length,
      };
    } catch (err: any) {
      this.logger.error(
        `Failed to generate copilot suggestions for conversation '${conversationId}': ${err.message}`,
        err.stack,
      );
      throw err;
    } finally {
      await this.redisService.releaseLock(lockKey, lockToken);
    }
  }
}
