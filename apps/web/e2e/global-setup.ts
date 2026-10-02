import fs from 'node:fs';
import path from 'node:path';
import { request, type FullConfig } from '@playwright/test';

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:8000/api/v1';
const STATE_PATH = path.join(__dirname, '.auth', 'admin.json');

const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'SalesCopilot@2026!';

/**
 * Logs the seeded admin in through the API once and stores the httpOnly
 * cookies as Playwright storage state, so every spec starts authenticated.
 */
export default async function globalSetup(_config: FullConfig): Promise<void> {
  const context = await request.newContext({ baseURL: API_BASE });

  let response;
  try {
    // Absolute URL on purpose: URL joining with a path-absolute '/auth/login'
    // would drop the /api/v1 prefix from the base URL
    response = await context.post(`${API_BASE}/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
  } catch (err) {
    throw new Error(
      `Cannot reach the API at ${API_BASE} — start the dev stack first (pnpm serve:server + pnpm serve:web). Original error: ${(err as Error).message}`,
      { cause: err },
    );
  }

  if (!response.ok()) {
    throw new Error(
      `Login for the seeded admin account failed (${response.status()}): ${await response.text()}. Is the dev database seeded (pnpm db:seed)?`,
    );
  }

  const body = await response.json();
  const tokens = body?.data?.tokens;
  if (!tokens?.accessToken) {
    throw new Error(`Unexpected login response shape: ${JSON.stringify(body).slice(0, 300)}`);
  }

  const state = {
    cookies: [
      {
        name: 'access_token',
        value: tokens.accessToken as string,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
        expires: -1,
      },
      {
        name: 'refresh_token',
        value: tokens.refreshToken as string,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
        expires: -1,
      },
    ],
    origins: [] as unknown[],
  };

  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));

  await context.dispose();
}
