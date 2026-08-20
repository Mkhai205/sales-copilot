import { PrismaClient } from './generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool, PoolConfig } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

export interface DatabasePoolConfig {
  connectionString?: string;
  max?: number;
  min?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

let pool: Pool | null = null;
let prismaClient: PrismaClient | null = null;

export function getDatabasePool(customConfig?: DatabasePoolConfig): Pool {
  if (!pool) {
    const connectionString = customConfig?.connectionString;

    const poolConfig: PoolConfig = {
      connectionString,
      max: customConfig?.max ?? parseInt(process.env.DATABASE_POOL_MAX || '10', 10),
      min: customConfig?.min ?? parseInt(process.env.DATABASE_POOL_MIN || '2', 10),
      idleTimeoutMillis:
        customConfig?.idleTimeoutMillis ??
        parseInt(process.env.DATABASE_POOL_IDLE_TIMEOUT_MS || '30000', 10),
      connectionTimeoutMillis:
        customConfig?.connectionTimeoutMillis ??
        parseInt(process.env.DATABASE_POOL_CONNECTION_TIMEOUT_MS || '5000', 10),
    };

    pool = new Pool(poolConfig);

    pool.on('error', err => {
      console.error('Unexpected error on idle PostgreSQL client pool', err);
    });
  }

  return pool;
}

export function createPrismaClient(
  customPool?: Pool,
  options?: { isDevelopment?: boolean },
): PrismaClient {
  const activePool = customPool || getDatabasePool();
  const adapter = new PrismaPg(activePool);

  const isDev = options?.isDevelopment ?? process.env.NODE_ENV !== 'production';

  return new PrismaClient({
    adapter,
    log: isDev
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'stdout', level: 'error' },
          { emit: 'stdout', level: 'warn' },
        ]
      : [{ emit: 'stdout', level: 'error' }],
  });
}

export function getPrismaClient(): PrismaClient {
  if (!prismaClient) {
    prismaClient = createPrismaClient();
  }
  return prismaClient;
}

export async function closeDatabaseConnections(): Promise<void> {
  if (prismaClient) {
    await prismaClient.$disconnect();
    prismaClient = null;
  }
  if (pool) {
    await pool.end();
    pool = null;
  }
}
