import { NextRequest, NextResponse } from 'next/server';
import { getServerApiBase } from './lib/api/client';
import { decodeJwtPayload, isSuperAdmin, isTokenExpired } from './lib/auth/edge-jwt';

const PUBLIC_PREFIXES = [
  '/login',
  '/auth',
  '/api',
  '/_next',
  '/favicon.ico',
  '/widget',
  '/test-chat.html',
  '/brand',
  '/channels',
];

interface RefreshedTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
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
  const apiBase = getServerApiBase();

  try {
    const res = await fetch(`${apiBase}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });

    if (res.ok) {
      const body = await res.json();
      if (body.success && body.data?.accessToken) {
        return body.data as RefreshedTokens;
      }
    }
  } catch {
    // Network or API error during refresh
  }

  return null;
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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow public paths and Next.js internal static assets
  const isPublicPath = PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix));
  if (isPublicPath) {
    return NextResponse.next();
  }

  let accessToken = request.cookies.get('access_token')?.value;
  const refreshToken = request.cookies.get('refresh_token')?.value;

  // 2. Super Admin Gate (/admin or /admin/*)
  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/');
  if (isAdminRoute) {
    let payload = accessToken ? decodeJwtPayload(accessToken) : null;
    let refreshedTokens: RefreshedTokens | null = null;

    // If access token is missing or expired, attempt refresh
    if ((!accessToken || !payload || isTokenExpired(payload)) && refreshToken) {
      refreshedTokens = await attemptRefresh(refreshToken);
      if (refreshedTokens) {
        accessToken = refreshedTokens.accessToken;
        payload = decodeJwtPayload(accessToken);
      }
    }

    // If still no valid non-expired access token -> redirect to login with redirect param
    if (!accessToken || !payload || isTokenExpired(payload)) {
      const loginUrl = new URL('/login', request.url);
      const redirectTarget = pathname + (request.nextUrl.search || '');
      loginUrl.searchParams.set('redirect', redirectTarget);
      const response = NextResponse.redirect(loginUrl);
      clearAuthCookies(response, request);
      return response;
    }

    // If not SUPER_ADMIN -> redirect to home page
    if (!isSuperAdmin(payload)) {
      const response = NextResponse.redirect(new URL('/', request.url));
      if (refreshedTokens) {
        applyRefreshedCookies(response, request, refreshedTokens);
      }
      return response;
    }

    // Authorized SUPER_ADMIN -> allow proceed
    if (refreshedTokens) {
      return createNextResponseWithRefreshedCookies(request, refreshedTokens);
    }
    return NextResponse.next();
  }

  // 3. Regular Protected Routes
  // If no tokens at all -> redirect to login
  if (!accessToken && !refreshToken) {
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      const redirectTarget = pathname + (request.nextUrl.search || '');
      loginUrl.searchParams.set('redirect', redirectTarget);
    }
    return NextResponse.redirect(loginUrl);
  }

  // If valid access token is present and not expired, allow request to proceed
  const payload = accessToken ? decodeJwtPayload(accessToken) : null;
  if (accessToken && payload && !isTokenExpired(payload)) {
    return NextResponse.next();
  }

  // Access token expired/missing, but refresh token exists -> attempt transparent refresh
  if (refreshToken) {
    const refreshedTokens = await attemptRefresh(refreshToken);
    if (refreshedTokens) {
      return createNextResponseWithRefreshedCookies(request, refreshedTokens);
    }

    // Refresh failed or token was invalid/revoked -> redirect to login & clear cookies
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      const redirectTarget = pathname + (request.nextUrl.search || '');
      loginUrl.searchParams.set('redirect', redirectTarget);
    }
    const response = NextResponse.redirect(loginUrl);
    clearAuthCookies(response, request);
    return response;
  }

  return NextResponse.redirect(new URL('/login', request.url));
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
