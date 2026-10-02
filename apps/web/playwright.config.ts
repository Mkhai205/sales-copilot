import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const AUTH_STATE_PATH = path.join(__dirname, 'e2e', '.auth', 'admin.json');

/**
 * UI e2e against the local dev stack:
 *   - web   → http://localhost:3000 (pnpm serve:web)
 *   - API   → http://localhost:8000 (pnpm serve:server) + seeded dev database
 *
 * The suite reuses running servers (reuseExistingServer) and logs in once via
 * the API in global-setup, storing httpOnly cookies as the shared state.
 */
export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    storageState: AUTH_STATE_PATH,
    trace: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
