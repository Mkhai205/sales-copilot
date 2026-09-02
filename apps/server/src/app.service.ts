import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from './infrastructure/database';
import { RedisService } from './infrastructure/redis';
import { StorageService } from './infrastructure/storage';
import { CHANNEL_INGESTION_QUEUE, WEBHOOK_DELIVERY_QUEUE } from './infrastructure/queue';

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
    @InjectQueue(CHANNEL_INGESTION_QUEUE)
    private readonly channelIngestionQueue: Queue,
    @InjectQueue(WEBHOOK_DELIVERY_QUEUE)
    private readonly webhookDeliveryQueue: Queue,
  ) {}

  private async checkQueueHealth(queue: Queue): Promise<{
    status: 'ok' | 'down';
    latencyMs: number;
    jobCounts?: Record<string, number>;
    error?: string;
  }> {
    const start = Date.now();
    try {
      if (!queue) {
        throw new Error('Queue is not initialized');
      }
      await queue.waitUntilReady();
      const jobCounts = await queue.getJobCounts(
        'active',
        'waiting',
        'failed',
        'completed',
        'delayed',
      );
      const latencyMs = Date.now() - start;
      return { status: 'ok', latencyMs, jobCounts };
    } catch (err) {
      const latencyMs = Date.now() - start;
      return {
        status: 'down',
        latencyMs,
        error: (err as Error)?.message || 'Queue unavailable',
      };
    }
  }

  async getHealth() {
    const [dbResult, redisResult, storageResult, channelQueueResult, webhookQueueResult] =
      await Promise.allSettled([
        this.prisma.ping(),
        this.redis.ping(),
        this.storage.ping(),
        this.checkQueueHealth(this.channelIngestionQueue),
        this.checkQueueHealth(this.webhookDeliveryQueue),
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

    const channelIngestion =
      channelQueueResult.status === 'fulfilled'
        ? channelQueueResult.value
        : {
            status: 'down' as const,
            latencyMs: 0,
            error: (channelQueueResult.reason as Error)?.message || 'Channel ingestion queue error',
          };

    const webhookDelivery =
      webhookQueueResult.status === 'fulfilled'
        ? webhookQueueResult.value
        : {
            status: 'down' as const,
            latencyMs: 0,
            error: (webhookQueueResult.reason as Error)?.message || 'Webhook delivery queue error',
          };

    const areQueuesHealthy = channelIngestion.status === 'ok' && webhookDelivery.status === 'ok';

    const isHealthy =
      database.status === 'up' &&
      redis.status === 'up' &&
      storage.status === 'up' &&
      areQueuesHealthy;

    let overallStatus: 'ok' | 'degraded' | 'down' = 'ok';
    if (database.status === 'down') {
      overallStatus = 'down';
    } else if (!isHealthy) {
      overallStatus = 'degraded';
    }

    return {
      status: isHealthy ? 'ok' : overallStatus,
      service: 'sales-copilot-api',
      version: '0.1.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      dependencies: {
        database,
        redis,
        storage,
        queues: {
          channelIngestion,
          webhookDelivery,
        },
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
    const [
      dbResult,
      migrationsResult,
      redisResult,
      storageResult,
      channelQueueResult,
      webhookQueueResult,
    ] = await Promise.allSettled([
      this.prisma.ping(),
      this.prisma.checkMigrations(),
      this.redis.ping(),
      this.storage.ping(),
      this.checkQueueHealth(this.channelIngestionQueue),
      this.checkQueueHealth(this.webhookDeliveryQueue),
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

    const channelIngestion =
      channelQueueResult.status === 'fulfilled'
        ? channelQueueResult.value
        : {
            status: 'down' as const,
            latencyMs: 0,
            error: (channelQueueResult.reason as Error)?.message || 'Channel ingestion queue error',
          };

    const webhookDelivery =
      webhookQueueResult.status === 'fulfilled'
        ? webhookQueueResult.value
        : {
            status: 'down' as const,
            latencyMs: 0,
            error: (webhookQueueResult.reason as Error)?.message || 'Webhook delivery queue error',
          };

    const isDatabaseReady = database.status === 'up' && migrations.applied;
    const isRedisReady = redis.status === 'up';
    const isStorageReady = storage.status === 'up';
    const areQueuesReady = channelIngestion.status === 'ok' && webhookDelivery.status === 'ok';

    const isReady = isDatabaseReady && isRedisReady && isStorageReady && areQueuesReady;

    let overallStatus: 'ok' | 'degraded' | 'down' = 'ok';
    if (!isDatabaseReady) {
      overallStatus = 'down';
    } else if (!isRedisReady || !isStorageReady || !areQueuesReady) {
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
        queues: {
          channelIngestion,
          webhookDelivery,
        },
      },
    };
  }
}
