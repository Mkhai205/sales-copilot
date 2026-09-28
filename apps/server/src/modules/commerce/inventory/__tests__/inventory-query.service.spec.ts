import { expectReject } from '../../../../../test/test-assertions';
import { InventoryQueryService } from '../inventory-query.service';

describe('InventoryQueryService (3-State Stock Queries)', () => {
  let service: InventoryQueryService;
  let mockPrismaService: any;
  let clientMock: any;

  let variantsDb: Map<string, any>;

  const ws1 = 'ws_tenant_1';
  const ws2 = 'ws_tenant_2';
  const varA = 'var_1111-1111-4111-8111-111111111111';
  const varWs2 = 'var_3333-3333-4333-8333-333333333333';

  beforeEach(() => {
    variantsDb = new Map();

    variantsDb.set(varA, {
      id: varA,
      workspaceId: ws1,
      productId: 'prod_1',
      name: 'Size M / Đen',
      sku: 'SHIRT-M-BLK',
      stockQuantity: 10,
      reservedQuantity: 2,
    });

    variantsDb.set(varWs2, {
      id: varWs2,
      workspaceId: ws2,
      productId: 'prod_ws2',
      name: 'Size M / Tenant 2',
      sku: 'SHIRT-M-WS2',
      stockQuantity: 20,
      reservedQuantity: 0,
    });

    clientMock = {
      productVariant: {
        findFirst: async ({ where }: any) => {
          for (const v of variantsDb.values()) {
            if (where.id && v.id !== where.id) continue;
            if (where.workspaceId && v.workspaceId !== where.workspaceId) continue;
            if (where.productId && v.productId !== where.productId) continue;
            return { ...v };
          }
          return null;
        },
      },
    };

    mockPrismaService = {
      getClient: () => clientMock,
      get client() {
        return clientMock;
      },
    };

    service = new InventoryQueryService(mockPrismaService);
  });

  describe('getStock', () => {
    it('should return 3-state stock levels (physical, reserved, available)', async () => {
      const stock = await service.getStock(ws1, varA);
      expect(stock.variantId).toBe(varA);
      expect(stock.stockQuantity).toBe(10);
      expect(stock.reservedQuantity).toBe(2);
      expect(stock.availableStock).toBe(8);
    });

    it('should throw NotFoundException if variant does not exist in workspace', async () => {
      await expectReject(() => service.getStock(ws1, varWs2), /VARIANT_NOT_FOUND/);
    });
  });
});
