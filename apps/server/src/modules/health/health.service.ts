import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  AI_AUTOPILOT_QUEUE,
  CHANNEL_INGESTION_QUEUE,
  COMMENT_GUARD_QUEUE,
  COMMERCE_RECONCILIATION_QUEUE,
  KNOWLEDGE_EMBEDDING_QUEUE,
  MESSAGE_OUTBOUND_QUEUE,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import {
  DependencyCheckResult,
  HealthCheckResponse,
  HealthStatus,
  LivenessResponse,
  MonitoredQueueChecks,
  QueueCheckResult,
  ReadinessResponse,
} from './health.types';

const MONITORED_QUEUES = [
  { key: 'channelIngestion', name: CHANNEL_INGESTION_QUEUE },
  { key: 'commentGuard', name: COMMENT_GUARD_QUEUE },
  { key: 'messageOutbound', name: MESSAGE_OUTBOUND_QUEUE },
  { key: 'commerceReconciliation', name: COMMERCE_RECONCILIATION_QUEUE },
  { key: 'aiAutopilot', name: AI_AUTOPILOT_QUEUE },
  { key: 'knowledgeEmbedding', name: KNOWLEDGE_EMBEDDING_QUEUE },
] as const;

type QueueKey = (typeof MONITORED_QUEUES)[number]['key'];

@Injectable()
export class HealthService {
  private readonly queues = new Map<QueueKey, Queue>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
    @InjectQueue(CHANNEL_INGESTION_QUEUE) channelIngestionQueue: Queue,
    @InjectQueue(COMMENT_GUARD_QUEUE) commentGuardQueue: Queue,
    @InjectQueue(MESSAGE_OUTBOUND_QUEUE) messageOutboundQueue: Queue,
    @InjectQueue(COMMERCE_RECONCILIATION_QUEUE) commerceReconciliationQueue: Queue,
    @InjectQueue(AI_AUTOPILOT_QUEUE) aiAutopilotQueue: Queue,
    @InjectQueue(KNOWLEDGE_EMBEDDING_QUEUE) knowledgeEmbeddingQueue: Queue,
  ) {
    this.queues = new Map<QueueKey, Queue>([
      ['channelIngestion', channelIngestionQueue],
      ['commentGuard', commentGuardQueue],
      ['messageOutbound', messageOutboundQueue],
      ['commerceReconciliation', commerceReconciliationQueue],
      ['aiAutopilot', aiAutopilotQueue],
      ['knowledgeEmbedding', knowledgeEmbeddingQueue],
    ]);
  }

  private async checkQueueHealth(queue: Queue): Promise<QueueCheckResult> {
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

  private async checkAllQueues(): Promise<MonitoredQueueChecks> {
    const checks = await Promise.all(
      MONITORED_QUEUES.map(
        async ({ key }) => [key, await this.checkQueueHealth(this.queues.get(key)!)] as const,
      ),
    );
    return Object.fromEntries(checks) as MonitoredQueueChecks;
  }

  private async ping(
    promise: Promise<DependencyCheckResult>,
    fallbackError: string,
  ): Promise<DependencyCheckResult> {
    try {
      return await promise;
    } catch (err) {
      return { status: 'down', latencyMs: 0, error: (err as Error)?.message || fallbackError };
    }
  }

  async getHealth(): Promise<HealthCheckResponse> {
    const [database, redis, storage, queues] = await Promise.all([
      this.ping(this.prisma.ping(), 'Database error'),
      this.ping(this.redis.ping(), 'Redis error'),
      this.ping(this.storage.ping(), 'Storage error'),
      this.checkAllQueues(),
    ]);

    const areQueuesHealthy = Object.values(queues).every(q => q.status === 'ok');
    const isHealthy =
      database.status === 'up' &&
      redis.status === 'up' &&
      storage.status === 'up' &&
      areQueuesHealthy;

    let overallStatus: HealthStatus = 'ok';
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
        queues,
      },
    };
  }

  getLiveness(): LivenessResponse {
    return {
      status: 'ok',
      service: 'sales-copilot-api',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness(): Promise<ReadinessResponse> {
    const [database, migrations, redis, storage, queues] = await Promise.all([
      this.ping(this.prisma.ping(), 'Database error'),
      this.prisma
        .checkMigrations()
        .catch((err): { applied: boolean; count?: number; error?: string } => ({
          applied: false,
          error: (err as Error)?.message || 'Migrations error',
        })),
      this.ping(this.redis.ping(), 'Redis error'),
      this.ping(this.storage.ping(), 'Storage error'),
      this.checkAllQueues(),
    ]);

    const isDatabaseReady = database.status === 'up' && migrations.applied;
    const isRedisReady = redis.status === 'up';
    const isStorageReady = storage.status === 'up';
    const areQueuesReady = Object.values(queues).every(q => q.status === 'ok');

    const isReady = isDatabaseReady && isRedisReady && isStorageReady && areQueuesReady;

    let overallStatus: HealthStatus = 'ok';
    if (!isDatabaseReady) {
      overallStatus = 'down';
    } else if (!isRedisReady || !isStorageReady || !areQueuesReady) {
      overallStatus = 'degraded';
    }

    return {
      status: isReady ? 'ok' : overallStatus,
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
        queues,
      },
    };
  }
}
