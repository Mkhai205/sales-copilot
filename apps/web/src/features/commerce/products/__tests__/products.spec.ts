import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { productsApi } from '../api/products';
import { InventoryTransactionType } from '@sales-copilot/shared-contracts';

describe('Commerce Products API Client (Phase 5)', () => {
  let originalFetch: typeof globalThis.fetch;
  let fetchCalls: { url: string; options?: RequestInit }[] = [];
  const workspaceId = 'ws-products-test-01';
  const productId = 'prod-123';
  const variantId = 'var-456';

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

  describe('productsApi Client Methods', () => {
    it('listProducts: should perform GET to /workspaces/:workspaceId/products with query and X-Workspace-Id header', async () => {
      await productsApi.listProducts(workspaceId, { search: 'Shirt', page: 1, limit: 10 });

      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.ok(call.url.includes(`/products`));
      assert.ok(call.url.includes('search=Shirt'));
      assert.ok(call.url.includes('page=1'));
      assert.ok(call.url.includes('limit=10'));
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
    });

    it('getProduct: should perform GET to /workspaces/:workspaceId/products/:id with X-Workspace-Id header', async () => {
      await productsApi.getProduct(workspaceId, productId);

      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.ok(call.url.includes(`/products/${productId}`));
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
    });

    it('createProduct: should perform POST to /workspaces/:workspaceId/products with body and X-Workspace-Id header', async () => {
      const payload = {
        name: 'Ao Thun Polo',
        sku: 'AT-POLO-01',
        basePrice: 199000,
      };

      await productsApi.createProduct(workspaceId, payload);

      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.strictEqual(call.options?.method, 'POST');
      assert.ok(call.url.includes(`/products`));
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
      assert.deepStrictEqual(JSON.parse(call.options?.body as string), payload);
    });

    it('updateProduct: should perform PUT to /workspaces/:workspaceId/products/:id with body and X-Workspace-Id header', async () => {
      const payload = {
        name: 'Ao Thun Polo Cao Cap',
        basePrice: 229000,
      };

      await productsApi.updateProduct(workspaceId, productId, payload);

      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.strictEqual(call.options?.method, 'PUT');
      assert.ok(call.url.includes(`/products/${productId}`));
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
      assert.deepStrictEqual(JSON.parse(call.options?.body as string), payload);
    });

    it('deleteProduct: should perform DELETE to /workspaces/:workspaceId/products/:id with X-Workspace-Id header', async () => {
      await productsApi.deleteProduct(workspaceId, productId);

      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.strictEqual(call.options?.method, 'DELETE');
      assert.ok(call.url.includes(`/products/${productId}`));
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
    });

    it('adjustVariantInventory: should perform POST to variant inventory endpoint with X-Workspace-Id header', async () => {
      const payload = {
        type: InventoryTransactionType.STOCK_IN,
        quantity: 50,
        reason: 'Nhap kho lo moi',
      };

      await productsApi.adjustVariantInventory(workspaceId, productId, variantId, payload);

      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.strictEqual(call.options?.method, 'POST');
      assert.ok(call.url.includes(`/products/${productId}/variants/${variantId}/inventory`));
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
      assert.deepStrictEqual(JSON.parse(call.options?.body as string), payload);
    });

    it('getVariantTransactions: should perform GET to variant transactions endpoint with X-Workspace-Id header', async () => {
      await productsApi.getVariantTransactions(workspaceId, productId, variantId, { limit: 20 });

      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.ok(
        call.url.includes(`/products/${productId}/variants/${variantId}/inventory/transactions`),
      );
      assert.ok(call.url.includes('limit=20'));
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
    });
  });
});
