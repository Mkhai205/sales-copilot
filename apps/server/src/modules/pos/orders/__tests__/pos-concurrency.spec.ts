import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { ConflictException } from '@nestjs/common';
import {
  InventoryTransactionType,
  OrderStatus,
  PaymentStatus,
  FulfillmentStatus,
} from '@sales-copilot/shared-contracts';
import { OrdersService } from '../orders.service';

describe('OrdersService Concurrency Stress Test (20 Parallel Reservation Threads)', () => {
  let service: OrdersService;
  let mockPrismaService: any;
  let mockEventEmitter: any;

  let variantsDb: Map<string, any>;
  let ordersDb: Map<string, any>;
  let orderItemsDb: Map<string, any>;
  let inventoryTransactionsDb: Map<string, any>;

  const ws1 = 'ws_tenant_concurrency';
  const userId = 'usr_dispatcher';
  const varId = 'var_limited_stock_item';
  const prodId = 'prod_limited_item';

  beforeEach(() => {
    variantsDb = new Map();
    ordersDb = new Map();
    orderItemsDb = new Map();
    inventoryTransactionsDb = new Map();

    // Limited variant with only 2 items available in stock
    variantsDb.set(varId, {
      id: varId,
      productId: prodId,
      workspaceId: ws1,
      name: 'Phiên bản giới hạn',
      sku: 'LIMITED-EDITION-01',
      price: 100000,
      costPrice: 50000,
      stockQuantity: 2, // Total 2 items in stock
      reservedQuantity: 0, // 0 reserved initially -> available = 2
    });

    // Seed 20 DRAFT orders, each wanting 1 item
    for (let i = 1; i <= 20; i++) {
      const orderId = `ord-draft-${i}`;
      ordersDb.set(orderId, {
        id: orderId,
        displayId: 2000 + i,
        orderNumber: `ORD-CONCURRENCY-${i}`,
        workspaceId: ws1,
        status: OrderStatus.DRAFT,
        paymentStatus: PaymentStatus.UNPAID,
        fulfillmentStatus: FulfillmentStatus.UNFULFILLED,
        subtotal: 100000,
        totalAmount: 100000,
        paidAmount: 0,
        contactId: `contact-${i}`,
      });

      orderItemsDb.set(`item-${i}`, {
        id: `item-${i}`,
        workspaceId: ws1,
        orderId,
        variantId: varId,
        productName: 'Phiên bản giới hạn',
        variantName: 'Mặc định',
        sku: 'LIMITED-EDITION-01',
        quantity: 1,
        unitPrice: 100000,
        totalPrice: 100000,
      });
    }

    mockEventEmitter = {
      emit: () => {},
    };

    const clientMock: any = {
      order: {
        findFirst: async ({ where, include }: any) => {
          for (const o of ordersDb.values()) {
            if (where.workspaceId && o.workspaceId !== where.workspaceId) continue;
            if (where.id && o.id !== where.id) continue;
            const res = { ...o };
            if (include?.items) {
              res.items = Array.from(orderItemsDb.values()).filter(i => i.orderId === o.id);
            }
            return res;
          }
          return null;
        },
        findFirstOrThrow: async ({ where, include }: any) => {
          const res = await clientMock.order.findFirst({ where, include });
          if (!res) throw new Error('Order not found');
          return res;
        },
        updateMany: async ({ where, data }: any) => {
          let count = 0;
          for (const [id, o] of ordersDb.entries()) {
            if (where.id && o.id !== where.id) continue;
            if (where.workspaceId && o.workspaceId !== where.workspaceId) continue;
            ordersDb.set(id, { ...o, ...data, updatedAt: new Date() });
            count++;
          }
          return { count };
        },
        update: async ({ where, data, include }: any) => {
          const existing = ordersDb.get(where.id);
          if (!existing) throw new Error('Order not found');
          const updated = { ...existing, ...data, updatedAt: new Date() };
          ordersDb.set(where.id, updated);
          const res = { ...updated };
          if (include?.items) {
            res.items = Array.from(orderItemsDb.values()).filter(i => i.orderId === where.id);
          }
          return res;
        },
      },
      productVariant: {
        findFirst: async ({ where }: any) => {
          for (const v of variantsDb.values()) {
            if (where.workspaceId && v.workspaceId !== where.workspaceId) continue;
            if (where.id && v.id !== where.id) continue;
            return { ...v };
          }
          return null;
        },
        findFirstOrThrow: async ({ where }: any) => {
          const v = await clientMock.productVariant.findFirst({ where });
          if (!v) throw new Error('Variant not found');
          return v;
        },
      },
      inventoryTransaction: {
        create: async ({ data }: any) => {
          const id = `inv-tx-${inventoryTransactionsDb.size + 1}`;
          const rec = { id, ...data, createdAt: new Date() };
          inventoryTransactionsDb.set(id, rec);
          return rec;
        },
      },
      $executeRaw: async (strings: TemplateStringsArray, ...values: any[]) => {
        // Atomic conditional reservation:
        // UPDATE product_variants SET reservedQuantity = reservedQuantity + qty
        // WHERE id = varId AND workspaceId = wsId AND (stockQuantity - reservedQuantity) >= qty
        const qty = values[0];
        const vId = values[1];
        const wId = values[2];
        const v = variantsDb.get(vId);

        if (!v || v.workspaceId !== wId) {
          return 0;
        }

        const available = v.stockQuantity - v.reservedQuantity;
        if (available >= qty) {
          v.reservedQuantity += qty;
          return 1; // 1 row updated
        }

        return 0; // 0 rows updated -> stock shortage
      },
    };

    mockPrismaService = {
      order: clientMock.order,
      getClient: () => clientMock,
      runInTransaction: async (cb: any) => {
        const postHooks: Array<() => void> = [];
        const ctx = {
          tx: clientMock,
          addPostCommitHook: (fn: () => void) => postHooks.push(fn),
        };
        const result = await cb(ctx);
        for (const h of postHooks) h();
        return result;
      },
    };

    service = new OrdersService(mockPrismaService, mockEventEmitter as any);
  });

  it('should allow exactly 2 out of 20 concurrent confirmation threads when stock is 2', async () => {
    // 20 concurrent threads trying to confirm distinct draft orders
    const orderIds = Array.from({ length: 20 }, (_, i) => `ord-draft-${i + 1}`);

    const results = await Promise.allSettled(
      orderIds.map(orderId => service.confirmOrder(ws1, orderId, userId)),
    );

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    // Exactly 2 succeeded
    assert.strictEqual(fulfilled.length, 2, 'Exactly 2 orders should be confirmed');

    // Exactly 18 failed with INSUFFICIENT_STOCK ConflictException
    assert.strictEqual(rejected.length, 18, 'Exactly 18 orders should be rejected');

    for (const rej of rejected) {
      if (rej.status === 'rejected') {
        const err = rej.reason;
        assert.strictEqual(err instanceof ConflictException, true);
        assert.strictEqual(err.getResponse().code, 'INSUFFICIENT_STOCK');
      }
    }

    // Final inventory invariant checks
    const variant = variantsDb.get(varId);
    assert.strictEqual(variant.stockQuantity, 2, 'Physical stock remains 2');
    assert.strictEqual(variant.reservedQuantity, 2, 'Reserved quantity is exactly 2');
    assert.strictEqual(variant.stockQuantity - variant.reservedQuantity, 0, 'Available stock is 0');

    // Exactly 2 RESERVATION ledger audit rows
    const invTxs = Array.from(inventoryTransactionsDb.values());
    assert.strictEqual(invTxs.length, 2);
    assert.strictEqual(invTxs[0].type, InventoryTransactionType.RESERVATION);
    assert.strictEqual(invTxs[1].type, InventoryTransactionType.RESERVATION);
  });
});
