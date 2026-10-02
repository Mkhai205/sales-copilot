/**
 * Jest setupFiles hook — runs BEFORE test files are imported.
 *
 * ConfigModule.forRoot() executes when app.module.ts is imported (i.e. while
 * the spec file's import statements evaluate), and its validate() result
 * freezes the environment the whole app will see. Isolating the e2e app from
 * development data therefore has to happen here, at import time:
 *
 *  - Postgres: sales_copilot_dev -> sales_copilot_test
 *  - Redis:    logical DB 1 (queues/presence/sessions away from the dev server)
 *  - MinIO:    dedicated sales-copilot-test bucket (auto-created by the app)
 */
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for e2e tests (loaded via --env-file)');
}

const testDbUrl = databaseUrl.replace('/sales_copilot_dev', '/sales_copilot_test');
if (testDbUrl === databaseUrl || !testDbUrl.includes('/sales_copilot_test')) {
  throw new Error(
    `E2E tests must target sales_copilot_test. DATABASE_URL (${databaseUrl.replace(
      /:\/\/([^:]+):[^@]+@/,
      '://$1:***@',
    )}) is not derivable — refusing to run against development data.`,
  );
}

process.env.DATABASE_URL = testDbUrl;
if (process.env.REDIS_URL) {
  process.env.REDIS_URL = `${process.env.REDIS_URL.replace(/\/\d+$/, '')}/1`;
}
process.env.STORAGE_BUCKETS = 'sales-copilot-test';
process.env.NODE_ENV = 'test';
if (!process.env.LOG_LEVEL) {
  process.env.LOG_LEVEL = 'warn';
}
