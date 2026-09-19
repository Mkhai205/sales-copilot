import { expectReject } from '../../../../test/test-assertions';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';

describe('PrismaService (Database & Ambient Transaction Manager)', () => {
  let prismaService: PrismaService;
  let mockPrismaClient: any;
  let mockConfigService: Partial<ConfigService>;

  beforeEach(() => {
    mockConfigService = {
      getOrThrow: <T = string>(key: string): T => {
        if (key === 'DATABASE_URL')
          return 'postgresql://postgres:postgres@localhost:5432/sales_copilot' as unknown as T;
        throw new Error(`Missing config: ${key}`);
      },
      get: <T = unknown>(key: string, defaultValue?: T): T => {
        if (key === 'NODE_ENV') return 'test' as unknown as T;
        return defaultValue as T;
      },
    };

    prismaService = new PrismaService(mockConfigService as ConfigService);

    mockPrismaClient = {
      $connect: async () => {},
      $disconnect: async () => {},
      $queryRaw: async () => [{ '?column?': 1 }],
      $transaction: async (fn: (tx: any) => Promise<any>, _options?: any) => {
        const mockTx = { isMockTx: true, id: `tx_inner_${Date.now()}` };
        return fn(mockTx);
      },
    };

    (prismaService as any)._rootClient = mockPrismaClient;
  });

  it('should execute operation inside transaction and run post-commit hooks on success', async () => {
    let postHookExecuted = false;

    const result = await prismaService.runInTransaction(async ctx => {
      expect(ctx.id.startsWith('tx_')).toBeTruthy();
      expect((ctx.tx as any).isMockTx).toBe(true);

      // Verify ambient client inside transaction returns the transaction client
      expect((prismaService.client as any).isMockTx).toBe(true);

      ctx.addPostCommitHook(async () => {
        postHookExecuted = true;
      });

      return { success: true };
    });

    expect(result).toEqual({ success: true });
    expect(postHookExecuted).toBe(true);
  });

  it('should rollback and run rollback hooks if transaction operation throws an error', async () => {
    let postHookExecuted = false;
    let rollbackHookExecuted = false;
    let capturedError: unknown = null;

    await expectReject(
      async () => {
        await prismaService.runInTransaction(async ctx => {
          ctx.addPostCommitHook(() => {
            postHookExecuted = true;
          });

          ctx.addRollbackHook((err: unknown) => {
            rollbackHookExecuted = true;
            capturedError = err;
          });

          throw new Error('Database constraint violation');
        });
      },
      {
        name: 'Error',
        message: 'Database constraint violation',
      },
    );

    expect(postHookExecuted).toBe(false);
    expect(rollbackHookExecuted).toBe(true);
    expect((capturedError as Error)?.message).toBe('Database constraint violation');
  });

  it('should join existing ambient transaction when nested runInTransaction is called', async () => {
    let rootTransactionCount = 0;
    const executionTrace: string[] = [];

    (prismaService as any)._rootClient.$transaction = async (fn: (tx: any) => Promise<any>) => {
      rootTransactionCount++;
      const mockTx = { isMockTx: true, txIndex: rootTransactionCount };
      return fn(mockTx);
    };

    await prismaService.runInTransaction(async outerCtx => {
      executionTrace.push(`outer_start_${outerCtx.id}`);

      // Nested transaction invocation
      await prismaService.runInTransaction(async innerCtx => {
        executionTrace.push(`inner_${innerCtx.id}`);
        expect(innerCtx.id).toBe(outerCtx.id);
      });

      executionTrace.push(`outer_end_${outerCtx.id}`);
    });

    expect(rootTransactionCount).toBe(1);
    expect(executionTrace.length).toBe(3);
  });

  it('should perform ping healthcheck successfully', async () => {
    const health = await prismaService.ping();
    expect(health.status).toBe('up');
    expect(typeof health.latencyMs === 'number').toBeTruthy();
  });

  it('should report status down when ping fails', async () => {
    mockPrismaClient.$queryRaw = async () => {
      throw new Error('Connection refused');
    };

    const health = await prismaService.ping();
    expect(health.status).toBe('down');
    expect(health.error).toBe('Connection refused');
  });

  it('should return applied: true when migrations are present', async () => {
    mockPrismaClient.$queryRaw = async () => [{ count: 2 }];

    const result = await prismaService.checkMigrations();
    expect(result.applied).toBe(true);
    expect(result.count).toBe(2);
  });

  it('should return applied: false when migrations count is 0', async () => {
    mockPrismaClient.$queryRaw = async () => [{ count: 0 }];

    const result = await prismaService.checkMigrations();
    expect(result.applied).toBe(false);
    expect(result.count).toBe(0);
  });

  it('should return applied: false and error message when query fails', async () => {
    mockPrismaClient.$queryRaw = async () => {
      throw new Error('Table _prisma_migrations does not exist');
    };

    const result = await prismaService.checkMigrations();
    expect(result.applied).toBe(false);
    expect(result.error).toBe('Table _prisma_migrations does not exist');
  });
});
