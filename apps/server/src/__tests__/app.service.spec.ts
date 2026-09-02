import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { Queue } from 'bullmq';
import { AppService } from '../app.service';
import { PrismaService } from '../infrastructure/database';
import { RedisService } from '../infrastructure/redis';
import { StorageService } from '../infrastructure/storage';

const createMockQueue = (isHealthy = true, errorMsg = 'Queue connection failed') =>
  ({
    waitUntilReady: async () => {
      if (!isHealthy) throw new Error(errorMsg);
    },
    getJobCounts: async () => {
      if (!isHealthy) throw new Error(errorMsg);
      return { active: 1, waiting: 2, failed: 0, completed: 5, delayed: 0 };
    },
  }) as unknown as Queue;

describe('AppService (Healthcheck Aggregator)', () => {
  it('should return status ok when all dependencies and queues are up', async () => {
    const mockPrisma = {
      ping: async () => ({ status: 'up' as const, latencyMs: 2 }),
    } as unknown as PrismaService;

    const mockRedis = {
      ping: async () => ({ status: 'up' as const, latencyMs: 1 }),
    } as unknown as RedisService;

    const mockStorage = {
      ping: async () => ({ status: 'up' as const, latencyMs: 5 }),
    } as unknown as StorageService;

    const mockChannelQueue = createMockQueue(true);
    const mockWebhookQueue = createMockQueue(true);

    const appService = new AppService(
      mockPrisma,
      mockRedis,
      mockStorage,
      mockChannelQueue,
      mockWebhookQueue,
    );
    const health = await appService.getHealth();

    assert.strictEqual(health.status, 'ok');
    assert.strictEqual(health.dependencies.database.status, 'up');
    assert.strictEqual(health.dependencies.redis.status, 'up');
    assert.strictEqual(health.dependencies.storage.status, 'up');
    assert.strictEqual(health.dependencies.queues.channelIngestion.status, 'ok');
    assert.strictEqual(health.dependencies.queues.webhookDelivery.status, 'ok');
  });

  it('should return status degraded when one dependency is down', async () => {
    const mockPrisma = {
      ping: async () => ({ status: 'up' as const, latencyMs: 2 }),
    } as unknown as PrismaService;

    const mockRedis = {
      ping: async () => ({ status: 'down' as const, latencyMs: 1, error: 'Connection timeout' }),
    } as unknown as RedisService;

    const mockStorage = {
      ping: async () => ({ status: 'up' as const, latencyMs: 5 }),
    } as unknown as StorageService;

    const mockChannelQueue = createMockQueue(true);
    const mockWebhookQueue = createMockQueue(true);

    const appService = new AppService(
      mockPrisma,
      mockRedis,
      mockStorage,
      mockChannelQueue,
      mockWebhookQueue,
    );
    const health = await appService.getHealth();

    assert.strictEqual(health.status, 'degraded');
    assert.strictEqual(health.dependencies.database.status, 'up');
    assert.strictEqual(health.dependencies.redis.status, 'down');
    assert.strictEqual(health.dependencies.redis.error, 'Connection timeout');
    assert.strictEqual(health.dependencies.storage.status, 'up');
  });

  it('should return status degraded when Storage is down in getHealth', async () => {
    const mockPrisma = {
      ping: async () => ({ status: 'up' as const, latencyMs: 2 }),
    } as unknown as PrismaService;

    const mockRedis = {
      ping: async () => ({ status: 'up' as const, latencyMs: 1 }),
    } as unknown as RedisService;

    const mockStorage = {
      ping: async () => ({ status: 'down' as const, latencyMs: 0, error: 'MinIO unavailable' }),
    } as unknown as StorageService;

    const mockChannelQueue = createMockQueue(true);
    const mockWebhookQueue = createMockQueue(true);

    const appService = new AppService(
      mockPrisma,
      mockRedis,
      mockStorage,
      mockChannelQueue,
      mockWebhookQueue,
    );
    const health = await appService.getHealth();

    assert.strictEqual(health.status, 'degraded');
    assert.strictEqual(health.dependencies.storage.status, 'down');
    assert.strictEqual(health.dependencies.storage.error, 'MinIO unavailable');
  });

  it('should return status down when database is down in getHealth', async () => {
    const mockPrisma = {
      ping: async () => ({ status: 'down' as const, latencyMs: 0, error: 'DB connection refused' }),
    } as unknown as PrismaService;

    const mockRedis = {
      ping: async () => ({ status: 'up' as const, latencyMs: 1 }),
    } as unknown as RedisService;

    const mockStorage = {
      ping: async () => ({ status: 'up' as const, latencyMs: 5 }),
    } as unknown as StorageService;

    const mockChannelQueue = createMockQueue(true);
    const mockWebhookQueue = createMockQueue(true);

    const appService = new AppService(
      mockPrisma,
      mockRedis,
      mockStorage,
      mockChannelQueue,
      mockWebhookQueue,
    );
    const health = await appService.getHealth();

    assert.strictEqual(health.status, 'down');
    assert.strictEqual(health.dependencies.database.status, 'down');
    assert.strictEqual(health.dependencies.database.error, 'DB connection refused');
  });

  it('should return status degraded when webhook delivery queue is down in getHealth', async () => {
    const mockPrisma = {
      ping: async () => ({ status: 'up' as const, latencyMs: 2 }),
    } as unknown as PrismaService;

    const mockRedis = {
      ping: async () => ({ status: 'up' as const, latencyMs: 1 }),
    } as unknown as RedisService;

    const mockStorage = {
      ping: async () => ({ status: 'up' as const, latencyMs: 5 }),
    } as unknown as StorageService;

    const mockChannelQueue = createMockQueue(true);
    const mockWebhookQueue = createMockQueue(false, 'Webhook delivery queue timeout');

    const appService = new AppService(
      mockPrisma,
      mockRedis,
      mockStorage,
      mockChannelQueue,
      mockWebhookQueue,
    );
    const health = await appService.getHealth();

    assert.strictEqual(health.status, 'degraded');
    assert.strictEqual(health.dependencies.queues.webhookDelivery.status, 'down');
    assert.strictEqual(
      health.dependencies.queues.webhookDelivery.error,
      'Webhook delivery queue timeout',
    );
  });

  it('should safely handle unexpected rejected promise in getHealth', async () => {
    const mockPrisma = {
      ping: async () => {
        throw new Error('Fatal unhandled DB error');
      },
    } as unknown as PrismaService;

    const mockRedis = {
      ping: async () => ({ status: 'up' as const, latencyMs: 1 }),
    } as unknown as RedisService;

    const mockStorage = {
      ping: async () => ({ status: 'up' as const, latencyMs: 5 }),
    } as unknown as StorageService;

    const mockChannelQueue = createMockQueue(true);
    const mockWebhookQueue = createMockQueue(true);

    const appService = new AppService(
      mockPrisma,
      mockRedis,
      mockStorage,
      mockChannelQueue,
      mockWebhookQueue,
    );
    const health = await appService.getHealth();

    assert.strictEqual(health.status, 'down');
    assert.strictEqual(health.dependencies.database.status, 'down');
    assert.strictEqual(health.dependencies.database.error, 'Fatal unhandled DB error');
  });

  it('should return status degraded when a BullMQ queue is down', async () => {
    const mockPrisma = {
      ping: async () => ({ status: 'up' as const, latencyMs: 2 }),
    } as unknown as PrismaService;

    const mockRedis = {
      ping: async () => ({ status: 'up' as const, latencyMs: 1 }),
    } as unknown as RedisService;

    const mockStorage = {
      ping: async () => ({ status: 'up' as const, latencyMs: 5 }),
    } as unknown as StorageService;

    const mockChannelQueue = createMockQueue(false, 'Channel queue Redis connection error');
    const mockWebhookQueue = createMockQueue(true);

    const appService = new AppService(
      mockPrisma,
      mockRedis,
      mockStorage,
      mockChannelQueue,
      mockWebhookQueue,
    );
    const health = await appService.getHealth();

    assert.strictEqual(health.status, 'degraded');
    assert.strictEqual(health.dependencies.queues.channelIngestion.status, 'down');
    assert.strictEqual(
      health.dependencies.queues.channelIngestion.error,
      'Channel queue Redis connection error',
    );
    assert.strictEqual(health.dependencies.queues.webhookDelivery.status, 'ok');
  });

  describe('getLiveness', () => {
    it('should return status ok and process uptime', () => {
      const mockPrisma = {} as PrismaService;
      const mockRedis = {} as RedisService;
      const mockStorage = {} as StorageService;
      const mockChannelQueue = createMockQueue(true);
      const mockWebhookQueue = createMockQueue(true);

      const appService = new AppService(
        mockPrisma,
        mockRedis,
        mockStorage,
        mockChannelQueue,
        mockWebhookQueue,
      );
      const liveness = appService.getLiveness();

      assert.strictEqual(liveness.status, 'ok');
      assert.strictEqual(liveness.service, 'sales-copilot-api');
      assert.strictEqual(typeof liveness.uptime, 'number');
      assert.ok(liveness.timestamp);
    });
  });

  describe('getReadiness', () => {
    it('should return status ok when all dependencies, queues are up and migrations applied', async () => {
      const mockPrisma = {
        ping: async () => ({ status: 'up' as const, latencyMs: 2 }),
        checkMigrations: async () => ({ applied: true, count: 2 }),
      } as unknown as PrismaService;

      const mockRedis = {
        ping: async () => ({ status: 'up' as const, latencyMs: 1 }),
      } as unknown as RedisService;

      const mockStorage = {
        ping: async () => ({ status: 'up' as const, latencyMs: 5 }),
      } as unknown as StorageService;

      const mockChannelQueue = createMockQueue(true);
      const mockWebhookQueue = createMockQueue(true);

      const appService = new AppService(
        mockPrisma,
        mockRedis,
        mockStorage,
        mockChannelQueue,
        mockWebhookQueue,
      );
      const readiness = await appService.getReadiness();

      assert.strictEqual(readiness.status, 'ok');
      assert.strictEqual(readiness.checks.database.status, 'up');
      assert.strictEqual(readiness.checks.database.migrationsApplied, true);
      assert.strictEqual(readiness.checks.database.migrationCount, 2);
      assert.strictEqual(readiness.checks.redis.status, 'up');
      assert.strictEqual(readiness.checks.storage.status, 'up');
      assert.strictEqual(readiness.checks.queues.channelIngestion.status, 'ok');
      assert.strictEqual(readiness.checks.queues.webhookDelivery.status, 'ok');
    });

    it('should return status down when database is down', async () => {
      const mockPrisma = {
        ping: async () => ({ status: 'down' as const, latencyMs: 0, error: 'DB down' }),
        checkMigrations: async () => ({ applied: false, error: 'DB unreachable' }),
      } as unknown as PrismaService;

      const mockRedis = {
        ping: async () => ({ status: 'up' as const, latencyMs: 1 }),
      } as unknown as RedisService;

      const mockStorage = {
        ping: async () => ({ status: 'up' as const, latencyMs: 5 }),
      } as unknown as StorageService;

      const mockChannelQueue = createMockQueue(true);
      const mockWebhookQueue = createMockQueue(true);

      const appService = new AppService(
        mockPrisma,
        mockRedis,
        mockStorage,
        mockChannelQueue,
        mockWebhookQueue,
      );
      const readiness = await appService.getReadiness();

      assert.strictEqual(readiness.status, 'down');
      assert.strictEqual(readiness.checks.database.status, 'down');
      assert.strictEqual(readiness.checks.database.migrationsApplied, false);
    });

    it('should return status down when database is reachable but migrations are not applied', async () => {
      const mockPrisma = {
        ping: async () => ({ status: 'up' as const, latencyMs: 2 }),
        checkMigrations: async () => ({ applied: false, error: 'Migrations table not found' }),
      } as unknown as PrismaService;

      const mockRedis = {
        ping: async () => ({ status: 'up' as const, latencyMs: 1 }),
      } as unknown as RedisService;

      const mockStorage = {
        ping: async () => ({ status: 'up' as const, latencyMs: 5 }),
      } as unknown as StorageService;

      const mockChannelQueue = createMockQueue(true);
      const mockWebhookQueue = createMockQueue(true);

      const appService = new AppService(
        mockPrisma,
        mockRedis,
        mockStorage,
        mockChannelQueue,
        mockWebhookQueue,
      );
      const readiness = await appService.getReadiness();

      assert.strictEqual(readiness.status, 'down');
      assert.strictEqual(readiness.checks.database.status, 'up');
      assert.strictEqual(readiness.checks.database.migrationsApplied, false);
    });

    it('should return status down when migrations check throws an unexpected error in getReadiness', async () => {
      const mockPrisma = {
        ping: async () => ({ status: 'up' as const, latencyMs: 2 }),
        checkMigrations: async () => {
          throw new Error('Database schema corrupted');
        },
      } as unknown as PrismaService;

      const mockRedis = {
        ping: async () => ({ status: 'up' as const, latencyMs: 1 }),
      } as unknown as RedisService;

      const mockStorage = {
        ping: async () => ({ status: 'up' as const, latencyMs: 5 }),
      } as unknown as StorageService;

      const mockChannelQueue = createMockQueue(true);
      const mockWebhookQueue = createMockQueue(true);

      const appService = new AppService(
        mockPrisma,
        mockRedis,
        mockStorage,
        mockChannelQueue,
        mockWebhookQueue,
      );
      const readiness = await appService.getReadiness();

      assert.strictEqual(readiness.status, 'down');
      assert.strictEqual(readiness.checks.database.status, 'up');
      assert.strictEqual(readiness.checks.database.migrationsApplied, false);
      assert.strictEqual(readiness.checks.database.migrationError, 'Database schema corrupted');
    });

    it('should return status degraded when Redis is down', async () => {
      const mockPrisma = {
        ping: async () => ({ status: 'up' as const, latencyMs: 2 }),
        checkMigrations: async () => ({ applied: true, count: 2 }),
      } as unknown as PrismaService;

      const mockRedis = {
        ping: async () => ({ status: 'down' as const, latencyMs: 0, error: 'Redis down' }),
      } as unknown as RedisService;

      const mockStorage = {
        ping: async () => ({ status: 'up' as const, latencyMs: 5 }),
      } as unknown as StorageService;

      const mockChannelQueue = createMockQueue(true);
      const mockWebhookQueue = createMockQueue(true);

      const appService = new AppService(
        mockPrisma,
        mockRedis,
        mockStorage,
        mockChannelQueue,
        mockWebhookQueue,
      );
      const readiness = await appService.getReadiness();

      assert.strictEqual(readiness.status, 'degraded');
      assert.strictEqual(readiness.checks.redis.status, 'down');
    });

    it('should return status degraded when Storage is down', async () => {
      const mockPrisma = {
        ping: async () => ({ status: 'up' as const, latencyMs: 2 }),
        checkMigrations: async () => ({ applied: true, count: 2 }),
      } as unknown as PrismaService;

      const mockRedis = {
        ping: async () => ({ status: 'up' as const, latencyMs: 1 }),
      } as unknown as RedisService;

      const mockStorage = {
        ping: async () => ({ status: 'down' as const, latencyMs: 0, error: 'S3 unreachable' }),
      } as unknown as StorageService;

      const mockChannelQueue = createMockQueue(true);
      const mockWebhookQueue = createMockQueue(true);

      const appService = new AppService(
        mockPrisma,
        mockRedis,
        mockStorage,
        mockChannelQueue,
        mockWebhookQueue,
      );
      const readiness = await appService.getReadiness();

      assert.strictEqual(readiness.status, 'degraded');
      assert.strictEqual(readiness.checks.storage.status, 'down');
    });

    it('should return status degraded when channel ingestion queue is down during readiness check', async () => {
      const mockPrisma = {
        ping: async () => ({ status: 'up' as const, latencyMs: 2 }),
        checkMigrations: async () => ({ applied: true, count: 2 }),
      } as unknown as PrismaService;

      const mockRedis = {
        ping: async () => ({ status: 'up' as const, latencyMs: 1 }),
      } as unknown as RedisService;

      const mockStorage = {
        ping: async () => ({ status: 'up' as const, latencyMs: 5 }),
      } as unknown as StorageService;

      const mockChannelQueue = createMockQueue(false, 'Channel ingestion queue not ready');
      const mockWebhookQueue = createMockQueue(true);

      const appService = new AppService(
        mockPrisma,
        mockRedis,
        mockStorage,
        mockChannelQueue,
        mockWebhookQueue,
      );
      const readiness = await appService.getReadiness();

      assert.strictEqual(readiness.status, 'degraded');
      assert.strictEqual(readiness.checks.queues.channelIngestion.status, 'down');
      assert.strictEqual(
        readiness.checks.queues.channelIngestion.error,
        'Channel ingestion queue not ready',
      );
    });

    it('should return status degraded when webhook delivery queue is down during readiness check', async () => {
      const mockPrisma = {
        ping: async () => ({ status: 'up' as const, latencyMs: 2 }),
        checkMigrations: async () => ({ applied: true, count: 2 }),
      } as unknown as PrismaService;

      const mockRedis = {
        ping: async () => ({ status: 'up' as const, latencyMs: 1 }),
      } as unknown as RedisService;

      const mockStorage = {
        ping: async () => ({ status: 'up' as const, latencyMs: 5 }),
      } as unknown as StorageService;

      const mockChannelQueue = createMockQueue(true);
      const mockWebhookQueue = createMockQueue(false, 'Webhook queue not ready');

      const appService = new AppService(
        mockPrisma,
        mockRedis,
        mockStorage,
        mockChannelQueue,
        mockWebhookQueue,
      );
      const readiness = await appService.getReadiness();

      assert.strictEqual(readiness.status, 'degraded');
      assert.strictEqual(readiness.checks.queues.webhookDelivery.status, 'down');
      assert.strictEqual(readiness.checks.queues.webhookDelivery.error, 'Webhook queue not ready');
    });
  });
});
