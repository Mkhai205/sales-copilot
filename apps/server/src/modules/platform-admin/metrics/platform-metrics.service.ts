import { Injectable, Logger, Optional } from '@nestjs/common';
import {
  PlatformMetricsOverviewDto,
  SystemServiceHealthStatus,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../../infrastructure/database';
import { RedisService } from '../../../infrastructure/redis';
import { StorageService } from '../../../infrastructure/storage/storage.service';

@Injectable()
export class PlatformMetricsService {
  private readonly logger = new Logger(PlatformMetricsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @Optional() private readonly storage?: StorageService,
  ) {}

  /**
   * Retrieves high-level aggregated operational metrics across all tenants and evaluates
   * health status for core infrastructure components (PostgreSQL, Redis, MinIO/S3).
   * Fault-isolated to guarantee HTTP 200 responses with safe fallbacks if dependencies are degraded.
   */
  async getMetricsOverview(): Promise<PlatformMetricsOverviewDto> {
    const [pgPingResult, redisPingResult, storagePingResult] = await Promise.allSettled([
      this.prisma.ping(),
      this.redis.ping(),
      this.storage ? this.storage.ping() : Promise.resolve(null),
    ]);

    let postgresStatus: SystemServiceHealthStatus = 'DOWN';
    if (pgPingResult.status === 'fulfilled' && pgPingResult.value.status === 'up') {
      postgresStatus = 'HEALTHY';
    }

    let redisStatus: SystemServiceHealthStatus = 'DOWN';
    if (redisPingResult.status === 'fulfilled' && redisPingResult.value.status === 'up') {
      redisStatus = 'HEALTHY';
    }

    let storageStatus: SystemServiceHealthStatus | undefined = undefined;
    if (this.storage) {
      if (storagePingResult.status === 'fulfilled' && storagePingResult.value?.status === 'up') {
        storageStatus = 'HEALTHY';
      } else {
        storageStatus = 'DOWN';
      }
    }

    let totalWorkspaces = 0;
    let activeWorkspaces = 0;
    let suspendedWorkspaces = 0;
    let totalUsers = 0;

    if (postgresStatus === 'HEALTHY') {
      try {
        const client = this.prisma.getClient();
        const [totalWs, activeWs, suspendedWs, totalUsr] = await Promise.all([
          client.workspace.count(),
          client.workspace.count({ where: { isSuspended: false } }),
          client.workspace.count({ where: { isSuspended: true } }),
          client.user.count(),
        ]);

        totalWorkspaces = totalWs;
        activeWorkspaces = activeWs;
        suspendedWorkspaces = suspendedWs;
        totalUsers = totalUsr;
      } catch (err) {
        this.logger.error('Failed to query platform metrics counts from database', err);
        postgresStatus = 'DOWN';
      }
    }

    return {
      totalWorkspaces,
      activeWorkspaces,
      suspendedWorkspaces,
      totalUsers,
      systemHealth: {
        postgres: postgresStatus,
        redis: redisStatus,
        ...(storageStatus ? { storage: storageStatus } : {}),
      },
    };
  }
}
