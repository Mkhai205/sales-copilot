import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { Prisma, PrismaClient } from './generated/client';
import { createPrismaClient, getDatabasePool } from './client';
import { PrismaTransactionManager } from './transactions/prisma-transaction-manager';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  public readonly client: PrismaClient;
  public readonly txManager: PrismaTransactionManager;
  private readonly pool: Pool;

  constructor(@Optional() private readonly configService?: ConfigService) {
    const connectionString =
      this.configService?.get<string>('DATABASE_URL') || process.env.DATABASE_URL;
    const isDevelopment =
      (this.configService?.get<string>('NODE_ENV') || process.env.NODE_ENV) !== 'production';

    this.pool = getDatabasePool({
      connectionString,
      max: this.configService?.get<number>('DATABASE_POOL_MAX'),
      min: this.configService?.get<number>('DATABASE_POOL_MIN'),
      idleTimeoutMillis: this.configService?.get<number>('DATABASE_POOL_IDLE_TIMEOUT_MS'),
      connectionTimeoutMillis: this.configService?.get<number>(
        'DATABASE_POOL_CONNECTION_TIMEOUT_MS',
      ),
    });

    this.client = createPrismaClient(this.pool, { isDevelopment });
    this.txManager = new PrismaTransactionManager(this.client);
  }

  public async onModuleInit(): Promise<void> {
    await this.connectWithRetry();
  }

  public async onModuleDestroy(): Promise<void> {
    try {
      await this.client.$disconnect();
      await this.pool.end();
      this.logger.log('🔌 Database connections and pool closed gracefully.');
    } catch (error) {
      this.logger.error('Error during database disconnection:', error);
    }
  }

  private async connectWithRetry(): Promise<void> {
    const maxAttempts = 5;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.client.$connect();
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
   * or the root PrismaClient. This allows repositories to transparently support transactions.
   */
  public getClient(): PrismaClient | Prisma.TransactionClient {
    const ambientTx = this.txManager.getCurrentTxClient();
    return ambientTx || this.client;
  }

  /**
   * Healthcheck function to verify database connectivity.
   */
  public async ping(): Promise<{ status: 'up' | 'down'; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      await this.client.$queryRaw`SELECT 1`;
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
