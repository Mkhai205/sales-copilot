import {
  PaymentGateway,
  PaymentMethod,
  PaymentTransactionStatus,
} from '@sales-copilot/shared-contracts';
import { ReconciliationQueryService } from '../reconciliation-query.service';

describe('ReconciliationQueryService', () => {
  let service: ReconciliationQueryService;

  const wsId = 'ws-test-uuid';

  let paymentTransactionsDb: Map<string, any>;
  let ordersDb: Map<string, any>;

  beforeEach(async () => {
    paymentTransactionsDb = new Map();
    ordersDb = new Map();

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
        },
      }),
    };

    service = new ReconciliationQueryService(mockPrismaService as any);
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
      const listRes = await service.listTransactions(wsId, { page: 1, limit: 20 } as any);

      expect(listRes.items.length).toBe(2);
      expect(listRes.meta.total).toBe(2);

      // Test stats
      const statsRes = await service.getStats(wsId, {} as any);
      expect(statsRes.reconciled.count).toBe(1);
      expect(statsRes.reconciled.totalAmount).toBe(250000);
      expect(statsRes.pending.count).toBe(1);
      expect(statsRes.pending.totalAmount).toBe(500000);
      expect(statsRes.failed.count).toBe(0);
    });
  });
});
