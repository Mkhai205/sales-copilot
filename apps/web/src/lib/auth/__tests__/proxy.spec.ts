import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert';
import { NextRequest } from 'next/server';
import { proxy } from '../../../proxy';

function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.mockSignature`;
}

describe('Next.js Edge Proxy — /admin Protection & Security (apps/web/src/proxy.ts)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Reset fetch
    global.fetch = originalFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should allow public routes to pass through unconditionally', async () => {
    const req = new NextRequest('http://localhost:3000/login');
    const res = await proxy(req);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('location'), null);
  });

  it('should redirect unauthenticated user from /admin to /login with redirect parameter', async () => {
    const req = new NextRequest('http://localhost:3000/admin');
    const res = await proxy(req);
    assert.strictEqual(res.status, 307);
    const location = res.headers.get('location');
    assert.ok(location?.includes('/login?redirect=%2Fadmin'));
  });

  it('should preserve query parameters in redirect when accessing /admin/workspaces?page=2', async () => {
    const req = new NextRequest('http://localhost:3000/admin/workspaces?page=2&status=ACTIVE');
    const res = await proxy(req);
    assert.strictEqual(res.status, 307);
    const location = res.headers.get('location');
    assert.ok(
      location?.includes('/login?redirect=%2Fadmin%2Fworkspaces%3Fpage%3D2%26status%3DACTIVE'),
    );
  });

  it('should allow SUPER_ADMIN with valid non-expired token to access /admin', async () => {
    const token = makeJwt({
      sub: 'usr-super',
      role: 'SUPER_ADMIN',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const req = new NextRequest('http://localhost:3000/admin/workspaces', {
      headers: {
        cookie: `access_token=${token}`,
      },
    });
    const res = await proxy(req);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('location'), null);
  });

  it('should block non-SUPER_ADMIN (e.g. USER) and redirect to /', async () => {
    const token = makeJwt({
      sub: 'usr-regular',
      role: 'USER',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const req = new NextRequest('http://localhost:3000/admin', {
      headers: {
        cookie: `access_token=${token}`,
      },
    });
    const res = await proxy(req);
    assert.strictEqual(res.status, 307);
    const location = res.headers.get('location');
    assert.ok(location?.endsWith('/'));
    assert.ok(!location?.includes('/login'));
  });

  it('should NOT treat /administrators or other prefix routes as /admin', async () => {
    const token = makeJwt({
      sub: 'usr-regular',
      role: 'USER',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const req = new NextRequest('http://localhost:3000/administrators', {
      headers: {
        cookie: `access_token=${token}`,
      },
    });
    const res = await proxy(req);
    // Should proceed because it's a regular protected route with valid token, not the /admin gate
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('location'), null);
  });

  it('should transparently refresh expired token on /admin for SUPER_ADMIN', async () => {
    const expiredToken = makeJwt({
      sub: 'usr-super',
      role: 'SUPER_ADMIN',
      exp: Math.floor(Date.now() / 1000) - 100, // Expired
    });
    const newAccessToken = makeJwt({
      sub: 'usr-super',
      role: 'SUPER_ADMIN',
      exp: Math.floor(Date.now() / 1000) + 900,
    });

    global.fetch = (async () => ({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          accessToken: newAccessToken,
          refreshToken: 'new-refresh-token',
          expiresIn: 900,
        },
      }),
    })) as any;

    const req = new NextRequest('http://localhost:3000/admin/settings', {
      headers: {
        cookie: `access_token=${expiredToken}; refresh_token=old-refresh-token`,
      },
    });

    const res = await proxy(req);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('location'), null);
    // Should have set refreshed access_token cookie
    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie?.includes('access_token='));
  });

  it('should redirect to /login and clear cookies when refresh fails on /admin', async () => {
    const expiredToken = makeJwt({
      sub: 'usr-super',
      role: 'SUPER_ADMIN',
      exp: Math.floor(Date.now() / 1000) - 100,
    });

    global.fetch = (async () => ({
      ok: false,
      json: async () => ({ success: false }),
    })) as any;

    const req = new NextRequest('http://localhost:3000/admin/audit-logs', {
      headers: {
        cookie: `access_token=${expiredToken}; refresh_token=revoked-refresh-token`,
      },
    });

    const res = await proxy(req);
    assert.strictEqual(res.status, 307);
    const location = res.headers.get('location');
    assert.ok(location?.includes('/login?redirect=%2Fadmin%2Faudit-logs'));
    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie?.includes('Max-Age=0') || setCookie?.includes('access_token=;'));
  });
});
