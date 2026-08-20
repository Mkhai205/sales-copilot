import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { PrismaClient } from '../../generated/client';
import { PrismaTransactionManager } from '../prisma-transaction-manager';

describe('PrismaTransactionManager', () => {
  it('should execute operation inside transaction and run post-commit hooks on success', async () => {
    let transactionStarted = false;
    let postHookExecuted = false;

    const mockPrisma = {
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
        transactionStarted = true;
        const mockTxClient = { isMockTx: true };
        return fn(mockTxClient);
      },
    } as unknown as PrismaClient;

    const txManager = new PrismaTransactionManager(mockPrisma);

    const result = await txManager.runInTransaction(async ctx => {
      assert.strictEqual(transactionStarted, true);
      assert.ok(ctx.id.startsWith('tx_'));

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

    const mockPrisma = {
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
        const mockTxClient = { isMockTx: true };
        return fn(mockTxClient);
      },
    } as unknown as PrismaClient;

    const txManager = new PrismaTransactionManager(mockPrisma);

    await assert.rejects(
      async () => {
        await txManager.runInTransaction(async ctx => {
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

    const mockPrisma = {
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
        rootTransactionCount++;
        const mockTxClient = { id: `tx_client_${rootTransactionCount}` };
        return fn(mockTxClient);
      },
    } as unknown as PrismaClient;

    const txManager = new PrismaTransactionManager(mockPrisma);

    await txManager.runInTransaction(async outerCtx => {
      executionTrace.push(`outer_start_${outerCtx.id}`);

      // Nested transaction invocation
      await txManager.runInTransaction(async innerCtx => {
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
});
