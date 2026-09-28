import { assertDefined, expectReject } from '../../../../../test/test-assertions';
import {
  DomainEvent,
  InventoryTransactionType,
  OrderStatus,
  PaymentGateway,
  PaymentStatus,
} from '@sales-copilot/shared-contracts';
import { AutoReconciliationMatcher } from '../auto-reconciliation.matcher';

describe('AutoReconciliationMatcher (Bank Reconciliation Engine & Safe Inventory Machine)', () => {
  let matcher: AutoReconciliationMatcher;
  let mockPrismaService: any;
  let mockEventEmitter: any;
  let mockStockMovementService: any;
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
            if (args.where.status) {
              const allowedStatuses = Array.isArray(args.where.status.in)
                ? args.where.status.in
                : [args.where.status];
              if (!allowedStatuses.includes(ord.status)) {
                return { count: 0 };
              }
            }
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
            if (args.where.id && tx.id !== args.where.id) continue;
            if (
              tx.workspaceId === args.where.workspaceId &&
              (!args.where.idempotencyKey || tx.idempotencyKey === args.where.idempotencyKey)
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
        update: async (args: any) => {
          for (const [key, tx] of paymentTxsDb.entries()) {
            if (tx.id === args.where.id) {
              const updated = { ...tx, ...args.data };
              paymentTxsDb.set(key, updated);
              return JSON.parse(JSON.stringify(updated));
            }
          }
          throw new Error('Payment transaction not found');
        },
      },
      auditLog: {
        create: async (args: any) => args.data,
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

    mockStockMovementService = {
      commitStock: async (params: any) => {
        for (const item of params.items || []) {
          const variant = variantsDb.get(item.variantId);
          if (variant) {
            variant.stockQuantity -= item.quantity;
            variant.reservedQuantity -= item.quantity;
          }
          inventoryTxsDb.push({
            workspaceId: params.workspaceId,
            variantId: item.variantId,
            quantity: item.quantity,
            type: InventoryTransactionType.COMMIT_SALE,
            referenceId: params.orderId,
            note: params.reason,
          });
        }
        return { success: true };
      },
      reserveStock: async (params: any) => {
        for (const item of params.items || []) {
          const variant = variantsDb.get(item.variantId);
          if (variant) {
            variant.reservedQuantity += item.quantity;
          }
          inventoryTxsDb.push({
            workspaceId: params.workspaceId,
            variantId: item.variantId,
            quantity: item.quantity,
            type: InventoryTransactionType.RESERVATION,
            referenceId: params.orderId,
            note: params.reason,
          });
        }
        return { success: true };
      },
    };

    matcher = new AutoReconciliationMatcher(
      mockPrismaService,
      mockEventEmitter as any,
      mockStockMovementService as any,
    );
  });

  it('should reconcile full payment: mark order PAID, commit stock, emit ORDER_PAID', async () => {
    const result = await matcher.reconcileTransaction({
      workspaceId: wsId,
      orderId,
      amount: 500000,
      gateway: PaymentGateway.SEPAY,
      transactionCode: 'SEPAY_TX_1001',
      accountNumber: '0987654321',
      transferContent: 'ORD 1004',
    });

    expect(result.processed).toBe(true);
    expect(result.status).toBe('PAID');
    expect(result.stockCommitted).toBe(true);
    expect(result.totalPaid).toBe(500000);

    // Verify DB Order state
    const updatedOrder = ordersDb.get(orderId);
    expect(updatedOrder.status).toBe(OrderStatus.PAID);
    expect(updatedOrder.paymentStatus).toBe(PaymentStatus.PAID);
    expect(updatedOrder.paidAmount).toBe(500000);

    // Verify inventory transactions
    expect(inventoryTxsDb.length).toBe(1);
    expect(inventoryTxsDb[0].type).toBe(InventoryTransactionType.COMMIT_SALE);
    expect(inventoryTxsDb[0].quantity).toBe(2);

    // Verify emitted domain events and order payload
    const orderPaidEvent = emittedEvents.find(e => e.event === DomainEvent.ORDER_PAID);
    assertDefined(orderPaidEvent);
    expect(orderPaidEvent.payload.orderId).toBe(orderId);
    expect(orderPaidEvent.payload.paidAmount).toBe(500000);
    expect(orderPaidEvent.payload.isOverpaid).toBe(false);
    expect(orderPaidEvent.payload.order).toBeTruthy();
    expect(orderPaidEvent.payload.order.status).toBe(OrderStatus.PAID);
    expect(orderPaidEvent.payload.order.orderNumber).toBe('ORD-20260909-1004');

    // Verify payment transaction record contains rawWebhookPayload
    const savedTx = Array.from(paymentTxsDb.values())[0];
    assertDefined(savedTx);
    expect('rawWebhookPayload' in savedTx).toBeTruthy();
  });

  it('should handle partial payment: mark PARTIALLY_PAID, do NOT commit stock', async () => {
    const result = await matcher.reconcileTransaction({
      workspaceId: wsId,
      orderId,
      amount: 200000, // 200k / 500k
      gateway: PaymentGateway.SEPAY,
      transactionCode: 'SEPAY_TX_PARTIAL',
      accountNumber: '0987654321',
      transferContent: 'ORD 1004 dat coc',
    });

    expect(result.processed).toBe(true);
    expect(result.status).toBe('PARTIALLY_PAID');
    expect(result.stockCommitted).toBe(false);
    expect(result.totalPaid).toBe(200000);
    expect(result.remainingAmount).toBe(300000);

    const updatedOrder = ordersDb.get(orderId);
    expect(updatedOrder.status).toBe(OrderStatus.CONFIRMED);
    expect(updatedOrder.paymentStatus).toBe(PaymentStatus.PARTIALLY_PAID);

    // No COMMIT_SALE should be recorded
    expect(inventoryTxsDb.length).toBe(0);

    const partialPaidEvent = emittedEvents.find(e => e.event === DomainEvent.ORDER_PARTIALLY_PAID);
    assertDefined(partialPaidEvent);
    expect(partialPaidEvent.payload.paidAmount).toBe(200000);
    expect(partialPaidEvent.payload.remainingAmount).toBe(300000);
  });

  it('should prevent duplicate stock deduction when order is already PAID (second payment)', async () => {
    // Setup order as already PAID
    const ord = ordersDb.get(orderId);
    ord.status = OrderStatus.PAID;
    ord.paymentStatus = PaymentStatus.PAID;
    ord.paidAmount = 500000;

    const result = await matcher.reconcileTransaction({
      workspaceId: wsId,
      orderId,
      amount: 100000, // Customer transferred 100k extra
      gateway: PaymentGateway.SEPAY,
      transactionCode: 'SEPAY_TX_EXTRA',
      accountNumber: '0987654321',
      transferContent: 'ORD 1004 chuyen them',
    });

    expect(result.processed).toBe(true);
    expect(result.status).toBe('OVERPAID');
    expect(result.stockCommitted).toBe(false); // ABSOLUTELY NO DUPLICATE STOCK DEDUCTION
    expect(result.totalPaid).toBe(600000);

    // Inventory should NOT have any commit sale recorded
    expect(inventoryTxsDb.length).toBe(0);

    const orderPaidEvent = emittedEvents.find(e => e.event === DomainEvent.ORDER_PAID);
    assertDefined(orderPaidEvent);
    expect(orderPaidEvent.payload.isOverpaid).toBe(true);
    expect(orderPaidEvent.payload.overpaidAmount).toBe(100000);
  });

  it('should NOT revive CANCELLED orders to PAID and NOT deduct stock', async () => {
    const ord = ordersDb.get(orderId);
    ord.status = OrderStatus.CANCELLED;

    const result = await matcher.reconcileTransaction({
      workspaceId: wsId,
      orderId,
      amount: 500000,
      gateway: PaymentGateway.SEPAY,
      transactionCode: 'SEPAY_TX_CANCELLED_ORDER',
      accountNumber: '0987654321',
      transferContent: 'ORD 1004',
    });

    expect(result.processed).toBe(true);
    expect(result.status).toBe('CANCELLED_NEEDS_REFUND');
    expect(result.stockCommitted).toBe(false);

    // Order status MUST remain CANCELLED
    expect(ord.status).toBe(OrderStatus.CANCELLED);
    // No stock deduction
    expect(inventoryTxsDb.length).toBe(0);
  });

  it('should NOT regress status or touch stock when reconciling SHIPPING order', async () => {
    const ord = ordersDb.get(orderId);
    ord.status = OrderStatus.SHIPPING;
    ord.paymentStatus = PaymentStatus.UNPAID;
    ord.paidAmount = 0;

    const result = await matcher.reconcileTransaction({
      workspaceId: wsId,
      orderId,
      amount: 500000,
      gateway: PaymentGateway.SEPAY,
      transactionCode: 'SEPAY_TX_SHIPPING',
      accountNumber: '0987654321',
      transferContent: 'ORD 1004',
    });

    expect(result.processed).toBe(true);
    expect(result.status).toBe('PAID');
    expect(result.stockCommitted).toBe(false);
    expect(result.totalPaid).toBe(500000);

    // Order status MUST remain SHIPPING, NOT regress to PAID
    expect(ord.status).toBe(OrderStatus.SHIPPING);
    expect(ord.paymentStatus).toBe(PaymentStatus.PAID);
    expect(ord.paidAmount).toBe(500000);

    // No double stock deduction
    expect(inventoryTxsDb.length).toBe(0);

    // Domain event ORDER_PAID should be emitted
    const orderPaidEvent = emittedEvents.find(e => e.event === DomainEvent.ORDER_PAID);
    assertDefined(orderPaidEvent);
    expect(orderPaidEvent.payload.orderId).toBe(orderId);
  });

  it('should NOT regress status or touch stock when reconciling COMPLETED order', async () => {
    const ord = ordersDb.get(orderId);
    ord.status = OrderStatus.COMPLETED;
    ord.paymentStatus = PaymentStatus.UNPAID;
    ord.paidAmount = 0;

    const result = await matcher.reconcileTransaction({
      workspaceId: wsId,
      orderId,
      amount: 500000,
      gateway: PaymentGateway.SEPAY,
      transactionCode: 'SEPAY_TX_COMPLETED',
      accountNumber: '0987654321',
      transferContent: 'ORD 1004',
    });

    expect(result.processed).toBe(true);
    expect(result.status).toBe('PAID');
    expect(result.stockCommitted).toBe(false);
    expect(result.totalPaid).toBe(500000);

    // Order status MUST remain COMPLETED
    expect(ord.status).toBe(OrderStatus.COMPLETED);
    expect(ord.paymentStatus).toBe(PaymentStatus.PAID);
    expect(ord.paidAmount).toBe(500000);

    // No double stock deduction
    expect(inventoryTxsDb.length).toBe(0);
  });

  it('should return DUPLICATE if transaction has already been reconciled (Idempotency)', async () => {
    // First transaction
    await matcher.reconcileTransaction({
      workspaceId: wsId,
      orderId,
      amount: 500000,
      gateway: PaymentGateway.SEPAY,
      transactionCode: 'TX_IDEMPOTENT_1',
      accountNumber: '0987654321',
      transferContent: 'ORD 1004',
    });

    // Second transaction with same idempotency key
    const duplicateResult = await matcher.reconcileTransaction({
      workspaceId: wsId,
      orderId,
      amount: 500000,
      gateway: PaymentGateway.SEPAY,
      transactionCode: 'TX_IDEMPOTENT_1',
      accountNumber: '0987654321',
      transferContent: 'ORD 1004',
    });

    expect(duplicateResult.processed).toBe(false);
    expect(duplicateResult.status).toBe('DUPLICATE');
  });

  it('should catch Prisma P2002 error on paymentTransaction.create and return DUPLICATE gracefully', async () => {
    // Simulate concurrent insert race where findFirst did not find it,
    // but paymentTransaction.create throws P2002
    jest.spyOn(clientMock.paymentTransaction, 'create').mockImplementationOnce(async () => {
      const error = new Error(
        'Unique constraint failed on fields: (`workspaceId`,`idempotencyKey`)',
      );
      (error as any).code = 'P2002';
      throw error;
    });

    const duplicateResult = await matcher.reconcileTransaction({
      workspaceId: wsId,
      orderId,
      amount: 500000,
      gateway: PaymentGateway.SEPAY,
      transactionCode: 'TX_RACE_CONDITION_P2002',
      accountNumber: '0987654321',
      transferContent: 'ORD 1004',
    });

    expect(duplicateResult.processed).toBe(false);
    expect(duplicateResult.status).toBe('DUPLICATE');
    expect(duplicateResult.orderId).toBe(orderId);
  });

  it('should throw BadRequestException if amount is less than or equal to zero', async () => {
    await expectReject(
      async () => {
        await matcher.reconcileTransaction({
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
        expect(err.name).toBe('BadRequestException');
        expect(err.response?.code).toBe('INVALID_PAYMENT_AMOUNT');
        return true;
      },
    );
  });
});
