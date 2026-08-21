import { Injectable } from '@nestjs/common';
import { PrismaService } from './infrastructure/database';
import { RedisService } from './infrastructure/redis';
import { StorageService } from './infrastructure/storage';

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
  ) {}

  async getHealth() {
    const [dbResult, redisResult, storageResult] = await Promise.allSettled([
      this.prisma.ping(),
      this.redis.ping(),
      this.storage.ping(),
    ]);

    const database =
      dbResult.status === 'fulfilled'
        ? dbResult.value
        : {
            status: 'down' as const,
            latencyMs: 0,
            error: (dbResult.reason as Error)?.message || 'Database error',
          };

    const redis =
      redisResult.status === 'fulfilled'
        ? redisResult.value
        : {
            status: 'down' as const,
            latencyMs: 0,
            error: (redisResult.reason as Error)?.message || 'Redis error',
          };

    const storage =
      storageResult.status === 'fulfilled'
        ? storageResult.value
        : {
            status: 'down' as const,
            latencyMs: 0,
            error: (storageResult.reason as Error)?.message || 'Storage error',
          };

    const isHealthy = database.status === 'up' && redis.status === 'up' && storage.status === 'up';

    return {
      status: isHealthy ? 'ok' : 'degraded',
      service: 'sales-copilot-api',
      version: '0.1.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      dependencies: {
        database,
        redis,
        storage,
      },
    };
  }
}
