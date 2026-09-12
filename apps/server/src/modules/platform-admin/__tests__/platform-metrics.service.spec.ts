import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { PlatformMetricsService } from '../services/platform-metrics.service';

describe('PlatformMetricsService (System Overview & Health Metrics)', () => {
  let mockPrisma: any;
  let mockRedis: any;
  let mockStorage: any;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      workspace: {
        count: async (args?: { where?: { isSuspended?: boolean } }) => {
          if (args?.where?.isSuspended === false) return 8;
          if (args?.where?.isSuspended === true) return 2;
          return 10;
        },
      },
      user: {
        count: async () => 45,
      },
    };

    mockPrisma = {
      ping: async () => ({ status: 'up', latencyMs: 3 }),
      getClient: () => mockClient,
    };

    mockRedis = {
      ping: async () => ({ status: 'up', latencyMs: 1 }),
    };

    mockStorage = {
      ping: async () => ({ status: 'up', latencyMs: 5 }),
    };
  });

  it('should return healthy status and accurate counts when all services are UP', async () => {
    const service = new PlatformMetricsService(mockPrisma, mockRedis, mockStorage);
    const result = await service.getMetricsOverview();

    assert.strictEqual(result.totalWorkspaces, 10);
    assert.strictEqual(result.activeWorkspaces, 8);
    assert.strictEqual(result.suspendedWorkspaces, 2);
    assert.strictEqual(result.totalUsers, 45);
    assert.deepStrictEqual(result.systemHealth, {
      postgres: 'HEALTHY',
      redis: 'HEALTHY',
      storage: 'HEALTHY',
    });
  });

  it('should report Redis as DOWN when Redis ping fails or rejects, keeping Postgres metrics intact', async () => {
    mockRedis.ping = async () => ({ status: 'down', latencyMs: 10, error: 'Connection refused' });

    const service = new PlatformMetricsService(mockPrisma, mockRedis, mockStorage);
    const result = await service.getMetricsOverview();

    assert.strictEqual(result.totalWorkspaces, 10);
    assert.strictEqual(result.activeWorkspaces, 8);
    assert.strictEqual(result.suspendedWorkspaces, 2);
    assert.strictEqual(result.totalUsers, 45);
    assert.strictEqual(result.systemHealth.postgres, 'HEALTHY');
    assert.strictEqual(result.systemHealth.redis, 'DOWN');
    assert.strictEqual(result.systemHealth.storage, 'HEALTHY');
  });

  it('should report Redis as DOWN when Redis ping throws an unhandled exception', async () => {
    mockRedis.ping = async () => {
      throw new Error('Fatal socket error');
    };

    const service = new PlatformMetricsService(mockPrisma, mockRedis, mockStorage);
    const result = await service.getMetricsOverview();

    assert.strictEqual(result.systemHealth.redis, 'DOWN');
    assert.strictEqual(result.systemHealth.postgres, 'HEALTHY');
  });

  it('should fallback counts to 0 and report Postgres DOWN when Postgres ping is down', async () => {
    mockPrisma.ping = async () => ({ status: 'down', latencyMs: 50, error: 'Connection timeout' });

    const service = new PlatformMetricsService(mockPrisma, mockRedis, mockStorage);
    const result = await service.getMetricsOverview();

    assert.strictEqual(result.totalWorkspaces, 0);
    assert.strictEqual(result.activeWorkspaces, 0);
    assert.strictEqual(result.suspendedWorkspaces, 0);
    assert.strictEqual(result.totalUsers, 0);
    assert.strictEqual(result.systemHealth.postgres, 'DOWN');
    assert.strictEqual(result.systemHealth.redis, 'HEALTHY');
  });

  it('should report Postgres as DOWN and fallback counts to 0 when Postgres ping throws an unhandled exception', async () => {
    mockPrisma.ping = async () => {
      throw new Error('Postgres connection pool exhausted');
    };

    const service = new PlatformMetricsService(mockPrisma, mockRedis, mockStorage);
    const result = await service.getMetricsOverview();

    assert.strictEqual(result.totalWorkspaces, 0);
    assert.strictEqual(result.activeWorkspaces, 0);
    assert.strictEqual(result.suspendedWorkspaces, 0);
    assert.strictEqual(result.totalUsers, 0);
    assert.strictEqual(result.systemHealth.postgres, 'DOWN');
    assert.strictEqual(result.systemHealth.redis, 'HEALTHY');
  });

  it('should omit storage property from systemHealth when StorageService is not provided', async () => {
    const service = new PlatformMetricsService(mockPrisma, mockRedis);
    const result = await service.getMetricsOverview();

    assert.strictEqual(result.totalWorkspaces, 10);
    assert.strictEqual(result.systemHealth.postgres, 'HEALTHY');
    assert.strictEqual(result.systemHealth.redis, 'HEALTHY');
    assert.strictEqual(result.systemHealth.storage, undefined);
    assert.strictEqual('storage' in result.systemHealth, false);
  });

  it('should report storage as DOWN when storage ping fails or throws', async () => {
    mockStorage.ping = async () => ({
      status: 'down',
      latencyMs: 15,
      error: 'S3 bucket not found',
    });

    const service = new PlatformMetricsService(mockPrisma, mockRedis, mockStorage);
    const result = await service.getMetricsOverview();

    assert.strictEqual(result.systemHealth.storage, 'DOWN');
  });

  it('should gracefully handle database query runtime exceptions during count retrieval', async () => {
    mockClient.workspace.count = async () => {
      throw new Error('Database disk full');
    };

    const service = new PlatformMetricsService(mockPrisma, mockRedis, mockStorage);
    const result = await service.getMetricsOverview();

    assert.strictEqual(result.totalWorkspaces, 0);
    assert.strictEqual(result.activeWorkspaces, 0);
    assert.strictEqual(result.suspendedWorkspaces, 0);
    assert.strictEqual(result.totalUsers, 0);
    assert.strictEqual(result.systemHealth.postgres, 'DOWN');
  });
});
