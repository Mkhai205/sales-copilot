import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool, PoolConfig } from 'pg';
import { Prisma, PrismaClient } from './generated/client';

export type PostCommitHook = () => Promise<void> | void;
export type RollbackHook = (error: unknown) => Promise<void> | void;

export type TransactionIsolationLevel =
  'ReadUncommitted' | 'ReadCommitted' | 'RepeatableRead' | 'Serializable';

export interface TransactionOptions {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: TransactionIsolationLevel;
}

/**
 * Context container for transaction-scoped state and lifecycle hooks.
 */
export class TransactionContext {
  public readonly id: string;
  private readonly postCommitHooks: PostCommitHook[] = [];
  private readonly rollbackHooks: RollbackHook[] = [];

  constructor(
    public readonly txClient: Prisma.TransactionClient,
    id?: string,
  ) {
    this.id = id || `tx_${randomUUID()}`;
  }

  /** Direct accessor for transaction client */
  public get tx(): Prisma.TransactionClient {
    return this.txClient;
  }

  public addPostCommitHook(hook: PostCommitHook): void {
    this.postCommitHooks.push(hook);
  }

  public addRollbackHook(hook: RollbackHook): void {
    this.rollbackHooks.push(hook);
  }

  public getPostCommitHooks(): PostCommitHook[] {
    return [...this.postCommitHooks];
  }

  public getRollbackHooks(): RollbackHook[] {
    return [...this.rollbackHooks];
  }
}

// Alias for backward compatibility if needed
export { TransactionContext as PrismaTransactionContext };

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly als = new AsyncLocalStorage<TransactionContext>();
  private readonly _rootClient: PrismaClient;
  private readonly pool: Pool;

  constructor(private readonly configService: ConfigService) {
    const connectionString = this.configService.getOrThrow<string>('DATABASE_URL');
    const isDevelopment = this.configService.get<string>('NODE_ENV') !== 'production';

    const poolConfig: PoolConfig = {
      connectionString,
      max: this.configService.get<number>('DATABASE_POOL_MAX', 10),
      min: this.configService.get<number>('DATABASE_POOL_MIN', 2),
      idleTimeoutMillis: this.configService.get<number>('DATABASE_POOL_IDLE_TIMEOUT_MS', 10000),
      connectionTimeoutMillis: this.configService.get<number>(
        'DATABASE_POOL_CONNECTION_TIMEOUT_MS',
        5000,
      ),
    };

    this.pool = new Pool(poolConfig);

    this.pool.on('error', err => {
      this.logger.error('Unexpected error on idle PostgreSQL client pool', err);
    });

    const adapter = new PrismaPg(this.pool);

    this._rootClient = new PrismaClient({
      adapter,
      log: isDevelopment
        ? [
            { emit: 'stdout', level: 'query' },
            { emit: 'stdout', level: 'error' },
            { emit: 'stdout', level: 'warn' },
          ]
        : [{ emit: 'stdout', level: 'error' }],
    });
  }

  public async onModuleInit(): Promise<void> {
    await this.connectWithRetry();
  }

  public async onModuleDestroy(): Promise<void> {
    try {
      await this._rootClient.$disconnect();
    } catch (error) {
      this.logger.error('Error during Prisma client disconnection:', error);
    } finally {
      try {
        await this.pool.end();
        this.logger.log('🔌 Database pool closed gracefully.');
      } catch (poolErr) {
        this.logger.error('Error during pool termination:', poolErr);
      }
    }
  }

  private async connectWithRetry(): Promise<void> {
    const maxAttempts = 5;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this._rootClient.$connect();
        this.logger.log('✅ PostgreSQL Database connected successfully via connection pool.');
        return;
      } catch (error) {
        const delay = attempt * 2000;
        this.logger.warn(
          `Prisma connect attempt ${attempt}/${maxAttempts} failed: ${(error as Error)?.message}. Retrying in ${delay}ms...`,
        );
        if (attempt === maxAttempts) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Returns either the active ambient transaction client (if within runInTransaction)
   * or the root PrismaClient. This allows all services to transparently support transactions.
   */
  public get client(): PrismaClient | Prisma.TransactionClient {
    return this.als.getStore()?.txClient ?? this._rootClient;
  }

  /**
   * Compatibility accessor for explicit getClient() calls.
   */
  public getClient(): PrismaClient | Prisma.TransactionClient {
    return this.client;
  }

  /**
   * Retrieves the currently active ambient transaction context if present.
   */
  public getCurrentContext(): TransactionContext | undefined {
    return this.als.getStore();
  }

  /**
   * Executes an operation inside a database transaction with ambient context support.
   * If a transaction is already active in the current async execution tree, it joins the existing transaction.
   * Post-commit hooks are executed only after the top-level transaction commits successfully.
   */
  public async runInTransaction<T>(
    operation: (ctx: TransactionContext) => Promise<T>,
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

    let executedContext: TransactionContext | null = null;

    try {
      const result = await this._rootClient.$transaction(async txClient => {
        const ctx = new TransactionContext(txClient);
        executedContext = ctx;

        return this.als.run(ctx, async () => {
          this.logger.debug(`Started new transaction context: ${ctx.id}`);
          return operation(ctx);
        });
      }, txOptions);

      // Transaction committed successfully -> execute post-commit hooks
      if (executedContext) {
        const postHooks = (executedContext as TransactionContext).getPostCommitHooks();
        if (postHooks.length > 0) {
          this.logger.debug(
            `Executing ${postHooks.length} post-commit hook(s) for transaction: ${(executedContext as TransactionContext).id}`,
          );
          for (const hook of postHooks) {
            try {
              await hook();
            } catch (hookError) {
              this.logger.error(
                `Error executing post-commit hook for transaction ${(executedContext as TransactionContext).id}:`,
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
        const rollbackHooks = (executedContext as TransactionContext).getRollbackHooks();
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

  /**
   * Healthcheck function to verify database connectivity and roundtrip latency.
   */
  public async ping(): Promise<{ status: 'up' | 'down'; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      await this._rootClient.$queryRaw`SELECT 1`;
      const latencyMs = Date.now() - start;
      return { status: 'up', latencyMs };
    } catch (err) {
      const latencyMs = Date.now() - start;
      return {
        status: 'down',
        latencyMs,
        error: (err as Error)?.message || 'Database unreachable',
      };
    }
  }
}
