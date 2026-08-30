import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from './generated/client';

let pool: Pool | null = null;
let prismaClient: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prismaClient) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not defined.');
    }
    pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    prismaClient = new PrismaClient({ adapter });
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
