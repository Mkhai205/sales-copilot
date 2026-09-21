import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  OrderStatus,
  PaymentGateway,
  PaymentMethod,
  PaymentStatus,
  PaymentTransactionStatus,
  PlatformRole,
} from '@sales-copilot/shared-contracts';
import { ReconciliationController } from '../reconciliation.controller';
import { PaymentReconciliationService } from '../payment-reconciliation.service';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import { InventoryLedgerService } from '../../inventory/inventory-ledger.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('ReconciliationController & Service Unit Tests', () => {
  let controller: ReconciliationController;
  let service: PaymentReconciliationService;

  const wsId = 'ws-test-uuid';
  const userId = 'user-owner-uuid';

  let paymentTransactionsDb: Map<string, any>;
  let ordersDb: Map<string, any>;
  let auditLogsDb: any[];
  let emittedEvents: Array<{ event: string; payload: any }>;

  beforeEach(async () => {
    paymentTransactionsDb = new Map();
    ordersDb = new Map();
    auditLogsDb = [];
    emittedEvents = [];

    const mockPrismaService = {
      getClient: () => ({
        paymentTransaction: {
          count: async ({ where }: any) => {
            let count = 0;
            for (const tx of paymentTransactionsDb.values()) {
              if (tx.workspaceId !== where.workspaceId) continue;
              if (where.status && tx.status !== where.status) continue;
              count++;
            }
            return count;
          },
          findMany: async ({ where, skip = 0, take = 20 }: any) => {
            const list: any[] = [];
            for (const tx of paymentTransactionsDb.values()) {
              if (tx.workspaceId !== where.workspaceId) continue;
              if (where.status && tx.status !== where.status) continue;
              const order = tx.orderId ? ordersDb.get(tx.orderId) : null;
              list.push({ ...tx, order });
            }
            return list.slice(skip, skip + take);
          },
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
          updateMany: async ({ where, data }: any) => {
            let count = 0;
            for (const [id, tx] of paymentTransactionsDb.entries()) {
              if (where.id && tx.id !== where.id) continue;
              if (where.workspaceId && tx.workspaceId !== where.workspaceId) continue;
              paymentTransactionsDb.set(id, { ...tx, ...data });
              count++;
            }
            return { count };
          },
          create: async ({ data }: any) => {
            const id = data.id || `tx-${Date.now()}-${Math.random()}`;
            const record = { id, createdAt: new Date(), updatedAt: new Date(), ...data };
            paymentTransactionsDb.set(id, record);
            return record;
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

    const mockInventoryLedgerService = {
      commitStock: jest.fn().mockResolvedValue({ success: true }),
    };

    const mockRedisService = {
      acquireLock: jest.fn().mockResolvedValue('lock-token-123'),
      releaseLock: jest.fn().mockResolvedValue(true),
    };

    service = new PaymentReconciliationService(
      mockPrismaService as any,
      mockEventEmitter as any,
      mockInventoryLedgerService as any,
      mockRedisService as any,
    );

    controller = new ReconciliationController(service);
  });

  describe('listTransactions & getStats', () => {
    it('should list transactions and compute aggregation stats correctly', async () => {
      // Seed 1 SUCCESS and 1 PENDING transaction
      paymentTransactionsDb.set('tx-1', {
        id: 'tx-1',
        workspaceId: wsId,
        orderId: 'order-1',
        paymentMethod: PaymentMethod.VIETQR,
        gateway: PaymentGateway.SEPAY,
        amount: 250000,
        currency: 'VND',
        status: PaymentTransactionStatus.SUCCESS,
        transactionCode: 'TX_111',
        transferContent: 'ORD 1001',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      paymentTransactionsDb.set('tx-2', {
        id: 'tx-2',
        workspaceId: wsId,
        orderId: null,
        paymentMethod: PaymentMethod.VIETQR,
        gateway: PaymentGateway.SEPAY,
        amount: 500000,
        currency: 'VND',
        status: PaymentTransactionStatus.PENDING,
        transactionCode: 'TX_222',
        transferContent: 'Khach chuyen tien',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Test list
      const listRes = await controller.listTransactions(
        { workspaceId: wsId } as any,
        { page: 1, limit: 20 } as any,
      );

      expect(listRes.items.length).toBe(2);
      expect(listRes.meta.total).toBe(2);

      // Test stats
      const statsRes = await controller.getStats({ workspaceId: wsId } as any, {} as any);
      expect(statsRes.reconciled.count).toBe(1);
      expect(statsRes.reconciled.totalAmount).toBe(250000);
      expect(statsRes.pending.count).toBe(1);
      expect(statsRes.pending.totalAmount).toBe(500000);
      expect(statsRes.failed.count).toBe(0);
    });
  });

  describe('manualMatch', () => {
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

      const user = { userId, email: 'owner@shop.vn', role: PlatformRole.USER };

      const matchRes = await controller.manualMatch(
        { workspaceId: wsId } as any,
        user as any,
        txId,
        { orderId },
      );

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
      const paidEvent = emittedEvents.find(e => e.event === 'order.paid');
      const txUpdatedEvent = emittedEvents.find(e => e.event === 'payment_transaction.updated');
      expect(paidEvent).toBeDefined();
      expect(txUpdatedEvent).toBeDefined();
    });

    it('should throw BadRequestException if transaction is already SUCCESS', async () => {
      const txId = 'tx-success-uuid';
      paymentTransactionsDb.set(txId, {
        id: txId,
        workspaceId: wsId,
        status: PaymentTransactionStatus.SUCCESS,
      });

      const user = { userId, email: 'owner@shop.vn', role: PlatformRole.USER };

      await expect(
        controller.manualMatch({ workspaceId: wsId } as any, user as any, txId, {
          orderId: 'some-order',
        }),
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

      const user = { userId, email: 'owner@shop.vn', role: PlatformRole.USER };

      await expect(
        controller.manualMatch({ workspaceId: wsId } as any, user as any, txId, {
          orderId,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if transaction does not exist', async () => {
      const user = { userId, email: 'owner@shop.vn', role: PlatformRole.USER };

      await expect(
        controller.manualMatch({ workspaceId: wsId } as any, user as any, 'non-existent-tx', {
          orderId: 'some-order',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
