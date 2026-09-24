import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { workspacesApi } from '../api/workspaces';
import { BillingPlanType } from '@sales-copilot/shared-contracts';

describe('Platform Admin Workspaces API Client', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('getWorkspaces() should perform GET to /platform-admin/workspaces with query params', async () => {
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
          data: [{ id: 'ws_1', name: 'Shop 1', slug: 'shop-1', billingPlan: BillingPlanType.FREE }],
        }),
      } as Response;
    }) as typeof globalThis.fetch;

    const res = await workspacesApi.getWorkspaces({ search: 'Shop', page: 1, limit: 10 });

    assert.ok(requestedUrl.includes('/platform-admin/workspaces'));
    assert.ok(requestedUrl.includes('search=Shop'));
    assert.strictEqual(requestedMethod, 'GET');
    assert.strictEqual(res.data.length, 1);
    assert.strictEqual(res.data[0].id, 'ws_1');
  });

  it('getWorkspaceDetail() should perform GET to /platform-admin/workspaces/:id', async () => {
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
            id: 'ws_target',
            name: 'Target Shop',
            slug: 'target-shop',
            billingPlan: BillingPlanType.ENTERPRISE,
          },
        }),
      } as Response;
    }) as typeof globalThis.fetch;

    const res = await workspacesApi.getWorkspaceDetail('ws_target');

    assert.ok(requestedUrl.includes('/platform-admin/workspaces/ws_target'));
    assert.strictEqual(requestedMethod, 'GET');
    assert.strictEqual(res.data.id, 'ws_target');
  });

  it('updateWorkspacePlan() should perform PATCH with body to /platform-admin/workspaces/:id/plan', async () => {
    let requestedUrl = '';
    let requestedMethod = '';
    let requestedBody = '';

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      requestedUrl = url.toString();
      requestedMethod = init?.method || 'GET';
      requestedBody = (init?.body as string) || '';
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            id: 'ws_target',
            name: 'Target Shop',
            billingPlan: BillingPlanType.ENTERPRISE,
          },
        }),
      } as Response;
    }) as typeof globalThis.fetch;

    const payload = {
      billingPlan: BillingPlanType.ENTERPRISE,
      quotas: { maxAgents: 10 },
    };

    const res = await workspacesApi.updateWorkspacePlan('ws_target', payload);

    assert.ok(requestedUrl.includes('/platform-admin/workspaces/ws_target/plan'));
    assert.strictEqual(requestedMethod, 'PATCH');
    const parsed = JSON.parse(requestedBody);
    assert.strictEqual(parsed.billingPlan, BillingPlanType.ENTERPRISE);
    assert.strictEqual(parsed.quotas.maxAgents, 10);
    assert.strictEqual(res.data.id, 'ws_target');
  });

  it('toggleWorkspaceStatus() should perform PATCH with body to /platform-admin/workspaces/:id/status', async () => {
    let requestedUrl = '';
    let requestedMethod = '';
    let requestedBody = '';

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      requestedUrl = url.toString();
      requestedMethod = init?.method || 'GET';
      requestedBody = (init?.body as string) || '';
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            id: 'ws_target',
            name: 'Target Shop',
            isSuspended: true,
          },
        }),
      } as Response;
    }) as typeof globalThis.fetch;

    const payload = {
      isSuspended: true,
      reason: 'Non-payment',
    };

    const res = await workspacesApi.toggleWorkspaceStatus('ws_target', payload);

    assert.ok(requestedUrl.includes('/platform-admin/workspaces/ws_target/status'));
    assert.strictEqual(requestedMethod, 'PATCH');
    const parsed = JSON.parse(requestedBody);
    assert.strictEqual(parsed.isSuspended, true);
    assert.strictEqual(parsed.reason, 'Non-payment');
    assert.strictEqual(res.data.isSuspended, true);
  });
});
