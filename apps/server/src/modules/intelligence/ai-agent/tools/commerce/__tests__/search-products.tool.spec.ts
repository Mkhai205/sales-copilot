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
    expect(result).toEqual([]);
  });

  it('should find matching products and only include active variants', async () => {
    const result = await tool.execute({ query: 'polo' }, {} as any);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);

    const product = result[0];
    expect(product.productId).toBe('prod-1');
    expect(product.name).toBe('Áo Polo Cotton');
    expect(product.basePrice).toBe(150000);
    // var-3 is inactive, so only 2 variants should be present
    expect(product.variants.length).toBe(2);
    expect(product.variants[0].variantId).toBe('var-1');
    expect(product.variants[0].availableStock).toBe(23);
  });

  it('should handle service errors gracefully without throwing', async () => {
    mockProductsService.listProducts = async () => {
      throw new Error('Database connection timeout');
    };

    const result = await tool.execute({ query: 'error-query' }, {} as any);
    expect(result.error).toBe('SEARCH_PRODUCTS_FAILED');
    expect(result.message).toBe('Database connection timeout');
  });
});
