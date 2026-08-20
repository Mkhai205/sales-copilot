import { AsyncLocalStorage } from 'async_hooks';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma, PrismaClient } from '../generated/client';
import {
  ITransactionContext,
  ITransactionManager,
  TransactionOptions,
} from './transaction.interface';
import { PrismaTransactionContext } from './transaction-context';

@Injectable()
export class PrismaTransactionManager implements ITransactionManager {
  private readonly logger = new Logger(PrismaTransactionManager.name);
  private readonly als = new AsyncLocalStorage<PrismaTransactionContext>();

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Retrieves the currently active ambient transaction context if present.
   */
  public getCurrentContext(): PrismaTransactionContext | undefined {
    return this.als.getStore();
  }

  /**
   * Retrieves the currently active Prisma transaction client or undefined.
   */
  public getCurrentTxClient(): Prisma.TransactionClient | undefined {
    return this.als.getStore()?.txClient;
  }

  /**
   * Executes an operation inside a database transaction with ambient context support.
   * If a transaction is already active in the current async execution tree, it joins the existing transaction.
   * Post-commit hooks are executed only after the top-level transaction commits successfully.
   */
  public async runInTransaction<T>(
    operation: (ctx: ITransactionContext) => Promise<T>,
    options?: TransactionOptions,
  ): Promise<T> {
    const existingContext = this.als.getStore();

    if (existingContext) {
      // Join existing active transaction
      this.logger.debug(`Joining active transaction context: ${existingContext.id}`);
      return operation(existingContext);
    }

    const prismaIsolationLevel = options?.isolationLevel
      ? (options.isolationLevel as Prisma.TransactionIsolationLevel)
      : undefined;

    const txOptions = {
      maxWait: options?.maxWait ?? 5000,
      timeout: options?.timeout ?? 10000,
      isolationLevel: prismaIsolationLevel,
    };

    let executedContext: PrismaTransactionContext | null = null;

    try {
      const result = await this.prisma.$transaction(async txClient => {
        const ctx = new PrismaTransactionContext(txClient);
        executedContext = ctx;

        return this.als.run(ctx, async () => {
          this.logger.debug(`Started new transaction context: ${ctx.id}`);
          return operation(ctx);
        });
      }, txOptions);

      // Transaction committed successfully -> execute post-commit hooks
      if (executedContext) {
        const postHooks = (executedContext as PrismaTransactionContext).getPostCommitHooks();
        if (postHooks.length > 0) {
          this.logger.debug(
            `Executing ${postHooks.length} post-commit hook(s) for transaction: ${(executedContext as PrismaTransactionContext).id}`,
          );
          for (const hook of postHooks) {
            try {
              await hook();
            } catch (hookError) {
              this.logger.error(
                `Error executing post-commit hook for transaction ${(executedContext as PrismaTransactionContext).id}:`,
                hookError,
              );
            }
          }
        }
      }

      return result;
    } catch (error) {
      this.logger.warn(`Transaction failed and rolled back. Error: ${(error as Error)?.message}`);

      if (executedContext) {
        const rollbackHooks = (executedContext as PrismaTransactionContext).getRollbackHooks();
        for (const hook of rollbackHooks) {
          try {
            await hook(error);
          } catch (hookError) {
            this.logger.error('Error executing rollback hook:', hookError);
          }
        }
      }

      throw error;
    }
  }
}
