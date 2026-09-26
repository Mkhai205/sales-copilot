import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert';
import { NextRequest } from 'next/server';
import { proxy, clearInFlightRefreshes } from '../../../proxy';

function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.mockSignature`;
}

describe('Next.js Edge Proxy — /platform-admin Protection & Security (apps/web/src/proxy.ts)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Reset fetch & in-flight cache
    global.fetch = originalFetch;
    clearInFlightRefreshes();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    clearInFlightRefreshes();
  });

  it('should allow public routes to pass through unconditionally', async () => {
    const req = new NextRequest('http://localhost:3000/login');
    const res = await proxy(req);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('location'), null);

    const registerReq = new NextRequest('http://localhost:3000/register');
    const registerRes = await proxy(registerReq);
    assert.strictEqual(registerRes.status, 200);
    assert.strictEqual(registerRes.headers.get('location'), null);
  });

  it('should redirect unauthenticated user from /platform-admin to /login with redirect parameter', async () => {
    const req = new NextRequest('http://localhost:3000/platform-admin');
    const res = await proxy(req);
    assert.strictEqual(res.status, 307);
    const location = res.headers.get('location');
    assert.ok(location?.includes('/login?redirect=%2Fplatform-admin'));
  });

  it('should preserve query parameters in redirect when accessing /platform-admin/workspaces?page=2', async () => {
    const req = new NextRequest(
      'http://localhost:3000/platform-admin/workspaces?page=2&status=ACTIVE',
    );
    const res = await proxy(req);
    assert.strictEqual(res.status, 307);
    const location = res.headers.get('location');
    assert.ok(
      location?.includes(
        '/login?redirect=%2Fplatform-admin%2Fworkspaces%3Fpage%3D2%26status%3DACTIVE',
      ),
    );
  });

  it('should allow SUPER_ADMIN with valid non-expired token to access /platform-admin', async () => {
    const token = makeJwt({
      sub: 'usr-super',
      role: 'SUPER_ADMIN',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const req = new NextRequest('http://localhost:3000/platform-admin/workspaces', {
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
    const req = new NextRequest('http://localhost:3000/platform-admin', {
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

  it('should NOT treat /platform-administrators or other prefix routes as /platform-admin', async () => {
    const token = makeJwt({
      sub: 'usr-regular',
      role: 'USER',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const req = new NextRequest('http://localhost:3000/platform-administrators', {
      headers: {
        cookie: `access_token=${token}`,
      },
    });
    const res = await proxy(req);
    // Should proceed because it's a regular protected route with valid token, not the /platform-admin gate
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('location'), null);
  });

  it('should transparently refresh expired token on /platform-admin for SUPER_ADMIN', async () => {
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

    const req = new NextRequest('http://localhost:3000/platform-admin/settings', {
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

  it('should redirect to /login and clear cookies when refresh fails on /platform-admin', async () => {
    const expiredToken = makeJwt({
      sub: 'usr-super',
      role: 'SUPER_ADMIN',
      exp: Math.floor(Date.now() / 1000) - 100,
    });

    global.fetch = (async () => ({
      ok: false,
      json: async () => ({ success: false }),
    })) as any;

    const req = new NextRequest('http://localhost:3000/platform-admin/audit-logs', {
      headers: {
        cookie: `access_token=${expiredToken}; refresh_token=revoked-refresh-token`,
      },
    });

    const res = await proxy(req);
    assert.strictEqual(res.status, 307);
    const location = res.headers.get('location');
    assert.ok(location?.includes('/login?redirect=%2Fplatform-admin%2Faudit-logs'));
    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie?.includes('Max-Age=0') || setCookie?.includes('access_token=;'));
  });

  it('should proactively refresh access token when within the 60s buffer before expiration', async () => {
    // Token is NOT yet expired, but expires in 30 seconds (within the 60s buffer)
    const tokenExpiringSoon = makeJwt({
      sub: 'usr-super',
      role: 'SUPER_ADMIN',
      exp: Math.floor(Date.now() / 1000) + 30,
    });
    const newAccessToken = makeJwt({
      sub: 'usr-super',
      role: 'SUPER_ADMIN',
      exp: Math.floor(Date.now() / 1000) + 900,
    });

    let fetchCalled = false;
    global.fetch = (async () => {
      fetchCalled = true;
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            accessToken: newAccessToken,
            refreshToken: 'proactively-refreshed-token',
            expiresIn: 900,
          },
        }),
      };
    }) as any;

    const req = new NextRequest('http://localhost:3000/platform-admin/settings', {
      headers: {
        cookie: `access_token=${tokenExpiringSoon}; refresh_token=current-refresh-token`,
      },
    });

    const res = await proxy(req);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(fetchCalled, true, 'Proactive refresh should have triggered fetch');
    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie?.includes('access_token='));
  });

  it('should deduplicate concurrent in-flight refresh requests with the same refresh token', async () => {
    const expiredToken = makeJwt({
      sub: 'usr-regular',
      role: 'USER',
      exp: Math.floor(Date.now() / 1000) - 100,
    });
    const newAccessToken = makeJwt({
      sub: 'usr-regular',
      role: 'USER',
      exp: Math.floor(Date.now() / 1000) + 900,
    });

    let fetchCallCount = 0;
    global.fetch = (async () => {
      fetchCallCount++;
      // Simulate small network delay
      await new Promise(resolve => setTimeout(resolve, 30));
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            accessToken: newAccessToken,
            refreshToken: 'deduped-refresh-token',
            expiresIn: 900,
          },
        }),
      };
    }) as any;

    const req1 = new NextRequest('http://localhost:3000/workspace-a/inbox', {
      headers: {
        cookie: `access_token=${expiredToken}; refresh_token=shared-refresh-token`,
      },
    });
    const req2 = new NextRequest('http://localhost:3000/workspace-a/settings', {
      headers: {
        cookie: `access_token=${expiredToken}; refresh_token=shared-refresh-token`,
      },
    });

    // Fire both requests concurrently
    const [res1, res2] = await Promise.all([proxy(req1), proxy(req2)]);

    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res2.status, 200);
    assert.strictEqual(
      fetchCallCount,
      1,
      `Expected fetch to be called exactly 1 time due to in-flight deduplication, got ${fetchCallCount}`,
    );

    const setCookie1 = res1.headers.get('set-cookie');
    const setCookie2 = res2.headers.get('set-cookie');
    assert.ok(setCookie1?.includes('access_token='));
    assert.ok(setCookie2?.includes('access_token='));
  });

  it('should handle fetch timeout or network error during refresh gracefully by redirecting to /login and clearing cookies', async () => {
    const expiredToken = makeJwt({
      sub: 'usr-regular',
      role: 'USER',
      exp: Math.floor(Date.now() / 1000) - 100,
    });

    // Simulate fetch throwing an AbortError / TimeoutError
    global.fetch = (async () => {
      const err = new Error('The operation was aborted due to timeout');
      err.name = 'TimeoutError';
      throw err;
    }) as any;

    const req = new NextRequest('http://localhost:3000/workspace-a/contacts', {
      headers: {
        cookie: `access_token=${expiredToken}; refresh_token=some-refresh-token`,
      },
    });

    const res = await proxy(req);
    assert.strictEqual(res.status, 307);
    const location = res.headers.get('location');
    assert.ok(location?.includes('/login?redirect=%2Fworkspace-a%2Fcontacts'));
    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie?.includes('Max-Age=0') || setCookie?.includes('access_token=;'));
  });
});
