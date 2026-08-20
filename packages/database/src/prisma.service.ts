import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { createPrismaClient, getDatabasePool } from './client';
import { PrismaTransactionManager } from './transactions/prisma-transaction-manager';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  public readonly client: PrismaClient;
  public readonly txManager: PrismaTransactionManager;

  constructor() {
    this.client = createPrismaClient();
    this.txManager = new PrismaTransactionManager(this.client);
  }

  public async onModuleInit(): Promise<void> {
    try {
      await this.client.$connect();
      this.logger.log('✅ PostgreSQL Database connected successfully via connection pool.');
    } catch (error) {
      this.logger.error('❌ Failed to connect to PostgreSQL database:', error);
      throw error;
    }
  }

  public async onModuleDestroy(): Promise<void> {
    try {
      await this.client.$disconnect();
      const pool = getDatabasePool();
      await pool.end();
      this.logger.log('Database connections and pool closed gracefully.');
    } catch (error) {
      this.logger.error('Error during database disconnection:', error);
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
