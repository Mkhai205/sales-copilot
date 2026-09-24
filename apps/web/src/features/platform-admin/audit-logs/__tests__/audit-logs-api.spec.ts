import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { auditLogsApi } from '../api/audit-logs';

describe('Platform Admin Audit Logs API Client', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('getAuditLogs() should perform GET to /platform-admin/audit-logs with query params', async () => {
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
          data: [
            {
              id: 'log_1',
              action: 'UPDATE_WORKSPACE_PLAN',
              targetType: 'WORKSPACE',
              targetId: 'ws_1',
              createdAt: '2026-03-24T00:00:00Z',
            },
          ],
        }),
      } as Response;
    }) as typeof globalThis.fetch;

    const res = await auditLogsApi.getAuditLogs({ page: 1, limit: 20 });

    assert.ok(requestedUrl.includes('/platform-admin/audit-logs'));
    assert.ok(requestedUrl.includes('page=1'));
    assert.strictEqual(requestedMethod, 'GET');
    assert.strictEqual(res.data.length, 1);
    assert.strictEqual(res.data[0].id, 'log_1');
  });

  it('getAuditLogById() should perform GET to /platform-admin/audit-logs/:id', async () => {
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
            id: 'log_detail_1',
            action: 'TOGGLE_WORKSPACE_STATUS',
            targetType: 'WORKSPACE',
            targetId: 'ws_1',
          },
        }),
      } as Response;
    }) as typeof globalThis.fetch;

    const res = await auditLogsApi.getAuditLogById('log_detail_1');

    assert.ok(requestedUrl.includes('/platform-admin/audit-logs/log_detail_1'));
    assert.strictEqual(requestedMethod, 'GET');
    assert.strictEqual(res.data.id, 'log_detail_1');
  });
});
