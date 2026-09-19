import { PlatformMetricsService } from '../platform-metrics.service';

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

    expect(result.totalWorkspaces).toBe(10);
    expect(result.activeWorkspaces).toBe(8);
    expect(result.suspendedWorkspaces).toBe(2);
    expect(result.totalUsers).toBe(45);
    expect(result.systemHealth).toEqual({
      postgres: 'HEALTHY',
      redis: 'HEALTHY',
      storage: 'HEALTHY',
    });
  });

  it('should report Redis as DOWN when Redis ping fails or rejects, keeping Postgres metrics intact', async () => {
    mockRedis.ping = async () => ({ status: 'down', latencyMs: 10, error: 'Connection refused' });

    const service = new PlatformMetricsService(mockPrisma, mockRedis, mockStorage);
    const result = await service.getMetricsOverview();

    expect(result.totalWorkspaces).toBe(10);
    expect(result.activeWorkspaces).toBe(8);
    expect(result.suspendedWorkspaces).toBe(2);
    expect(result.totalUsers).toBe(45);
    expect(result.systemHealth.postgres).toBe('HEALTHY');
    expect(result.systemHealth.redis).toBe('DOWN');
    expect(result.systemHealth.storage).toBe('HEALTHY');
  });

  it('should report Redis as DOWN when Redis ping throws an unhandled exception', async () => {
    mockRedis.ping = async () => {
      throw new Error('Fatal socket error');
    };

    const service = new PlatformMetricsService(mockPrisma, mockRedis, mockStorage);
    const result = await service.getMetricsOverview();

    expect(result.systemHealth.redis).toBe('DOWN');
    expect(result.systemHealth.postgres).toBe('HEALTHY');
  });

  it('should fallback counts to 0 and report Postgres DOWN when Postgres ping is down', async () => {
    mockPrisma.ping = async () => ({ status: 'down', latencyMs: 50, error: 'Connection timeout' });

    const service = new PlatformMetricsService(mockPrisma, mockRedis, mockStorage);
    const result = await service.getMetricsOverview();

    expect(result.totalWorkspaces).toBe(0);
    expect(result.activeWorkspaces).toBe(0);
    expect(result.suspendedWorkspaces).toBe(0);
    expect(result.totalUsers).toBe(0);
    expect(result.systemHealth.postgres).toBe('DOWN');
    expect(result.systemHealth.redis).toBe('HEALTHY');
  });

  it('should report Postgres as DOWN and fallback counts to 0 when Postgres ping throws an unhandled exception', async () => {
    mockPrisma.ping = async () => {
      throw new Error('Postgres connection pool exhausted');
    };

    const service = new PlatformMetricsService(mockPrisma, mockRedis, mockStorage);
    const result = await service.getMetricsOverview();

    expect(result.totalWorkspaces).toBe(0);
    expect(result.activeWorkspaces).toBe(0);
    expect(result.suspendedWorkspaces).toBe(0);
    expect(result.totalUsers).toBe(0);
    expect(result.systemHealth.postgres).toBe('DOWN');
    expect(result.systemHealth.redis).toBe('HEALTHY');
  });

  it('should omit storage property from systemHealth when StorageService is not provided', async () => {
    const service = new PlatformMetricsService(mockPrisma, mockRedis);
    const result = await service.getMetricsOverview();

    expect(result.totalWorkspaces).toBe(10);
    expect(result.systemHealth.postgres).toBe('HEALTHY');
    expect(result.systemHealth.redis).toBe('HEALTHY');
    expect(result.systemHealth.storage).toBe(undefined);
    expect('storage' in result.systemHealth).toBe(false);
  });

  it('should report storage as DOWN when storage ping fails or throws', async () => {
    mockStorage.ping = async () => ({
      status: 'down',
      latencyMs: 15,
      error: 'S3 bucket not found',
    });

    const service = new PlatformMetricsService(mockPrisma, mockRedis, mockStorage);
    const result = await service.getMetricsOverview();

    expect(result.systemHealth.storage).toBe('DOWN');
  });

  it('should gracefully handle database query runtime exceptions during count retrieval', async () => {
    mockClient.workspace.count = async () => {
      throw new Error('Database disk full');
    };

    const service = new PlatformMetricsService(mockPrisma, mockRedis, mockStorage);
    const result = await service.getMetricsOverview();

    expect(result.totalWorkspaces).toBe(0);
    expect(result.activeWorkspaces).toBe(0);
    expect(result.suspendedWorkspaces).toBe(0);
    expect(result.totalUsers).toBe(0);
    expect(result.systemHealth.postgres).toBe('DOWN');
  });
});
