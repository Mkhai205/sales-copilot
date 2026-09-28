import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { reconciliationApi } from '../api/reconciliation';

describe('Commerce Reconciliation API Client (Phase 5)', () => {
  let originalFetch: typeof globalThis.fetch;
  let fetchCalls: { url: string; options?: RequestInit }[] = [];
  const workspaceId = 'ws-reconciliation-test-01';
  const transactionId = 'tx-123456';

  beforeEach(() => {
    fetchCalls = [];
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls.push({ url: String(input), options: init });
      return new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('reconciliationApi Client Methods', () => {
    it('listTransactions: should perform GET to /reconciliation/transactions with query and X-Workspace-Id header', async () => {
      await reconciliationApi.listTransactions(workspaceId, {
        page: 1,
        limit: 20,
        status: 'ALL',
      });

      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.ok(call.url.includes(`/reconciliation/transactions`));
      assert.ok(call.url.includes('page=1'));
      assert.ok(call.url.includes('limit=20'));
      assert.ok(call.url.includes('status=ALL'));
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
    });

    it('getStats: should perform GET to /reconciliation/stats with X-Workspace-Id header', async () => {
      await reconciliationApi.getStats(workspaceId, {
        from: '2026-03-01T00:00:00Z',
        to: '2026-03-24T23:59:59Z',
      });

      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.ok(call.url.includes(`/reconciliation/stats`));
      assert.ok(call.url.includes('from=2026-03-01T00%3A00%3A00Z'));
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
    });

    it('manualMatch: should perform POST to /reconciliation/transactions/:id/manual-match with X-Workspace-Id header', async () => {
      const payload = {
        orderId: 'ord-match-789',
        notes: 'Khop tay giao dich VietQR',
      };

      await reconciliationApi.manualMatch(workspaceId, transactionId, payload);

      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.strictEqual(call.options?.method, 'POST');
      assert.ok(call.url.includes(`/reconciliation/transactions/${transactionId}/manual-match`));
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
      assert.deepStrictEqual(JSON.parse(call.options?.body as string), payload);
    });
  });
});
