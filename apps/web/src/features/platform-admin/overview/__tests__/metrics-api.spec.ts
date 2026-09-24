import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { metricsApi } from '../api/metrics';

describe('Platform Admin Metrics API Client', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('getMetricsOverview() should perform GET to /platform-admin/metrics/overview', async () => {
    let requestedUrl = '';
    let requestedMethod = '';

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      requestedUrl = url.toString();
      requestedMethod = init?.method || 'GET';
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            totalWorkspaces: 42,
            activeWorkspaces: 38,
            totalUsers: 150,
            systemHealth: 'HEALTHY',
          },
        }),
      } as Response;
    }) as typeof globalThis.fetch;

    const res = await metricsApi.getMetricsOverview();

    assert.ok(requestedUrl.includes('/platform-admin/metrics/overview'));
    assert.strictEqual(requestedMethod, 'GET');
    assert.strictEqual(res.data.totalWorkspaces, 42);
    assert.strictEqual(res.data.systemHealth, 'HEALTHY');
  });
});
