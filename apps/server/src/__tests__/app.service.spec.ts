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
});
