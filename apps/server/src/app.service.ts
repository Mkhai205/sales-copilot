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

  getLiveness() {
    return {
      status: 'ok' as const,
      service: 'sales-copilot-api',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness() {
    const [dbResult, migrationsResult, redisResult, storageResult] = await Promise.allSettled([
      this.prisma.ping(),
      this.prisma.checkMigrations(),
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

    const migrations =
      migrationsResult.status === 'fulfilled'
        ? migrationsResult.value
        : {
            applied: false,
            error: (migrationsResult.reason as Error)?.message || 'Migrations error',
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

    const isDatabaseReady = database.status === 'up' && migrations.applied;
    const isRedisReady = redis.status === 'up';
    const isStorageReady = storage.status === 'up';

    const isReady = isDatabaseReady && isRedisReady && isStorageReady;

    let overallStatus: 'ok' | 'degraded' | 'down' = 'ok';
    if (!isDatabaseReady) {
      overallStatus = 'down';
    } else if (!isRedisReady || !isStorageReady) {
      overallStatus = 'degraded';
    }

    return {
      status: isReady ? ('ok' as const) : overallStatus,
      service: 'sales-copilot-api',
      version: '0.1.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          ...database,
          migrationsApplied: migrations.applied,
          ...(migrations.count !== undefined ? { migrationCount: migrations.count } : {}),
          ...(migrations.error ? { migrationError: migrations.error } : {}),
        },
        redis,
        storage,
      },
    };
  }
}
