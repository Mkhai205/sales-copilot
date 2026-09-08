import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import {
  DomainEvent,
  InventoryTransactionType,
  OrderStatus,
  PaymentGateway,
  PaymentStatus,
} from '@sales-copilot/shared-contracts';
import {
  parseOrderDisplayId,
  parseOrderNumber,
  PosReconciliationProcessor,
} from '../pos-reconciliation.processor';
import { PaymentReconciliationService } from '../payment-reconciliation.service';

describe('PosReconciliation (Bank Reconciliation Engine & Safe Inventory Machine)', () => {
  describe('Memo Regex Parser (parseOrderDisplayId & parseOrderNumber)', () => {
    it('should parse display ID from various memo formats', () => {
      assert.strictEqual(parseOrderDisplayId('ORD 1004'), 1004);
      assert.strictEqual(parseOrderDisplayId('ORD-1004'), 1004);
      assert.strictEqual(parseOrderDisplayId('ORD_1004'), 1004);
      assert.strictEqual(parseOrderDisplayId('ORD1004'), 1004);
      assert.strictEqual(parseOrderDisplayId('DH 2025 chuyen khoan'), 2025);
      assert.strictEqual(parseOrderDisplayId('DH-2025-tien-hang'), 2025);
      assert.strictEqual(parseOrderDisplayId('SO 3001'), 3001);
      assert.strictEqual(parseOrderDisplayId('Nguyen Van A CK SO_5555'), 5555);
    });

    it('should correctly parse display ID from full order numbers containing date prefix', () => {
      assert.strictEqual(parseOrderDisplayId('ORD-20260909-1004'), 1004);
      assert.strictEqual(parseOrderDisplayId('ORD 20260909 1004'), 1004);
      assert.strictEqual(parseOrderDisplayId('ORD_20260909_1004'), 1004);
      assert.strictEqual(parseOrderDisplayId('DH-20260909-2025'), 2025);
    });

    it('should extract full order number with parseOrderNumber', () => {
      assert.strictEqual(parseOrderNumber('ORD-20260909-1004 thanh toan'), 'ORD-20260909-1004');
      assert.strictEqual(parseOrderNumber('Chuyen tien ORD-20260909-1004'), 'ORD-20260909-1004');
      assert.strictEqual(parseOrderNumber('No order number here'), null);
    });

    it('should return null for memos without order reference', () => {
      assert.strictEqual(parseOrderDisplayId('Chuyen tien ban than'), null);
      assert.strictEqual(parseOrderDisplayId(''), null);
      assert.strictEqual(parseOrderDisplayId('TK 123456'), null);
    });
  });

  describe('PaymentReconciliationService', () => {
    let service: PaymentReconciliationService;
    let mockPrismaService: any;
    let mockEventEmitter: any;
    let clientMock: any;
    let emittedEvents: Array<{ event: string; payload: any }>;
    let postCommitHooks: Array<() => any>;

    let ordersDb: Map<string, any>;
    let variantsDb: Map<string, any>;
    let paymentTxsDb: Map<string, any>;
    let inventoryTxsDb: Array<any>;

    const wsId = 'ws-reconcile-test';
    const orderId = 'order-reconcile-001';
    const variantId = 'var-shirt-001';

    beforeEach(() => {
      ordersDb = new Map();
      variantsDb = new Map();
      paymentTxsDb = new Map();
      inventoryTxsDb = [];
      emittedEvents = [];
      postCommitHooks = [];

      variantsDb.set(variantId, {
        id: variantId,
        workspaceId: wsId,
        name: 'Áo Thun Trắng / L',
        sku: 'SHIRT-W-L',
        stockQuantity: 10,
        reservedQuantity: 2,
      });

      ordersDb.set(orderId, {
        id: orderId,
        displayId: 1004,
        orderNumber: 'ORD-20260909-1004',
        workspaceId: wsId,
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.UNPAID,
        totalAmount: 500000,
        paidAmount: 0,
        items: [
          {
            id: 'item-001',
            orderId,
            variantId,
            productName: 'Áo Thun Trắng',
            variantName: 'L',
            sku: 'SHIRT-W-L',
            quantity: 2,
            unitPrice: 250000,
            totalPrice: 500000,
          },
        ],
      });

      clientMock = {
        order: {
          findFirst: async (args: any) => {
            const ord = ordersDb.get(args.where.id);
            if (ord && ord.workspaceId === args.where.workspaceId) {
              return JSON.parse(JSON.stringify(ord));
            }
            return null;
          },
          updateMany: async (args: any) => {
            const ord = ordersDb.get(args.where.id);
            if (ord && ord.workspaceId === args.where.workspaceId) {
              Object.assign(ord, args.data);
              return { count: 1 };
            }
            return { count: 0 };
          },
        },
        productVariant: {
          findFirst: async (args: any) => {
            const v = variantsDb.get(args.where.id);
            if (v && v.workspaceId === args.where.workspaceId) {
              return JSON.parse(JSON.stringify(v));
            }
            return null;
          },
          findFirstOrThrow: async (args: any) => {
            const v = variantsDb.get(args.where.id);
            if (!v || v.workspaceId !== args.where.workspaceId) {
              throw new Error('Variant not found');
            }
            return JSON.parse(JSON.stringify(v));
          },
        },
        paymentTransaction: {
          findFirst: async (args: any) => {
            for (const tx of paymentTxsDb.values()) {
              if (
                tx.workspaceId === args.where.workspaceId &&
                tx.idempotencyKey === args.where.idempotencyKey
              ) {
                return JSON.parse(JSON.stringify(tx));
              }
            }
            return null;
          },
          create: async (args: any) => {
            const record = { id: `tx-${Date.now()}`, ...args.data };
            paymentTxsDb.set(record.idempotencyKey, record);
            return record;
          },
        },
        inventoryTransaction: {
          create: async (args: any) => {
            inventoryTxsDb.push(args.data);
            return args.data;
          },
        },
        $executeRaw: async (_query: any, ..._values: any[]) => {
          // Simulate the raw SQL execution decrementing stockQuantity and reservedQuantity
          const variant = variantsDb.get(variantId);
          if (variant) {
            variant.stockQuantity -= 2;
            variant.reservedQuantity -= 2;
            return 1;
          }
          return 0;
        },
      };

      mockPrismaService = {
        getClient: () => clientMock,
        runInTransaction: async (cb: any) => {
          const ctx = {
            tx: clientMock,
            addPostCommitHook: (hook: () => any) => {
              postCommitHooks.push(hook);
            },
          };
          const res = await cb(ctx);
          // Execute post-commit hooks immediately in test harness
          for (const hook of postCommitHooks) {
            await hook();
          }
          return res;
        },
      };

      mockEventEmitter = {
        emit: (event: string, payload: any) => {
          emittedEvents.push({ event, payload });
        },
      };

      service = new PaymentReconciliationService(mockPrismaService, mockEventEmitter as any);
    });

    it('should reconcile full payment: mark order PAID, commit stock, emit ORDER_PAID', async () => {
      const result = await service.reconcileTransaction({
        workspaceId: wsId,
        orderId,
        amount: 500000,
        gateway: PaymentGateway.SEPAY,
        transactionCode: 'SEPAY_TX_1001',
        accountNumber: '0987654321',
        transferContent: 'ORD 1004',
      });

      assert.strictEqual(result.processed, true);
      assert.strictEqual(result.status, 'PAID');
      assert.strictEqual(result.stockCommitted, true);
      assert.strictEqual(result.totalPaid, 500000);

      // Verify DB Order state
      const updatedOrder = ordersDb.get(orderId);
      assert.strictEqual(updatedOrder.status, OrderStatus.PAID);
      assert.strictEqual(updatedOrder.paymentStatus, PaymentStatus.PAID);
      assert.strictEqual(updatedOrder.paidAmount, 500000);

      // Verify inventory transactions
      assert.strictEqual(inventoryTxsDb.length, 1);
      assert.strictEqual(inventoryTxsDb[0].type, InventoryTransactionType.COMMIT_SALE);
      assert.strictEqual(inventoryTxsDb[0].quantity, 2);

      // Verify emitted domain events and order payload
      const orderPaidEvent = emittedEvents.find(e => e.event === DomainEvent.ORDER_PAID);
      assert.ok(orderPaidEvent);
      assert.strictEqual(orderPaidEvent.payload.orderId, orderId);
      assert.strictEqual(orderPaidEvent.payload.paidAmount, 500000);
      assert.strictEqual(orderPaidEvent.payload.isOverpaid, false);
      assert.ok(orderPaidEvent.payload.order);
      assert.strictEqual(orderPaidEvent.payload.order.status, OrderStatus.PAID);
      assert.strictEqual(orderPaidEvent.payload.order.orderNumber, 'ORD-20260909-1004');

      // Verify payment transaction record contains rawWebhookPayload
      const savedTx = Array.from(paymentTxsDb.values())[0];
      assert.ok(savedTx);
      assert.ok('rawWebhookPayload' in savedTx);
    });

    it('should handle partial payment: mark PARTIALLY_PAID, do NOT commit stock', async () => {
      const result = await service.reconcileTransaction({
        workspaceId: wsId,
        orderId,
        amount: 200000, // 200k / 500k
        gateway: PaymentGateway.SEPAY,
        transactionCode: 'SEPAY_TX_PARTIAL',
        accountNumber: '0987654321',
        transferContent: 'ORD 1004 dat coc',
      });

      assert.strictEqual(result.processed, true);
      assert.strictEqual(result.status, 'PARTIALLY_PAID');
      assert.strictEqual(result.stockCommitted, false);
      assert.strictEqual(result.totalPaid, 200000);
      assert.strictEqual(result.remainingAmount, 300000);

      const updatedOrder = ordersDb.get(orderId);
      assert.strictEqual(updatedOrder.status, OrderStatus.CONFIRMED);
      assert.strictEqual(updatedOrder.paymentStatus, PaymentStatus.PARTIALLY_PAID);

      // No COMMIT_SALE should be recorded
      assert.strictEqual(inventoryTxsDb.length, 0);

      const partialPaidEvent = emittedEvents.find(
        e => e.event === DomainEvent.ORDER_PARTIALLY_PAID,
      );
      assert.ok(partialPaidEvent);
      assert.strictEqual(partialPaidEvent.payload.paidAmount, 200000);
      assert.strictEqual(partialPaidEvent.payload.remainingAmount, 300000);
    });

    it('should prevent duplicate stock deduction when order is already PAID (second payment)', async () => {
      // Setup order as already PAID
      const ord = ordersDb.get(orderId);
      ord.status = OrderStatus.PAID;
      ord.paymentStatus = PaymentStatus.PAID;
      ord.paidAmount = 500000;

      const result = await service.reconcileTransaction({
        workspaceId: wsId,
        orderId,
        amount: 100000, // Customer transferred 100k extra
        gateway: PaymentGateway.SEPAY,
        transactionCode: 'SEPAY_TX_EXTRA',
        accountNumber: '0987654321',
        transferContent: 'ORD 1004 chuyen them',
      });

      assert.strictEqual(result.processed, true);
      assert.strictEqual(result.status, 'OVERPAID');
      assert.strictEqual(result.stockCommitted, false); // ABSOLUTELY NO DUPLICATE STOCK DEDUCTION
      assert.strictEqual(result.totalPaid, 600000);

      // Inventory should NOT have any commit sale recorded
      assert.strictEqual(inventoryTxsDb.length, 0);

      const orderPaidEvent = emittedEvents.find(e => e.event === DomainEvent.ORDER_PAID);
      assert.ok(orderPaidEvent);
      assert.strictEqual(orderPaidEvent.payload.isOverpaid, true);
      assert.strictEqual(orderPaidEvent.payload.overpaidAmount, 100000);
    });

    it('should NOT revive CANCELLED orders to PAID and NOT deduct stock', async () => {
      const ord = ordersDb.get(orderId);
      ord.status = OrderStatus.CANCELLED;

      const result = await service.reconcileTransaction({
        workspaceId: wsId,
        orderId,
        amount: 500000,
        gateway: PaymentGateway.SEPAY,
        transactionCode: 'SEPAY_TX_CANCELLED_ORDER',
        accountNumber: '0987654321',
        transferContent: 'ORD 1004',
      });

      assert.strictEqual(result.processed, true);
      assert.strictEqual(result.status, 'CANCELLED_NEEDS_REFUND');
      assert.strictEqual(result.stockCommitted, false);

      // Order status MUST remain CANCELLED
      assert.strictEqual(ord.status, OrderStatus.CANCELLED);
      // No stock deduction
      assert.strictEqual(inventoryTxsDb.length, 0);
    });

    it('should return DUPLICATE if transaction has already been reconciled (Idempotency)', async () => {
      // First transaction
      await service.reconcileTransaction({
        workspaceId: wsId,
        orderId,
        amount: 500000,
        gateway: PaymentGateway.SEPAY,
        transactionCode: 'TX_IDEMPOTENT_1',
        accountNumber: '0987654321',
        transferContent: 'ORD 1004',
      });

      // Second transaction with same idempotency key
      const duplicateResult = await service.reconcileTransaction({
        workspaceId: wsId,
        orderId,
        amount: 500000,
        gateway: PaymentGateway.SEPAY,
        transactionCode: 'TX_IDEMPOTENT_1',
        accountNumber: '0987654321',
        transferContent: 'ORD 1004',
      });

      assert.strictEqual(duplicateResult.processed, false);
      assert.strictEqual(duplicateResult.status, 'DUPLICATE');
    });

    it('should throw BadRequestException if amount is less than or equal to zero', async () => {
      await assert.rejects(
        async () => {
          await service.reconcileTransaction({
            workspaceId: wsId,
            orderId,
            amount: 0,
            gateway: PaymentGateway.SEPAY,
            transactionCode: 'TX_ZERO_AMOUNT',
            accountNumber: '0987654321',
            transferContent: 'ORD 1004',
          });
        },
        (err: any) => {
          assert.strictEqual(err.name, 'BadRequestException');
          assert.strictEqual(err.response?.code, 'INVALID_PAYMENT_AMOUNT');
          return true;
        },
      );
    });
  });

  describe('PosReconciliationProcessor', () => {
    let processor: PosReconciliationProcessor;
    let mockPrismaService: any;
    let mockRedisService: any;
    let mockReconciliationService: any;
    let acquiredLocks: string[];
    let releasedLocks: string[];

    const wsId = 'ws-processor-test';
    const orderId = 'order-proc-001';

    beforeEach(() => {
      acquiredLocks = [];
      releasedLocks = [];

      mockPrismaService = {
        getClient: () => ({
          workspace: {
            findUnique: async () => ({
              id: wsId,
              settings: {
                paymentSettings: {
                  accountNumber: '0987654321',
                },
              },
            }),
          },
          order: {
            findFirst: async (args: any) => {
              const matchesOrder =
                args.where.displayId === 1004 ||
                args.where.orderNumber === 'ORD-20260909-1004' ||
                args.where.OR?.some(
                  (cond: any) =>
                    cond.displayId === 1004 || cond.orderNumber === 'ORD-20260909-1004',
                );
              if (matchesOrder && args.where.workspaceId === wsId) {
                return {
                  id: orderId,
                  displayId: 1004,
                  orderNumber: 'ORD-20260909-1004',
                  status: OrderStatus.CONFIRMED,
                };
              }
              return null;
            },
          },
        }),
      };

      mockRedisService = {
        acquireLock: async (key: string, ttl: number) => {
          acquiredLocks.push(key);
          return 'mock-token-uuid';
        },
        releaseLock: async (key: string, token: string) => {
          releasedLocks.push(key);
          return true;
        },
      };

      mockReconciliationService = {
        reconcileTransaction: async (params: any) => ({
          processed: true,
          status: 'PAID',
          orderId: params.orderId,
          displayId: 1004,
          stockCommitted: true,
        }),
      };

      processor = new PosReconciliationProcessor(
        mockPrismaService,
        mockRedisService,
        mockReconciliationService,
      );
    });

    it('should acquire distributed Redlock, reconcile transaction, and release lock', async () => {
      const jobMock: any = {
        data: {
          workspaceId: wsId,
          gateway: 'sepay',
          transactionId: 'TX_9999',
          amount: 450000,
          accountNumber: '0987654321',
          transferContent: 'ORD 1004 thanh toan',
          bankCode: 'MB',
          rawPayload: {},
        },
      };

      const result = await processor.process(jobMock);

      assert.strictEqual(result.processed, true);
      assert.strictEqual(result.status, 'PAID');

      // Verify Redlock was acquired and released with correct lock key
      const expectedLockKey = `ws:${wsId}:order:${orderId}:reconcile`;
      assert.strictEqual(acquiredLocks.length, 1);
      assert.strictEqual(acquiredLocks[0], expectedLockKey);
      assert.strictEqual(releasedLocks.length, 1);
      assert.strictEqual(releasedLocks[0], expectedLockKey);
    });

    it('should return UNMATCHED_MEMO when memo has no recognizable order id', async () => {
      const jobMock: any = {
        data: {
          workspaceId: wsId,
          gateway: 'sepay',
          transactionId: 'TX_UNKNOWN',
          amount: 100000,
          accountNumber: '0987654321',
          transferContent: 'Chuyen tien khong ghi ro noi dung',
        },
      };

      const result = await processor.process(jobMock);
      assert.strictEqual(result.status, 'UNMATCHED_MEMO');
      assert.strictEqual(acquiredLocks.length, 0);
    });

    it('should reconcile transaction when memo contains full order number with date prefix', async () => {
      const jobMock: any = {
        data: {
          workspaceId: wsId,
          gateway: 'sepay',
          transactionId: 'TX_FULL_ORD_NUM',
          amount: 450000,
          accountNumber: '0987654321',
          transferContent: 'ORD-20260909-1004 thanh toan don hang',
          bankCode: 'MB',
          rawPayload: {},
        },
      };

      const result = await processor.process(jobMock);

      assert.strictEqual(result.processed, true);
      assert.strictEqual(result.status, 'PAID');
    });

    it('should skip job if amount is non-positive', async () => {
      const jobMock: any = {
        data: {
          workspaceId: wsId,
          gateway: 'sepay',
          transactionId: 'TX_ZERO',
          amount: 0,
          accountNumber: '0987654321',
          transferContent: 'ORD 1004',
        },
      };

      const result = await processor.process(jobMock);
      assert.strictEqual(result.status, 'INVALID_AMOUNT');
      assert.strictEqual(acquiredLocks.length, 0);
    });
  });
});
