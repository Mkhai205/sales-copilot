import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PREFIXES = ['/login', '/api', '/_next', '/favicon.ico', '/widget', '/test-chat.html'];

function getCookieDomain(hostname: string): string | undefined {
  if (process.env.COOKIE_DOMAIN) {
    return process.env.COOKIE_DOMAIN;
  }
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return undefined;
  }
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    return '.' + parts.slice(-2).join('.');
  }
  return undefined;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths and Next.js internal static assets
  const isPublicPath = PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix));
  if (isPublicPath) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get('access_token')?.value;
  const refreshToken = request.cookies.get('refresh_token')?.value;

  // If no tokens at all -> redirect to login
  if (!accessToken && !refreshToken) {
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('redirect', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // If valid access token is present, allow request to proceed
  if (accessToken) {
    return NextResponse.next();
  }

  // Access token expired/missing, but refresh token exists -> attempt transparent refresh
  if (refreshToken) {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

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
          const tokens = body.data;
          const response = NextResponse.next();

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

          if (tokens.refreshToken) {
            response.cookies.set('refresh_token', tokens.refreshToken, {
              httpOnly: true,
              secure: isSecure,
              sameSite: 'lax',
              domain: cookieDomain,
              maxAge: 7 * 24 * 60 * 60, // 7 days (matching REFRESH_TOKEN_EXPIRES_IN_SECONDS: 604800)
              path: '/',
            });
          }

          return response;
        }
      }
    } catch {
      // Refresh request network error
    }

    // Refresh failed or token was invalid/revoked -> redirect to login & clear cookies
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('redirect', pathname);
    }
    const response = NextResponse.redirect(loginUrl);
    const cookieDomain = getCookieDomain(request.nextUrl.hostname);
    if (cookieDomain) {
      response.cookies.delete({ name: 'access_token', domain: cookieDomain, path: '/' });
      response.cookies.delete({ name: 'refresh_token', domain: cookieDomain, path: '/' });
    }
    response.cookies.delete('access_token');
    response.cookies.delete('refresh_token');
    return response;
  }

  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
