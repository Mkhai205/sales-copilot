import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const PUBLIC_PATHS = ['/login', '/api'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const accessToken = request.cookies.get('access_token')?.value;
  const refreshToken = request.cookies.get('refresh_token')?.value;

  const isPublicPath = PUBLIC_PATHS.some(
    path => pathname === path || pathname.startsWith(`${path}/`),
  );

  // If user is visiting /login and already has an active access token, redirect to dashboard root
  if (pathname === '/login' && accessToken) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Allow public paths without auth check
  if (isPublicPath) {
    return NextResponse.next();
  }

  // 1. If access token is valid, allow request
  if (accessToken) {
    return NextResponse.next();
  }

  // 2. If no tokens exist at all, redirect to login
  if (!refreshToken) {
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('from', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // 3. Access token is missing/expired, but refresh token exists: attempt transparent token refresh
  try {
    const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });

    if (refreshRes.ok) {
      const data = await refreshRes.json();
      if (data.success && data.data) {
        const { tokens } = data.data;
        const response = NextResponse.next();

        response.cookies.set('access_token', tokens.accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: tokens.expiresIn || 900,
          path: '/',
        });

        response.cookies.set('refresh_token', tokens.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 30 * 24 * 60 * 60,
          path: '/',
        });

        return response;
      }
    }
  } catch {
    // Network or server error during refresh
  }

  // If refresh failed, delete invalid tokens and redirect to login
  const loginUrl = new URL('/login', request.url);
  if (pathname !== '/') {
    loginUrl.searchParams.set('from', pathname);
  }

  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete('access_token');
  response.cookies.delete('refresh_token');

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets (images, icons, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
