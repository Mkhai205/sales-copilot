import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { createGetProductDetailsTool } from '../get-product-details.tool';

describe('getProductDetails Tool (T2)', () => {
  const workspaceId = 'ws-test-123';
  let mockProductsService: any;
  let tool: any;

  beforeEach(() => {
    mockProductsService = {
      getProductById: async (wsId: string, id: string) => {
        if (wsId !== workspaceId) return null;
        if (id === 'prod-active') {
          return {
            id: 'prod-active',
            name: 'Áo Khoác Gió',
            description: 'Áo khoác 2 lớp chống nước',
            basePrice: 350000,
            imageUrl: 'https://example.com/jacket.jpg',
            images: ['https://example.com/j1.jpg', 'https://example.com/j2.jpg'],
            isActive: true,
            variants: [
              {
                id: 'var-10',
                name: 'Xanh Navy / XL',
                sku: 'JKT-NVY-XL',
                price: 380000,
                availableStock: 5,
                isActive: true,
              },
              {
                id: 'var-11',
                name: 'Đen / M',
                sku: 'JKT-BLK-M',
                price: 350000,
                availableStock: 12,
                isActive: false, // inactive variant
              },
            ],
          };
        }
        if (id === 'prod-inactive') {
          return {
            id: 'prod-inactive',
            name: 'Hàng Ngừng Bán',
            isActive: false,
            variants: [],
          };
        }
        const err: any = new Error('Product not found');
        err.status = 404;
        err.code = 'PRODUCT_NOT_FOUND';
        throw err;
      },
    };

    tool = createGetProductDetailsTool({
      workspaceId,
      productsService: mockProductsService,
    });
  });

  it('should return full details for an active product', async () => {
    const result = await tool.execute({ productId: 'prod-active' }, {} as any);
    assert.ok(result);
    assert.strictEqual(result.productId, 'prod-active');
    assert.strictEqual(result.name, 'Áo Khoác Gió');
    assert.strictEqual(result.basePrice, 350000);
    assert.strictEqual(result.images.length, 2);
    // Inactive variant excluded
    assert.strictEqual(result.variants.length, 1);
    assert.strictEqual(result.variants[0].variantId, 'var-10');
    assert.strictEqual(result.variants[0].price, 380000);
  });

  it('should return null when product is not found', async () => {
    const result = await tool.execute({ productId: 'non-existent' }, {} as any);
    assert.strictEqual(result, null);
  });

  it('should return null when product is inactive', async () => {
    const result = await tool.execute({ productId: 'prod-inactive' }, {} as any);
    assert.strictEqual(result, null);
  });
});
