import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { PlatformMetricsOverviewDto } from '@sales-copilot/shared-contracts';
import { PlatformMetricsController } from '../controllers/platform-metrics.controller';

describe('PlatformMetricsController (REST API Endpoints)', () => {
  let controller: PlatformMetricsController;
  let mockService: any;
  let calledCount: number;

  const mockOverview: PlatformMetricsOverviewDto = {
    totalWorkspaces: 12,
    activeWorkspaces: 10,
    suspendedWorkspaces: 2,
    totalUsers: 56,
    systemHealth: {
      postgres: 'HEALTHY',
      redis: 'HEALTHY',
      storage: 'HEALTHY',
    },
  };

  beforeEach(() => {
    calledCount = 0;
    mockService = {
      getMetricsOverview: async () => {
        calledCount++;
        return mockOverview;
      },
    };

    controller = new PlatformMetricsController(mockService);
  });

  it('should delegate getOverview to PlatformMetricsService and return metrics dto', async () => {
    const result = await controller.getOverview();

    assert.strictEqual(calledCount, 1);
    assert.deepStrictEqual(result, mockOverview);
    assert.strictEqual(result.totalWorkspaces, 12);
    assert.strictEqual(result.activeWorkspaces, 10);
    assert.strictEqual(result.systemHealth.postgres, 'HEALTHY');
  });
});
