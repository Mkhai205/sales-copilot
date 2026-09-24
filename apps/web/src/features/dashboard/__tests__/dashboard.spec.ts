import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { dashboardApi } from '../api/dashboard';
import type { DashboardSummaryDto } from '@sales-copilot/shared-contracts';

describe('Dashboard Feature Test Suite (Phase 3)', () => {
  let originalFetch: typeof globalThis.fetch;
  const workspaceId = 'ws_dashboard_123';

  const mockSummary: DashboardSummaryDto = {
    date: '2026-03-24',
    timezone: 'Asia/Ho_Chi_Minh',
    orders: {
      totalOrdersToday: 45,
      totalRevenueToday: 15000000,
      paidRevenueToday: 12000000,
    },
    conversations: {
      newConversationsToday: 18,
    },
    contacts: {
      newContactsToday: 10,
    },
    aiCopilot: {
      isActive: true,
      enabledInboxesCount: 2,
      totalInboxesCount: 3,
      handledConversationsToday: 12,
    },
  };

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('dashboardApi Client Methods', () => {
    it('getSummary() should perform GET to /dashboard/summary with X-Workspace-Id header', async () => {
      let requestedUrl = '';
      let requestedHeaders: any = {};
      let requestedMethod = '';

      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        requestedUrl = url.toString();
        requestedMethod = init?.method || 'GET';
        requestedHeaders = init?.headers || {};
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: mockSummary,
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const res = await dashboardApi.getSummary(workspaceId);

      assert.ok(requestedUrl.includes('/dashboard/summary'));
      assert.strictEqual(requestedMethod, 'GET');
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.orders.totalRevenueToday, 15000000);
      assert.strictEqual(res.data.orders.totalOrdersToday, 45);
      assert.strictEqual(res.data.conversations.newConversationsToday, 18);
    });

    it('getSummary() should serialize date range query parameters (from, to)', async () => {
      let requestedUrl = '';

      globalThis.fetch = (async (url: string | URL | Request) => {
        requestedUrl = url.toString();
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: mockSummary,
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      await dashboardApi.getSummary(workspaceId, {
        from: '2026-03-01T00:00:00Z',
        to: '2026-03-24T23:59:59Z',
      });

      assert.ok(requestedUrl.includes('from=2026-03-01T00%3A00%3A00Z'));
      assert.ok(requestedUrl.includes('to=2026-03-24T23%3A59%3A59Z'));
    });
  });
});
