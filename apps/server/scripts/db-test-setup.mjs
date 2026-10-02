/**
 * Ensures the dedicated test database exists and is fully migrated.
 *
 * Integration and e2e suites must never touch sales_copilot_dev (real
 * development data) — they all derive sales_copilot_test from DATABASE_URL,
 * so this single setup covers both. Run via `pnpm db:test:setup`; the nx
 * test:integration / test:e2e / test:all targets invoke it automatically.
 */
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Client } from 'pg';

// Works from any invocation cwd (nx targets pass --env-file; standalone runs find apps/server/.env)
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

function redact(url) {
  return url?.replace(/:\/\/([^:]+):[^@]+@/, '://$1:***@');
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required (loaded from apps/server/.env or the environment)');
  process.exit(1);
}

const testDbUrl = databaseUrl.replace('/sales_copilot_dev', '/sales_copilot_test');
if (testDbUrl === databaseUrl || !testDbUrl.includes('/sales_copilot_test')) {
  console.error(
    `Refusing to continue: DATABASE_URL (${redact(databaseUrl)}) does not point at ` +
      'sales_copilot_dev, so the test database cannot be derived safely.',
  );
  process.exit(1);
}

const dbName = new URL(testDbUrl).pathname.slice(1);
const adminUrl = new URL(testDbUrl);
adminUrl.pathname = '/postgres';

const admin = new Client({ connectionString: adminUrl.toString() });
await admin.connect();
try {
  const existing = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (existing.rowCount === 0) {
    await admin.query(`CREATE DATABASE "${dbName}"`);
    console.log(`Created database '${dbName}'`);
  } else {
    console.log(`Database '${dbName}' already exists`);
  }
} finally {
  await admin.end();
}

execSync('npx prisma migrate deploy', {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  env: { ...process.env, DATABASE_URL: testDbUrl },
  stdio: 'inherit',
});
console.log(`'${dbName}' is up to date with migrations.`);
