import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../infrastructure/redis';

export interface WorkspaceQuotaPolicy {
  rpm: number;
  tpm: number;
}

export const DEFAULT_QUOTA_POLICIES: Record<string, WorkspaceQuotaPolicy> = {
  FREE: { rpm: 30, tpm: 50_000 },
  STANDARD: { rpm: 120, tpm: 200_000 },
  ENTERPRISE: { rpm: 500, tpm: 1_000_000 },
};

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * Estimates token consumption based on characters in messages.
   * Approx 1 token per 3.5 characters for Vietnamese/English mixed text.
   */
  estimateTokens(textOrLength: string | number): number {
    const charCount = typeof textOrLength === 'string' ? textOrLength.length : textOrLength;
    return Math.max(1, Math.ceil(charCount / 3.5));
  }

  /**
   * Pre-flight check and atomic reservation for RPM and estimated TPM.
   * Throws 429 HttpException if limit is breached.
   */
  async checkAndReserve(
    workspaceId: string,
    estimatedTokens = 500,
    tier = 'STANDARD',
  ): Promise<{ remainingRpm: number; remainingTpm: number }> {
    const policy = DEFAULT_QUOTA_POLICIES[tier.toUpperCase()] || DEFAULT_QUOTA_POLICIES.STANDARD;
    const client = this.redisService.getClient();

    if (!client) {
      this.logger.warn(
        `Redis unavailable. Bypassing rate limiter check for workspace: ${workspaceId}`,
      );
      return { remainingRpm: policy.rpm, remainingTpm: policy.tpm };
    }

    const currentMinute = Math.floor(Date.now() / 60_000);
    const rpmKey = `ws:${workspaceId}:llm:rpm:${currentMinute}`;
    const tpmKey = `ws:${workspaceId}:llm:tpm:${currentMinute}`;

    try {
      // Pipeline atomic increment
      const pipeline = client.pipeline();
      pipeline.incr(rpmKey);
      pipeline.expire(rpmKey, 120);
      pipeline.incrby(tpmKey, estimatedTokens);
      pipeline.expire(tpmKey, 120);

      const results = await pipeline.exec();
      if (!results) {
        return { remainingRpm: policy.rpm, remainingTpm: policy.tpm };
      }

      const currentRpm = (results[0][1] as number) || 1;
      const currentTpm = (results[2][1] as number) || estimatedTokens;

      const secondsRemainingInMinute = 60 - (Math.floor(Date.now() / 1000) % 60);

      if (currentRpm > policy.rpm) {
        this.logger.warn(
          `Workspace ${workspaceId} exceeded RPM quota: ${currentRpm}/${policy.rpm}`,
        );
        throw new HttpException(
          {
            code: 'WORKSPACE_LLM_QUOTA_EXCEEDED',
            message: `Workspace request rate limit of ${policy.rpm} RPM exceeded. Please try again in ${secondsRemainingInMinute}s.`,
            details: {
              currentRpm,
              limitRpm: policy.rpm,
              retryAfterSeconds: secondsRemainingInMinute,
            },
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      if (currentTpm > policy.tpm) {
        this.logger.warn(
          `Workspace ${workspaceId} exceeded TPM quota: ${currentTpm}/${policy.tpm}`,
        );
        throw new HttpException(
          {
            code: 'WORKSPACE_LLM_QUOTA_EXCEEDED',
            message: `Workspace token usage limit of ${policy.tpm} TPM exceeded. Please try again in ${secondsRemainingInMinute}s.`,
            details: {
              currentTpm,
              limitTpm: policy.tpm,
              retryAfterSeconds: secondsRemainingInMinute,
            },
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      return {
        remainingRpm: Math.max(0, policy.rpm - currentRpm),
        remainingTpm: Math.max(0, policy.tpm - currentTpm),
      };
    } catch (err: any) {
      if (err instanceof HttpException) {
        throw err;
      }
      this.logger.error(`Error checking rate limit in Redis: ${err?.message}`, err);
      return { remainingRpm: policy.rpm, remainingTpm: policy.tpm };
    }
  }

  /**
   * Reconciles actual tokens used against estimated pre-reserved tokens.
   */
  async recordActualUsage(
    workspaceId: string,
    actualTokens: number,
    estimatedTokensReserved = 500,
  ): Promise<void> {
    const client = this.redisService.getClient();
    if (!client) return;

    const diff = actualTokens - estimatedTokensReserved;
    if (diff === 0) return;

    const currentMinute = Math.floor(Date.now() / 60_000);
    const tpmKey = `ws:${workspaceId}:llm:tpm:${currentMinute}`;

    try {
      if (diff > 0) {
        await client.incrby(tpmKey, diff);
      } else {
        await client.decrby(tpmKey, Math.abs(diff));
      }
    } catch (err: any) {
      this.logger.warn(
        `Failed to reconcile token usage for workspace ${workspaceId}: ${err?.message}`,
      );
    }
  }
}
