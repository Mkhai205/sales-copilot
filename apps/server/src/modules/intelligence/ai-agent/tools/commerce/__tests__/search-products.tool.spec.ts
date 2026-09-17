import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { createSearchProductsTool } from '../search-products.tool';

describe('searchProducts Tool (T1)', () => {
  const workspaceId = 'ws-test-123';
  let mockProductsService: any;
  let tool: any;

  beforeEach(() => {
    mockProductsService = {
      listProducts: async (wsId: string, params: any) => {
        if (wsId !== workspaceId) return { items: [], meta: {} };
        if (params.search === 'polo') {
          return {
            items: [
              {
                id: 'prod-1',
                name: 'Áo Polo Cotton',
                basePrice: 150000,
                imageUrl: 'https://example.com/polo.jpg',
                isActive: true,
                variants: [
                  {
                    id: 'var-1',
                    name: 'Trắng / L',
                    sku: 'POLO-WHT-L',
                    price: 150000,
                    availableStock: 23,
                    isActive: true,
                  },
                  {
                    id: 'var-2',
                    name: 'Đen / M',
                    sku: 'POLO-BLK-M',
                    price: 150000,
                    availableStock: 0,
                    isActive: true,
                  },
                  {
                    id: 'var-3',
                    name: 'Ẩn / S',
                    sku: 'POLO-HIDDEN-S',
                    price: 150000,
                    availableStock: 10,
                    isActive: false,
                  },
                ],
              },
            ],
            meta: { total: 1 },
          };
        }
        return { items: [], meta: { total: 0 } };
      },
    };

    tool = createSearchProductsTool({
      workspaceId,
      productsService: mockProductsService,
    });
  });

  it('should return empty list when query is whitespace', async () => {
    const result = await tool.execute({ query: '   ' }, {} as any);
    assert.deepStrictEqual(result, []);
  });

  it('should find matching products and only include active variants', async () => {
    const result = await tool.execute({ query: 'polo' }, {} as any);
    assert.strictEqual(Array.isArray(result), true);
    assert.strictEqual(result.length, 1);

    const product = result[0];
    assert.strictEqual(product.productId, 'prod-1');
    assert.strictEqual(product.name, 'Áo Polo Cotton');
    assert.strictEqual(product.basePrice, 150000);
    // var-3 is inactive, so only 2 variants should be present
    assert.strictEqual(product.variants.length, 2);
    assert.strictEqual(product.variants[0].variantId, 'var-1');
    assert.strictEqual(product.variants[0].availableStock, 23);
  });

  it('should handle service errors gracefully without throwing', async () => {
    mockProductsService.listProducts = async () => {
      throw new Error('Database connection timeout');
    };

    const result = await tool.execute({ query: 'error-query' }, {} as any);
    assert.strictEqual(result.error, 'SEARCH_PRODUCTS_FAILED');
    assert.strictEqual(result.message, 'Database connection timeout');
  });
});
