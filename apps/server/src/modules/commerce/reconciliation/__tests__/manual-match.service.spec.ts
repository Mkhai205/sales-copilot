import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  DomainEvent,
  OrderStatus,
  PaymentGateway,
  PaymentMethod,
  PaymentStatus,
  PaymentTransactionStatus,
} from '@sales-copilot/shared-contracts';
import { ManualMatchService } from '../manual-match.service';

describe('ManualMatchService', () => {
  let service: ManualMatchService;

  const wsId = 'ws-test-uuid';
  const userId = 'user-owner-uuid';

  let paymentTransactionsDb: Map<string, any>;
  let ordersDb: Map<string, any>;
  let auditLogsDb: any[];
  let emittedEvents: Array<{ event: string; payload: any }>;
  let mockStockMovementService: { commitStock: jest.Mock };

  beforeEach(async () => {
    paymentTransactionsDb = new Map();
    ordersDb = new Map();
    auditLogsDb = [];
    emittedEvents = [];

    const mockPrismaService = {
      getClient: () => ({
        paymentTransaction: {
          findFirst: async ({ where }: any) => {
            for (const tx of paymentTransactionsDb.values()) {
              if (where.id && tx.id !== where.id) continue;
              if (where.workspaceId && tx.workspaceId !== where.workspaceId) continue;
              if (where.idempotencyKey && tx.idempotencyKey !== where.idempotencyKey) continue;
              return tx;
            }
            return null;
          },
          update: async ({ where, data }: any) => {
            const tx = paymentTransactionsDb.get(where.id);
            if (!tx) throw new Error('Transaction not found');
            const updated = { ...tx, ...data };
            paymentTransactionsDb.set(where.id, updated);
            return updated;
          },
        },
        order: {
          findFirst: async ({ where }: any) => {
            for (const order of ordersDb.values()) {
              if (where.id && order.id !== where.id) continue;
              if (where.workspaceId && order.workspaceId !== where.workspaceId) continue;
              return order;
            }
            return null;
          },
          updateMany: async ({ where, data }: any) => {
            let count = 0;
            for (const [id, order] of ordersDb.entries()) {
              if (where.id && order.id !== where.id) continue;
              if (where.workspaceId && order.workspaceId !== where.workspaceId) continue;
              ordersDb.set(id, { ...order, ...data });
              count++;
            }
            return { count };
          },
        },
        auditLog: {
          create: async ({ data }: any) => {
            auditLogsDb.push(data);
            return { id: 'audit-log-uuid', ...data };
          },
        },
      }),
      runInTransaction: async (cb: any) => {
        const postCommitHooks: Array<() => void> = [];
        const ctx = {
          tx: mockPrismaService.getClient(),
          addPostCommitHook: (fn: () => void) => postCommitHooks.push(fn),
        };
        const res = await cb(ctx);
        for (const hook of postCommitHooks) {
          hook();
        }
        return res;
      },
    };

    const mockEventEmitter = {
      emit: (event: string, payload: any) => {
        emittedEvents.push({ event, payload });
      },
    };

    mockStockMovementService = {
      commitStock: jest.fn().mockResolvedValue({ success: true }),
    };

    const mockRedisService = {
      acquireLock: jest.fn().mockResolvedValue('lock-token-123'),
      releaseLock: jest.fn().mockResolvedValue(true),
    };

    service = new ManualMatchService(
      mockPrismaService as any,
      mockEventEmitter as any,
      mockStockMovementService as any,
      mockRedisService as any,
    );
  });

  it('should successfully match a PENDING transaction to an unpaid Order, advance status to PAID, and record AuditLog', async () => {
    const orderId = 'order-test-uuid';
    ordersDb.set(orderId, {
      id: orderId,
      workspaceId: wsId,
      displayId: 1005,
      orderNumber: 'ORD-20260921-1005',
      status: OrderStatus.CONFIRMED,
      paymentStatus: PaymentStatus.UNPAID,
      totalAmount: 300000,
      paidAmount: 0,
      items: [
        {
          variantId: 'var-1',
          quantity: 2,
          productName: 'T-Shirt',
          variantName: 'XL',
          sku: 'TSHIRT-XL',
        },
      ],
    });

    const txId = 'tx-pending-uuid';
    paymentTransactionsDb.set(txId, {
      id: txId,
      workspaceId: wsId,
      orderId: null,
      paymentMethod: PaymentMethod.VIETQR,
      gateway: PaymentGateway.SEPAY,
      amount: 300000,
      currency: 'VND',
      status: PaymentTransactionStatus.PENDING,
      transactionCode: 'BANK_TX_9876',
      transferContent: 'Thanh toan tien ao',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const matchRes = await service.manualMatchTransaction(wsId, txId, { orderId }, userId);

    expect(matchRes.success).toBe(true);
    expect(matchRes.transaction.status).toBe(PaymentTransactionStatus.SUCCESS);
    expect(matchRes.transaction.orderId).toBe(orderId);

    // Verify Order was updated to PAID
    const updatedOrder = ordersDb.get(orderId);
    expect(updatedOrder.paymentStatus).toBe(PaymentStatus.PAID);
    expect(updatedOrder.status).toBe(OrderStatus.PAID);
    expect(updatedOrder.paidAmount).toBe(300000);

    // Verify AuditLog created
    expect(auditLogsDb.length).toBe(1);
    expect(auditLogsDb[0].action).toBe('PAYMENT_MANUAL_MATCH');
    expect(auditLogsDb[0].userId).toBe(userId);
    expect(auditLogsDb[0].resourceId).toBe(txId);

    // Verify events emitted
    const paidEvent = emittedEvents.find(e => e.event === DomainEvent.ORDER_PAID);
    const txUpdatedEvent = emittedEvents.find(
      e => e.event === DomainEvent.PAYMENT_TRANSACTION_UPDATED,
    );
    expect(paidEvent).toBeDefined();
    expect(txUpdatedEvent).toBeDefined();

    // Stock committed exactly once with the order items (order was CONFIRMED -> reservation path)
    expect(mockStockMovementService.commitStock).toHaveBeenCalledTimes(1);
    expect(mockStockMovementService.commitStock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: wsId,
        orderId,
        isPreviouslyReserved: true,
      }),
    );
  });

  it('should throw BadRequestException if transaction is already SUCCESS', async () => {
    const txId = 'tx-success-uuid';
    paymentTransactionsDb.set(txId, {
      id: txId,
      workspaceId: wsId,
      status: PaymentTransactionStatus.SUCCESS,
    });

    await expect(
      service.manualMatchTransaction(wsId, txId, { orderId: 'some-order' }, userId),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException if order is CANCELLED', async () => {
    const orderId = 'order-cancelled-uuid';
    ordersDb.set(orderId, {
      id: orderId,
      workspaceId: wsId,
      displayId: 1006,
      status: OrderStatus.CANCELLED,
      paymentStatus: PaymentStatus.UNPAID,
      totalAmount: 100000,
      paidAmount: 0,
    });

    const txId = 'tx-pending-2';
    paymentTransactionsDb.set(txId, {
      id: txId,
      workspaceId: wsId,
      status: PaymentTransactionStatus.PENDING,
      amount: 100000,
    });

    await expect(service.manualMatchTransaction(wsId, txId, { orderId }, userId)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw NotFoundException if transaction does not exist', async () => {
    await expect(
      service.manualMatchTransaction(wsId, 'non-existent-tx', { orderId: 'some-order' }, userId),
    ).rejects.toThrow(NotFoundException);
  });

  // M4.4 C2 guard: matching a payment into an order already in fulfillment/completed
  // must record the payment WITHOUT re-committing stock and WITHOUT regressing status.
  it('should record payment without stock commit or status regression when order is COMPLETED (C2)', async () => {
    const orderId = 'order-completed-uuid';
    ordersDb.set(orderId, {
      id: orderId,
      workspaceId: wsId,
      displayId: 1007,
      status: OrderStatus.COMPLETED,
      paymentStatus: PaymentStatus.UNPAID,
      totalAmount: 300000,
      paidAmount: 0,
      items: [
        {
          variantId: 'var-1',
          quantity: 2,
          productName: 'T-Shirt',
          variantName: 'XL',
          sku: 'TSHIRT-XL',
        },
      ],
    });

    const txId = 'tx-pending-completed';
    paymentTransactionsDb.set(txId, {
      id: txId,
      workspaceId: wsId,
      status: PaymentTransactionStatus.PENDING,
      amount: 300000,
    });

    const matchRes = await service.manualMatchTransaction(wsId, txId, { orderId }, userId);

    // Payment recorded
    expect(matchRes.transaction.status).toBe(PaymentTransactionStatus.SUCCESS);
    const updatedOrder = ordersDb.get(orderId);
    expect(updatedOrder.paidAmount).toBe(300000);
    expect(updatedOrder.paymentStatus).toBe(PaymentStatus.PAID);
    // Status NOT regressed COMPLETED -> PAID
    expect(updatedOrder.status).toBe(OrderStatus.COMPLETED);
    // Stock NOT committed a second time
    expect(mockStockMovementService.commitStock).not.toHaveBeenCalled();
  });

  it('should record payment without stock commit or status regression when order is SHIPPING (C2)', async () => {
    const orderId = 'order-shipping-uuid';
    ordersDb.set(orderId, {
      id: orderId,
      workspaceId: wsId,
      displayId: 1008,
      status: OrderStatus.SHIPPING,
      paymentStatus: PaymentStatus.PARTIALLY_PAID,
      totalAmount: 300000,
      paidAmount: 100000,
      items: [],
    });

    const txId = 'tx-pending-shipping';
    paymentTransactionsDb.set(txId, {
      id: txId,
      workspaceId: wsId,
      status: PaymentTransactionStatus.PENDING,
      amount: 200000,
    });

    const matchRes = await service.manualMatchTransaction(wsId, txId, { orderId }, userId);

    expect(matchRes.transaction.status).toBe(PaymentTransactionStatus.SUCCESS);
    const updatedOrder = ordersDb.get(orderId);
    expect(updatedOrder.paidAmount).toBe(300000);
    expect(updatedOrder.paymentStatus).toBe(PaymentStatus.PAID);
    expect(updatedOrder.status).toBe(OrderStatus.SHIPPING);
    expect(mockStockMovementService.commitStock).not.toHaveBeenCalled();
  });
});
