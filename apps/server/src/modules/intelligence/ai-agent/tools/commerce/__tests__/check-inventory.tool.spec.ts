import { createCheckInventoryTool } from '../check-inventory.tool';

describe('checkInventory Tool (T3)', () => {
  const workspaceId = 'ws-test-123';
  let mockPrisma: any;
  let mockInventoryService: any;
  let tool: any;

  beforeEach(() => {
    mockPrisma = {
      getClient: () => ({
        productVariant: {
          findFirst: async ({ where }: any) => {
            if (where.workspaceId !== workspaceId) return null;
            if (where.id === 'var-in-stock') {
              return { id: 'var-in-stock', name: 'Đỏ / M', sku: 'SKU-RED-M', isActive: true };
            }
            if (where.id === 'var-out-of-stock') {
              return { id: 'var-out-of-stock', name: 'Xanh / S', sku: 'SKU-BLU-S', isActive: true };
            }
            if (where.id === 'var-inactive') {
              return { id: 'var-inactive', name: 'Vàng / L', sku: 'SKU-YEL-L', isActive: false };
            }
            return null;
          },
        },
      }),
    };

    mockInventoryService = {
      getStock: async (wsId: string, variantId: string) => {
        if (wsId !== workspaceId) throw new Error('Variant not found');
        if (variantId === 'var-in-stock') {
          return {
            variantId: 'var-in-stock',
            sku: 'SKU-RED-M',
            stockQuantity: 20,
            reservedQuantity: 5,
            availableStock: 15,
          };
        }
        if (variantId === 'var-out-of-stock') {
          return {
            variantId: 'var-out-of-stock',
            sku: 'SKU-BLU-S',
            stockQuantity: 10,
            reservedQuantity: 10,
            availableStock: 0,
          };
        }
        throw new Error('Not found');
      },
    };

    tool = createCheckInventoryTool({
      workspaceId,
      inventoryLedgerService: mockInventoryService,
      prisma: mockPrisma,
    });
  });

  it('should return available stock and isInStock = true when stock > 0', async () => {
    const result = await tool.execute({ variantId: 'var-in-stock' }, {} as any);
    expect(result.variantId).toBe('var-in-stock');
    expect(result.name).toBe('Đỏ / M');
    expect(result.availableStock).toBe(15);
    expect(result.isInStock).toBe(true);
  });

  it('should return isInStock = false when availableStock is 0', async () => {
    const result = await tool.execute({ variantId: 'var-out-of-stock' }, {} as any);
    expect(result.variantId).toBe('var-out-of-stock');
    expect(result.availableStock).toBe(0);
    expect(result.isInStock).toBe(false);
  });

  it('should return error when variant does not exist or is inactive', async () => {
    const notFound = await tool.execute({ variantId: 'non-existent' }, {} as any);
    expect(notFound.error).toBe('VARIANT_NOT_FOUND');

    const inactive = await tool.execute({ variantId: 'var-inactive' }, {} as any);
    expect(inactive.error).toBe('VARIANT_NOT_FOUND');
  });
});
