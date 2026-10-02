/**
 * Integration tests never run against sales_copilot_dev — the database holding
 * real development data. This helper rewrites DATABASE_URL to the dedicated
 * sales_copilot_test database and fails fast when it cannot be derived safely.
 * `pnpm db:test:setup` (invoked by the nx test targets) creates and migrates it.
 */
export function useTestDatabase(): void {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is required for integration tests (loaded from apps/server/.env)',
    );
  }

  const testUrl = url.replace('/sales_copilot_dev', '/sales_copilot_test');
  if (testUrl === url || !testUrl.includes('/sales_copilot_test')) {
    throw new Error(
      `Integration tests must target sales_copilot_test. DATABASE_URL (${url.replace(
        /:\/\/([^:]+):[^@]+@/,
        '://$1:***@',
      )}) is not derivable — refusing to run against development data.`,
    );
  }

  process.env.DATABASE_URL = testUrl;
}
