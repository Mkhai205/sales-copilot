import { Queue } from 'bullmq';
import { HealthService } from '../health.service';
import { PrismaService } from '../../../infrastructure/database';
import { RedisService } from '../../../infrastructure/redis';
import { StorageService } from '../../../infrastructure/storage';

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

describe('HealthService (Healthcheck Aggregator)', () => {
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

    const healthService = new HealthService(
      mockPrisma,
      mockRedis,
      mockStorage,
      mockChannelQueue,
      mockWebhookQueue,
    );
    const health = await healthService.getHealth();

    expect(health.status).toBe('ok');
    expect(health.dependencies.database.status).toBe('up');
    expect(health.dependencies.redis.status).toBe('up');
    expect(health.dependencies.storage.status).toBe('up');
    expect(health.dependencies.queues.channelIngestion.status).toBe('ok');
    expect(health.dependencies.queues.commentGuard.status).toBe('ok');
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

    const healthService = new HealthService(
      mockPrisma,
      mockRedis,
      mockStorage,
      mockChannelQueue,
      mockWebhookQueue,
    );
    const health = await healthService.getHealth();

    expect(health.status).toBe('degraded');
    expect(health.dependencies.database.status).toBe('up');
    expect(health.dependencies.redis.status).toBe('down');
    expect(health.dependencies.redis.error).toBe('Connection timeout');
    expect(health.dependencies.storage.status).toBe('up');
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

    const healthService = new HealthService(
      mockPrisma,
      mockRedis,
      mockStorage,
      mockChannelQueue,
      mockWebhookQueue,
    );
    const health = await healthService.getHealth();

    expect(health.status).toBe('degraded');
    expect(health.dependencies.storage.status).toBe('down');
    expect(health.dependencies.storage.error).toBe('MinIO unavailable');
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

    const healthService = new HealthService(
      mockPrisma,
      mockRedis,
      mockStorage,
      mockChannelQueue,
      mockWebhookQueue,
    );
    const health = await healthService.getHealth();

    expect(health.status).toBe('down');
    expect(health.dependencies.database.status).toBe('down');
    expect(health.dependencies.database.error).toBe('DB connection refused');
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

    const healthService = new HealthService(
      mockPrisma,
      mockRedis,
      mockStorage,
      mockChannelQueue,
      mockWebhookQueue,
    );
    const health = await healthService.getHealth();

    expect(health.status).toBe('degraded');
    expect(health.dependencies.queues.commentGuard.status).toBe('down');
    expect(health.dependencies.queues.commentGuard.error).toBe('Webhook delivery queue timeout');
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

    const healthService = new HealthService(
      mockPrisma,
      mockRedis,
      mockStorage,
      mockChannelQueue,
      mockWebhookQueue,
    );
    const health = await healthService.getHealth();

    expect(health.status).toBe('down');
    expect(health.dependencies.database.status).toBe('down');
    expect(health.dependencies.database.error).toBe('Fatal unhandled DB error');
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

    const healthService = new HealthService(
      mockPrisma,
      mockRedis,
      mockStorage,
      mockChannelQueue,
      mockWebhookQueue,
    );
    const health = await healthService.getHealth();

    expect(health.status).toBe('degraded');
    expect(health.dependencies.queues.channelIngestion.status).toBe('down');
    expect(health.dependencies.queues.channelIngestion.error).toBe(
      'Channel queue Redis connection error',
    );
    expect(health.dependencies.queues.commentGuard.status).toBe('ok');
  });

  describe('getLiveness', () => {
    it('should return status ok and process uptime', () => {
      const mockPrisma = {} as PrismaService;
      const mockRedis = {} as RedisService;
      const mockStorage = {} as StorageService;
      const mockChannelQueue = createMockQueue(true);
      const mockWebhookQueue = createMockQueue(true);

      const healthService = new HealthService(
        mockPrisma,
        mockRedis,
        mockStorage,
        mockChannelQueue,
        mockWebhookQueue,
      );
      const liveness = healthService.getLiveness();

      expect(liveness.status).toBe('ok');
      expect(liveness.service).toBe('sales-copilot-api');
      expect(typeof liveness.uptime).toBe('number');
      expect(liveness.timestamp).toBeTruthy();
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

      const healthService = new HealthService(
        mockPrisma,
        mockRedis,
        mockStorage,
        mockChannelQueue,
        mockWebhookQueue,
      );
      const readiness = await healthService.getReadiness();

      expect(readiness.status).toBe('ok');
      expect(readiness.checks.database.status).toBe('up');
      expect(readiness.checks.database.migrationsApplied).toBe(true);
      expect(readiness.checks.database.migrationCount).toBe(2);
      expect(readiness.checks.redis.status).toBe('up');
      expect(readiness.checks.storage.status).toBe('up');
      expect(readiness.checks.queues.channelIngestion.status).toBe('ok');
      expect(readiness.checks.queues.commentGuard.status).toBe('ok');
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

      const healthService = new HealthService(
        mockPrisma,
        mockRedis,
        mockStorage,
        mockChannelQueue,
        mockWebhookQueue,
      );
      const readiness = await healthService.getReadiness();

      expect(readiness.status).toBe('down');
      expect(readiness.checks.database.status).toBe('down');
      expect(readiness.checks.database.migrationsApplied).toBe(false);
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

      const healthService = new HealthService(
        mockPrisma,
        mockRedis,
        mockStorage,
        mockChannelQueue,
        mockWebhookQueue,
      );
      const readiness = await healthService.getReadiness();

      expect(readiness.status).toBe('down');
      expect(readiness.checks.database.status).toBe('up');
      expect(readiness.checks.database.migrationsApplied).toBe(false);
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

      const healthService = new HealthService(
        mockPrisma,
        mockRedis,
        mockStorage,
        mockChannelQueue,
        mockWebhookQueue,
      );
      const readiness = await healthService.getReadiness();

      expect(readiness.status).toBe('down');
      expect(readiness.checks.database.status).toBe('up');
      expect(readiness.checks.database.migrationsApplied).toBe(false);
      expect(readiness.checks.database.migrationError).toBe('Database schema corrupted');
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

      const healthService = new HealthService(
        mockPrisma,
        mockRedis,
        mockStorage,
        mockChannelQueue,
        mockWebhookQueue,
      );
      const readiness = await healthService.getReadiness();

      expect(readiness.status).toBe('degraded');
      expect(readiness.checks.redis.status).toBe('down');
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

      const healthService = new HealthService(
        mockPrisma,
        mockRedis,
        mockStorage,
        mockChannelQueue,
        mockWebhookQueue,
      );
      const readiness = await healthService.getReadiness();

      expect(readiness.status).toBe('degraded');
      expect(readiness.checks.storage.status).toBe('down');
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

      const healthService = new HealthService(
        mockPrisma,
        mockRedis,
        mockStorage,
        mockChannelQueue,
        mockWebhookQueue,
      );
      const readiness = await healthService.getReadiness();

      expect(readiness.status).toBe('degraded');
      expect(readiness.checks.queues.channelIngestion.status).toBe('down');
      expect(readiness.checks.queues.channelIngestion.error).toBe(
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

      const healthService = new HealthService(
        mockPrisma,
        mockRedis,
        mockStorage,
        mockChannelQueue,
        mockWebhookQueue,
      );
      const readiness = await healthService.getReadiness();

      expect(readiness.status).toBe('degraded');
      expect(readiness.checks.queues.commentGuard.status).toBe('down');
      expect(readiness.checks.queues.commentGuard.error).toBe('Webhook queue not ready');
    });
  });
});
