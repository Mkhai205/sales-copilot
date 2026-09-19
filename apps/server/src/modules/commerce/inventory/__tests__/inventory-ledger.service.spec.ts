import { expectReject } from '../../../../../test/test-assertions';
import { DomainEvent, InventoryTransactionType } from '@sales-copilot/shared-contracts';
import { InventoryLedgerService } from '../inventory-ledger.service';

describe('InventoryLedgerService (Atomic 3-State Stock & Immutable Ledger)', () => {
  let service: InventoryLedgerService;
  let mockPrismaService: any;
  let mockEventEmitter: any;
  let clientMock: any;
  let emittedEvents: Array<{ event: string; payload: any }>;

  let variantsDb: Map<string, any>;
  let inventoryTransactionsDb: Map<string, any>;

  const ws1 = 'ws_tenant_1';
  const ws2 = 'ws_tenant_2';
  const varA = 'var_1111-1111-4111-8111-111111111111';
  const varB = 'var_2222-2222-4222-8222-222222222222';
  const varWs2 = 'var_3333-3333-4333-8333-333333333333';

  beforeEach(() => {
    variantsDb = new Map();
    inventoryTransactionsDb = new Map();
    emittedEvents = [];

    variantsDb.set(varA, {
      id: varA,
      workspaceId: ws1,
      productId: 'prod_1',
      name: 'Size M / Đen',
      sku: 'SHIRT-M-BLK',
      stockQuantity: 10,
      reservedQuantity: 2,
    });

    variantsDb.set(varB, {
      id: varB,
      workspaceId: ws1,
      productId: 'prod_1',
      name: 'Size L / Đen',
      sku: 'SHIRT-L-BLK',
      stockQuantity: 5,
      reservedQuantity: 0,
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

    mockEventEmitter = {
      emit: (event: string, payload: any) => {
        emittedEvents.push({ event, payload });
      },
    };

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
        findFirstOrThrow: async ({ where }: any) => {
          const res = await clientMock.productVariant.findFirst({ where });
          if (!res) throw new Error('Variant not found');
          return res;
        },
      },
      inventoryTransaction: {
        create: async ({ data }: any) => {
          const id = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const record = { id, ...data, createdAt: new Date() };
          inventoryTransactionsDb.set(id, record);
          return record;
        },
      },
      $executeRaw: async (strings: any, ...values: any[]) => {
        const queryText = Array.isArray(strings) ? strings.join('?') : String(strings);

        if (queryText.includes('"reservedQuantity" = "reservedQuantity" +')) {
          const [qty, varId, wsId] = values;
          const variant = variantsDb.get(varId);
          if (!variant || variant.workspaceId !== wsId) return 0;
          const available = variant.stockQuantity - variant.reservedQuantity;
          if (available >= qty) {
            variant.reservedQuantity += qty;
            variantsDb.set(varId, variant);
            return 1;
          }
          return 0;
        } else if (
          queryText.includes('"stockQuantity" = "stockQuantity" -') &&
          queryText.includes('"reservedQuantity" = "reservedQuantity" -')
        ) {
          const [qty1, qty2, varId, wsId] = values;
          const variant = variantsDb.get(varId);
          if (!variant || variant.workspaceId !== wsId) return 0;
          if (variant.stockQuantity >= qty1 && variant.reservedQuantity >= qty2) {
            variant.stockQuantity -= qty1;
            variant.reservedQuantity -= qty2;
            variantsDb.set(varId, variant);
            return 1;
          }
          return 0;
        } else if (
          queryText.includes('"stockQuantity" = "stockQuantity" -') &&
          !queryText.includes('"reservedQuantity" -')
        ) {
          const [qty, varId, wsId] = values;
          const variant = variantsDb.get(varId);
          if (!variant || variant.workspaceId !== wsId) return 0;
          const available = variant.stockQuantity - variant.reservedQuantity;
          if (available >= qty) {
            variant.stockQuantity -= qty;
            variantsDb.set(varId, variant);
            return 1;
          }
          return 0;
        } else if (queryText.includes('GREATEST(0, "reservedQuantity" -')) {
          const [qty, varId, wsId] = values;
          const variant = variantsDb.get(varId);
          if (!variant || variant.workspaceId !== wsId) return 0;
          variant.reservedQuantity = Math.max(0, variant.reservedQuantity - qty);
          variantsDb.set(varId, variant);
          return 1;
        } else if (queryText.includes('"stockQuantity" = "stockQuantity" +')) {
          const [qty, varId, wsId] = values;
          const variant = variantsDb.get(varId);
          if (!variant || variant.workspaceId !== wsId) return 0;
          variant.stockQuantity += qty;
          variantsDb.set(varId, variant);
          return 1;
        } else if (queryText.includes('"stockQuantity" =')) {
          const [newQty, varId, wsId] = values;
          const variant = variantsDb.get(varId);
          if (!variant || variant.workspaceId !== wsId) return 0;
          if (newQty >= variant.reservedQuantity) {
            variant.stockQuantity = newQty;
            variantsDb.set(varId, variant);
            return 1;
          }
          return 0;
        }

        return 0;
      },
    };

    mockPrismaService = {
      getClient: () => clientMock,
      get client() {
        return clientMock;
      },
      getCurrentContext: () => null,
      runInTransaction: async (cb: any) => {
        const postHooks: Array<() => any> = [];
        const ctx = {
          tx: clientMock,
          addPostCommitHook: (hook: () => any) => postHooks.push(hook),
        };
        const result = await cb(ctx);
        for (const hook of postHooks) {
          await hook();
        }
        return result;
      },
    };

    service = new InventoryLedgerService(mockPrismaService, mockEventEmitter);
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

  describe('reserveStock', () => {
    it('should atomically reserve stock and write RESERVATION ledger record', async () => {
      const txs = await service.reserveStock({
        workspaceId: ws1,
        items: [
          { variantId: varA, quantity: 3, productName: 'Áo', variantName: 'M', sku: 'SHIRT-M-BLK' },
        ],
        orderId: 'ord_101',
        orderDisplayId: 101,
        orderNumber: 'ORD-20260916-101',
      });

      expect(txs.length).toBe(1);
      expect(txs[0].type).toBe(InventoryTransactionType.RESERVATION);
      expect(txs[0].quantity).toBe(3);
      expect(txs[0].previousReserved).toBe(2);
      expect(txs[0].newReserved).toBe(5);

      const variant = variantsDb.get(varA);
      expect(variant.reservedQuantity).toBe(5);

      const events = emittedEvents.filter(e => e.event === DomainEvent.INVENTORY_UPDATED);
      expect(events.length).toBe(1);
      expect(events[0].payload.availableStock).toBe(5);
    });

    it('should throw INSUFFICIENT_STOCK if available stock is less than requested quantity', async () => {
      await expectReject(
        () =>
          service.reserveStock({
            workspaceId: ws1,
            items: [{ variantId: varA, quantity: 9, sku: 'SHIRT-M-BLK' }],
          }),
        (err: any) => {
          expect(err.response?.code).toBe('INSUFFICIENT_STOCK');
          return true;
        },
      );
    });
  });

  describe('commitStock', () => {
    it('should commit previously reserved stock (decrementing physical and reserved)', async () => {
      const txs = await service.commitStock({
        workspaceId: ws1,
        items: [{ variantId: varA, quantity: 2, sku: 'SHIRT-M-BLK' }],
        orderId: 'ord_101',
        isPreviouslyReserved: true,
      });

      expect(txs.length).toBe(1);
      expect(txs[0].type).toBe(InventoryTransactionType.COMMIT_SALE);
      expect(txs[0].previousStock).toBe(10);
      expect(txs[0].newStock).toBe(8);
      expect(txs[0].previousReserved).toBe(2);
      expect(txs[0].newReserved).toBe(0);

      const variant = variantsDb.get(varA);
      expect(variant.stockQuantity).toBe(8);
      expect(variant.reservedQuantity).toBe(0);
    });

    it('should commit unreserved stock directly (decrementing physical stock)', async () => {
      const txs = await service.commitStock({
        workspaceId: ws1,
        items: [{ variantId: varB, quantity: 3, sku: 'SHIRT-L-BLK' }],
        orderId: 'ord_102',
        isPreviouslyReserved: false,
      });

      expect(txs.length).toBe(1);
      expect(txs[0].type).toBe(InventoryTransactionType.COMMIT_SALE);
      expect(txs[0].previousStock).toBe(5);
      expect(txs[0].newStock).toBe(2);

      const variant = variantsDb.get(varB);
      expect(variant.stockQuantity).toBe(2);
      expect(variant.reservedQuantity).toBe(0);
    });
  });

  describe('releaseStock', () => {
    it('should release reservation back to available stock', async () => {
      const txs = await service.releaseStock({
        workspaceId: ws1,
        items: [{ variantId: varA, quantity: 2, sku: 'SHIRT-M-BLK' }],
        orderId: 'ord_101',
      });

      expect(txs.length).toBe(1);
      expect(txs[0].type).toBe(InventoryTransactionType.RELEASE_RESERVATION);
      expect(txs[0].previousReserved).toBe(2);
      expect(txs[0].newReserved).toBe(0);

      const variant = variantsDb.get(varA);
      expect(variant.reservedQuantity).toBe(0);
    });

    it('should accurately record previousReserved and newReserved if quantity exceeds reservedQuantity', async () => {
      // varA initially has reservedQuantity = 2
      const txs = await service.releaseStock({
        workspaceId: ws1,
        items: [{ variantId: varA, quantity: 5, sku: 'SHIRT-M-BLK' }],
        orderId: 'ord_102',
      });

      expect(txs.length).toBe(1);
      expect(txs[0].previousReserved).toBe(2);
      expect(txs[0].newReserved).toBe(0);

      const variant = variantsDb.get(varA);
      expect(variant.reservedQuantity).toBe(0);
    });

    it('should throw VARIANT_NOT_FOUND if variant does not exist in workspace during releaseStock', async () => {
      await expectReject(
        () =>
          service.releaseStock({
            workspaceId: ws1,
            items: [{ variantId: 'non_existent_var', quantity: 1 }],
          }),
        (err: any) => {
          expect(err.response?.code).toBe('VARIANT_NOT_FOUND');
          return true;
        },
      );
    });
  });

  describe('adjustStock', () => {
    it('should handle STOCK_IN adjustment', async () => {
      const result = await service.adjustStock({
        workspaceId: ws1,
        variantId: varB,
        dto: {
          type: InventoryTransactionType.STOCK_IN,
          quantity: 10,
          reason: 'Nhập thêm hàng từ kho tổng',
        },
      });

      expect(result.type).toBe(InventoryTransactionType.STOCK_IN);
      expect(result.previousStock).toBe(5);
      expect(result.newStock).toBe(15);

      const variant = variantsDb.get(varB);
      expect(variant.stockQuantity).toBe(15);
    });

    it('should throw VARIANT_NOT_FOUND in adjustStock if variant does not exist in workspace', async () => {
      await expectReject(
        () =>
          service.adjustStock({
            workspaceId: ws1,
            variantId: 'non_existent_var',
            dto: {
              type: InventoryTransactionType.STOCK_IN,
              quantity: 5,
              reason: 'Lý do kiểm kê',
            },
          }),
        (err: any) => {
          expect(err.response?.code).toBe('VARIANT_NOT_FOUND');
          return true;
        },
      );
    });

    it('should reject STOCK_OUT if it would breach reservedQuantity', async () => {
      await expectReject(
        () =>
          service.adjustStock({
            workspaceId: ws1,
            variantId: varA, // stock=10, reserved=2
            dto: {
              type: InventoryTransactionType.STOCK_OUT,
              quantity: 9, // leaves 1 physical, below 2 reserved
              reason: 'Hàng hỏng',
            },
          }),
        (err: any) => {
          expect(err.response?.code).toBe('CANNOT_REDUCE_BELOW_RESERVED');
          return true;
        },
      );
    });

    it('should handle INVENTORY_AUDIT safely', async () => {
      const result = await service.adjustStock({
        workspaceId: ws1,
        variantId: varA, // stock=10, reserved=2
        dto: {
          type: InventoryTransactionType.INVENTORY_AUDIT,
          quantity: 7, // >= 2 reserved
          reason: 'Kiểm kê định kỳ',
        },
      });

      expect(result.type).toBe(InventoryTransactionType.INVENTORY_AUDIT);
      expect(result.previousStock).toBe(10);
      expect(result.newStock).toBe(7);

      const variant = variantsDb.get(varA);
      expect(variant.stockQuantity).toBe(7);
    });
  });
});
