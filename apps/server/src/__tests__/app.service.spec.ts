import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { AppService } from '../app.service';
import { PrismaService } from '../infrastructure/database';
import { RedisService } from '../infrastructure/redis';
import { StorageService } from '../infrastructure/storage';

describe('AppService (Healthcheck Aggregator)', () => {
  it('should return status ok when all dependencies are up', async () => {
    const mockPrisma = {
      ping: async () => ({ status: 'up' as const, latencyMs: 2 }),
    } as unknown as PrismaService;

    const mockRedis = {
      ping: async () => ({ status: 'up' as const, latencyMs: 1 }),
    } as unknown as RedisService;

    const mockStorage = {
      ping: async () => ({ status: 'up' as const, latencyMs: 5 }),
    } as unknown as StorageService;

    const appService = new AppService(mockPrisma, mockRedis, mockStorage);
    const health = await appService.getHealth();

    assert.strictEqual(health.status, 'ok');
    assert.strictEqual(health.dependencies.database.status, 'up');
    assert.strictEqual(health.dependencies.redis.status, 'up');
    assert.strictEqual(health.dependencies.storage.status, 'up');
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

    const appService = new AppService(mockPrisma, mockRedis, mockStorage);
    const health = await appService.getHealth();

    assert.strictEqual(health.status, 'degraded');
    assert.strictEqual(health.dependencies.database.status, 'up');
    assert.strictEqual(health.dependencies.redis.status, 'down');
    assert.strictEqual(health.dependencies.redis.error, 'Connection timeout');
    assert.strictEqual(health.dependencies.storage.status, 'up');
  });

  describe('getLiveness', () => {
    it('should return status ok and process uptime', () => {
      const mockPrisma = {} as PrismaService;
      const mockRedis = {} as RedisService;
      const mockStorage = {} as StorageService;

      const appService = new AppService(mockPrisma, mockRedis, mockStorage);
      const liveness = appService.getLiveness();

      assert.strictEqual(liveness.status, 'ok');
      assert.strictEqual(liveness.service, 'sales-copilot-api');
      assert.strictEqual(typeof liveness.uptime, 'number');
      assert.ok(liveness.timestamp);
    });
  });

  describe('getReadiness', () => {
    it('should return status ok when all dependencies are up and migrations applied', async () => {
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

      const appService = new AppService(mockPrisma, mockRedis, mockStorage);
      const readiness = await appService.getReadiness();

      assert.strictEqual(readiness.status, 'ok');
      assert.strictEqual(readiness.checks.database.status, 'up');
      assert.strictEqual(readiness.checks.database.migrationsApplied, true);
      assert.strictEqual(readiness.checks.database.migrationCount, 2);
      assert.strictEqual(readiness.checks.redis.status, 'up');
      assert.strictEqual(readiness.checks.storage.status, 'up');
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

      const appService = new AppService(mockPrisma, mockRedis, mockStorage);
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

      const appService = new AppService(mockPrisma, mockRedis, mockStorage);
      const readiness = await appService.getReadiness();

      assert.strictEqual(readiness.status, 'down');
      assert.strictEqual(readiness.checks.database.status, 'up');
      assert.strictEqual(readiness.checks.database.migrationsApplied, false);
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

      const appService = new AppService(mockPrisma, mockRedis, mockStorage);
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

      const appService = new AppService(mockPrisma, mockRedis, mockStorage);
      const readiness = await appService.getReadiness();

      assert.strictEqual(readiness.status, 'degraded');
      assert.strictEqual(readiness.checks.storage.status, 'down');
    });
  });
});
