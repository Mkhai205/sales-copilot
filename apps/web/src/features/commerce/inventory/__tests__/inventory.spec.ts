import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { inventoryApi } from '../api/inventory';
import { InventoryTransactionType } from '@sales-copilot/shared-contracts';

describe('Commerce Inventory API Client (Phase 5)', () => {
  let originalFetch: typeof globalThis.fetch;
  let fetchCalls: { url: string; options?: RequestInit }[] = [];
  const workspaceId = 'ws-inventory-test-01';
  const variantId = 'var-inventory-999';

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

  describe('inventoryApi Client Methods', () => {
    it('listInventoryTransactions: should perform GET to /inventory/transactions with query and X-Workspace-Id header', async () => {
      await inventoryApi.listInventoryTransactions(workspaceId, {
        page: 1,
        limit: 15,
        type: InventoryTransactionType.STOCK_IN,
      });

      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.ok(call.url.includes(`/workspaces/${workspaceId}/inventory/transactions`));
      assert.ok(call.url.includes('page=1'));
      assert.ok(call.url.includes('limit=15'));
      assert.ok(call.url.includes('type=STOCK_IN'));
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
    });

    it('listInventoryVariants: should perform GET to /inventory/variants with query and X-Workspace-Id header', async () => {
      await inventoryApi.listInventoryVariants(workspaceId, {
        search: 'POLO',
        lowStock: true,
      });

      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.ok(call.url.includes(`/workspaces/${workspaceId}/inventory/variants`));
      assert.ok(call.url.includes('search=POLO'));
      assert.ok(call.url.includes('lowStock=true'));
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
    });

    it('getInventorySummary: should perform GET to /inventory/summary with X-Workspace-Id header', async () => {
      await inventoryApi.getInventorySummary(workspaceId);

      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.ok(call.url.includes(`/workspaces/${workspaceId}/inventory/summary`));
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
    });

    it('adjustStockDirect: should perform POST to /inventory/variants/:variantId/adjust with payload and X-Workspace-Id header', async () => {
      const payload = {
        type: InventoryTransactionType.INVENTORY_AUDIT,
        quantity: 25,
        reason: 'Kiem ke dinh ky',
      };

      await inventoryApi.adjustStockDirect(workspaceId, variantId, payload);

      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.strictEqual(call.options?.method, 'POST');
      assert.ok(
        call.url.includes(`/workspaces/${workspaceId}/inventory/variants/${variantId}/adjust`),
      );
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
      assert.deepStrictEqual(JSON.parse(call.options?.body as string), payload);
    });
  });
});
