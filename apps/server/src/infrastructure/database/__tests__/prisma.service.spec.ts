import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
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
      assert.ok(ctx.id.startsWith('tx_'));
      assert.strictEqual((ctx.tx as any).isMockTx, true);

      // Verify ambient client inside transaction returns the transaction client
      assert.strictEqual((prismaService.client as any).isMockTx, true);

      ctx.addPostCommitHook(async () => {
        postHookExecuted = true;
      });

      return { success: true };
    });

    assert.deepStrictEqual(result, { success: true });
    assert.strictEqual(
      postHookExecuted,
      true,
      'Post-commit hook should be executed after successful transaction',
    );
  });

  it('should rollback and run rollback hooks if transaction operation throws an error', async () => {
    let postHookExecuted = false;
    let rollbackHookExecuted = false;
    let capturedError: unknown = null;

    await assert.rejects(
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

    assert.strictEqual(postHookExecuted, false, 'Post-commit hook must NOT run on rollback');
    assert.strictEqual(rollbackHookExecuted, true, 'Rollback hook must run on error');
    assert.strictEqual((capturedError as Error)?.message, 'Database constraint violation');
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
        assert.strictEqual(
          innerCtx.id,
          outerCtx.id,
          'Inner context must equal outer context (joined transaction)',
        );
      });

      executionTrace.push(`outer_end_${outerCtx.id}`);
    });

    assert.strictEqual(rootTransactionCount, 1, 'Only one root $transaction should be created');
    assert.strictEqual(executionTrace.length, 3);
  });

  it('should perform ping healthcheck successfully', async () => {
    const health = await prismaService.ping();
    assert.strictEqual(health.status, 'up');
    assert.ok(typeof health.latencyMs === 'number');
  });

  it('should report status down when ping fails', async () => {
    mockPrismaClient.$queryRaw = async () => {
      throw new Error('Connection refused');
    };

    const health = await prismaService.ping();
    assert.strictEqual(health.status, 'down');
    assert.strictEqual(health.error, 'Connection refused');
  });
});
