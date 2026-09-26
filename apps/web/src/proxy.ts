import { NextRequest, NextResponse } from 'next/server';
import { getServerApiBase } from './lib/api/client';
import {
  decodeJwtPayload,
  isSuperAdmin,
  isTokenExpired,
  type JwtPayload,
} from './lib/auth/edge-jwt';

const PUBLIC_PREFIXES = [
  '/login',
  '/register',
  '/auth',
  '/api',
  '/_next',
  '/_not-found',
  '/not-found',
  '/favicon.ico',
  '/widget',
  '/test-chat.html',
  '/brand',
  '/channels',
];

const REFRESH_TIMEOUT_MS = 5000;
const REFRESH_BUFFER_MS = 60_000; // 60s proactive refresh window
const IN_FLIGHT_CACHE_TTL_MS = 2500; // 2.5s retention window to eliminate concurrent refresh collisions

const inFlightRefreshes = new Map<string, Promise<RefreshedTokens | null>>();

/**
 * Resets in-flight refresh cache (useful for test isolation).
 */
export function clearInFlightRefreshes(): void {
  inFlightRefreshes.clear();
}

interface RefreshedTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

interface ResolvedSession {
  accessToken: string | null;
  payload: JwtPayload | null;
  refreshedTokens: RefreshedTokens | null;
  isAuthenticated: boolean;
}

function getCookieDomain(hostname: string): string | undefined {
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return undefined;
  }
  // Host-only cookie by default (RFC 6265) for single-domain security.
  // Explicit COOKIE_DOMAIN can still be provided if cross-subdomain auth is required.
  return process.env.COOKIE_DOMAIN || undefined;
}

async function attemptRefresh(refreshToken: string): Promise<RefreshedTokens | null> {
  const existingPromise = inFlightRefreshes.get(refreshToken);
  if (existingPromise) {
    return existingPromise;
  }

  const refreshPromise = (async (): Promise<RefreshedTokens | null> => {
    const apiBase = getServerApiBase();

    try {
      const res = await fetch(`${apiBase}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
        cache: 'no-store',
        signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
      });

      if (res.ok) {
        const body = await res.json();
        if (body.success && body.data?.accessToken) {
          return body.data as RefreshedTokens;
        }
      }
    } catch {
      // Network, timeout, or API error during refresh
    }

    return null;
  })();

  inFlightRefreshes.set(refreshToken, refreshPromise);

  const cleanupTimer = setTimeout(() => {
    inFlightRefreshes.delete(refreshToken);
  }, IN_FLIGHT_CACHE_TTL_MS);

  // Unref timer in Node runtime to prevent hanging active handles
  if (typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    (cleanupTimer as { unref: () => void }).unref();
  }

  return refreshPromise;
}

function applyRefreshedCookies(
  response: NextResponse,
  request: NextRequest,
  tokens: RefreshedTokens,
): void {
  const cookieDomain = getCookieDomain(request.nextUrl.hostname);
  const isSecure =
    request.nextUrl.protocol === 'https:' ||
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.NEXT_PUBLIC_API_URL?.startsWith('https'));

  response.cookies.set('access_token', tokens.accessToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    domain: cookieDomain,
    maxAge: tokens.expiresIn || 900,
    path: '/',
  });

  request.cookies.set('access_token', tokens.accessToken);

  if (tokens.refreshToken) {
    response.cookies.set('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      domain: cookieDomain,
      maxAge: 7 * 24 * 60 * 60, // 7 days (matching REFRESH_TOKEN_EXPIRES_IN_SECONDS: 604800)
      path: '/',
    });
    request.cookies.set('refresh_token', tokens.refreshToken);
  }
}

function createNextResponseWithRefreshedCookies(
  request: NextRequest,
  tokens: RefreshedTokens,
): NextResponse {
  request.cookies.set('access_token', tokens.accessToken);
  if (tokens.refreshToken) {
    request.cookies.set('refresh_token', tokens.refreshToken);
  }

  const response = NextResponse.next({
    request: {
      headers: new Headers(request.headers),
    },
  });

  applyRefreshedCookies(response, request, tokens);
  return response;
}

function clearAuthCookies(response: NextResponse, request: NextRequest): void {
  const cookieDomain = getCookieDomain(request.nextUrl.hostname);
  if (cookieDomain) {
    response.cookies.delete({ name: 'access_token', domain: cookieDomain, path: '/' });
    response.cookies.delete({ name: 'refresh_token', domain: cookieDomain, path: '/' });
  }
  response.cookies.delete('access_token');
  response.cookies.delete('refresh_token');
}

function createLoginRedirect(request: NextRequest, clearCookies = false): NextResponse {
  const loginUrl = new URL('/login', request.url);
  const { pathname, search } = request.nextUrl;
  if (pathname !== '/') {
    loginUrl.searchParams.set('redirect', pathname + (search || ''));
  }

  const response = NextResponse.redirect(loginUrl);
  if (clearCookies) {
    clearAuthCookies(response, request);
  }
  return response;
}

async function resolveSession(request: NextRequest): Promise<ResolvedSession> {
  let accessToken = request.cookies.get('access_token')?.value || null;
  const refreshToken = request.cookies.get('refresh_token')?.value || null;

  let payload = accessToken ? decodeJwtPayload(accessToken) : null;
  let refreshedTokens: RefreshedTokens | null = null;

  // Proactive refresh: if token is missing, unparseable, or within 60s buffer of expiring
  const needsRefresh = !accessToken || !payload || isTokenExpired(payload, REFRESH_BUFFER_MS);

  if (needsRefresh && refreshToken) {
    refreshedTokens = await attemptRefresh(refreshToken);
    if (refreshedTokens) {
      accessToken = refreshedTokens.accessToken;
      payload = decodeJwtPayload(accessToken);
    }
  }

  // Session is authenticated if we have a valid token that has not strictly expired
  const isAuthenticated = Boolean(accessToken && payload && !isTokenExpired(payload, 5000));

  return {
    accessToken,
    payload,
    refreshedTokens,
    isAuthenticated,
  };
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow public paths and Next.js internal static assets
  const isPublicPath = PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix));
  if (isPublicPath) {
    return NextResponse.next();
  }

  const isPlatformAdminRoute =
    pathname === '/platform-admin' || pathname.startsWith('/platform-admin/');

  const session = await resolveSession(request);

  // If not authenticated, redirect to login
  if (!session.isAuthenticated) {
    const hasRefreshToken = Boolean(request.cookies.get('refresh_token')?.value);
    return createLoginRedirect(request, hasRefreshToken);
  }

  // 2. Super Admin Gate (/platform-admin or /platform-admin/*)
  if (isPlatformAdminRoute) {
    if (!isSuperAdmin(session.payload)) {
      const response = NextResponse.redirect(new URL('/', request.url));
      if (session.refreshedTokens) {
        applyRefreshedCookies(response, request, session.refreshedTokens);
      }
      return response;
    }
  }

  // 3. Authorized request (Super Admin or regular protected routes)
  if (session.refreshedTokens) {
    return createNextResponseWithRefreshedCookies(request, session.refreshedTokens);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static asset files with extensions (.svg, .png, .jpg, .jpeg, .gif, .webp, .ico, .woff, .woff2)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)).*)',
  ],
};
