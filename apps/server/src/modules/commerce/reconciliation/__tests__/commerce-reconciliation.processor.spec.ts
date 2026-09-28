import { OrderStatus } from '@sales-copilot/shared-contracts';
import {
  parseOrderDisplayId,
  parseOrderNumber,
  CommerceReconciliationProcessor,
} from '../commerce-reconciliation.processor';

describe('CommerceReconciliation Processor', () => {
  describe('Memo Regex Parser (parseOrderDisplayId & parseOrderNumber)', () => {
    it('should parse display ID from various memo formats', () => {
      expect(parseOrderDisplayId('ORD 1004')).toBe(1004);
      expect(parseOrderDisplayId('ORD-1004')).toBe(1004);
      expect(parseOrderDisplayId('ORD_1004')).toBe(1004);
      expect(parseOrderDisplayId('ORD1004')).toBe(1004);
      expect(parseOrderDisplayId('DH 2025 chuyen khoan')).toBe(2025);
      expect(parseOrderDisplayId('DH-2025-tien-hang')).toBe(2025);
      expect(parseOrderDisplayId('SO 3001')).toBe(3001);
      expect(parseOrderDisplayId('Nguyen Van A CK SO_5555')).toBe(5555);
      expect(parseOrderDisplayId('SEVQR ORD 1004')).toBe(1004);
      expect(parseOrderDisplayId('SEVQR ORD-1004')).toBe(1004);
      expect(parseOrderDisplayId('SEVQR 1004')).toBe(1004);
      expect(parseOrderDisplayId('SEVQR ORD-20260909-1004')).toBe(1004);
    });

    it('should correctly parse display ID from full order numbers containing date prefix', () => {
      expect(parseOrderDisplayId('ORD-20260909-1004')).toBe(1004);
      expect(parseOrderDisplayId('ORD 20260909 1004')).toBe(1004);
      expect(parseOrderDisplayId('ORD_20260909_1004')).toBe(1004);
      expect(parseOrderDisplayId('DH-20260909-2025')).toBe(2025);
    });

    it('should extract full order number with parseOrderNumber', () => {
      expect(parseOrderNumber('ORD-20260909-1004 thanh toan')).toBe('ORD-20260909-1004');
      expect(parseOrderNumber('Chuyen tien ORD-20260909-1004')).toBe('ORD-20260909-1004');
      expect(parseOrderNumber('No order number here')).toBe(null);
    });

    it('should return null for memos without order reference', () => {
      expect(parseOrderDisplayId('Chuyen tien ban than')).toBe(null);
      expect(parseOrderDisplayId('')).toBe(null);
      expect(parseOrderDisplayId('TK 123456')).toBe(null);
    });
  });

  describe('CommerceReconciliationProcessor', () => {
    let processor: CommerceReconciliationProcessor;
    let mockPrismaService: any;
    let mockRedisService: any;
    let mockMatcher: any;
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
          paymentTransaction: {
            findFirst: async () => null,
            create: async ({ data }: any) => ({
              id: 'pending-tx-id',
              createdAt: new Date(),
              ...data,
            }),
          },
        }),
      };

      mockRedisService = {
        acquireLock: async (key: string, _ttl: number) => {
          acquiredLocks.push(key);
          return 'mock-token-uuid';
        },
        releaseLock: async (key: string, _token: string) => {
          releasedLocks.push(key);
          return true;
        },
      };

      // AutoReconciliationMatcher mock shape: the processor only calls reconcileTransaction
      mockMatcher = {
        reconcileTransaction: async (params: any) => ({
          processed: true,
          status: 'PAID',
          orderId: params.orderId,
          displayId: 1004,
          stockCommitted: true,
        }),
      };

      const mockEventEmitter = {
        emit: jest.fn(),
      };

      processor = new CommerceReconciliationProcessor(
        mockPrismaService,
        mockRedisService,
        mockMatcher,
        mockEventEmitter as any,
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

      expect(result.processed).toBe(true);
      expect(result.status).toBe('PAID');

      // Verify Redlock was acquired and released with correct lock key
      const expectedLockKey = `ws:${wsId}:order:${orderId}:payment`;
      expect(acquiredLocks.length).toBe(1);
      expect(acquiredLocks[0]).toBe(expectedLockKey);
      expect(releasedLocks.length).toBe(1);
      expect(releasedLocks[0]).toBe(expectedLockKey);
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
      expect(result.status).toBe('UNMATCHED_MEMO');
      expect(acquiredLocks.length).toBe(0);
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

      expect(result.processed).toBe(true);
      expect(result.status).toBe('PAID');
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
      expect(result.status).toBe('INVALID_AMOUNT');
      expect(acquiredLocks.length).toBe(0);
    });
  });
});
