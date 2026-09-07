'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { API_BASE } from '@/lib/api/client';
import type { LoginDto, LoginResponseDto, UserWorkspaceDto } from '@sales-copilot/shared-contracts';

const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 days (matching REFRESH_TOKEN_EXPIRES_IN_SECONDS: 604800)

async function getAuthCookieBaseOptions() {
  let domain: string | undefined = process.env.COOKIE_DOMAIN;
  let isSecure =
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.NEXT_PUBLIC_API_URL?.startsWith('https'));

  try {
    const headerList = await headers();
    const host = headerList.get('host')?.split(':')[0];
    if (host === 'localhost' || host === '127.0.0.1') {
      domain = undefined;
      isSecure = false;
    } else if (host) {
      isSecure = true;
    }
  } catch {
    // Non-request context fallback
  }

  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax' as const,
    domain: domain || undefined,
    path: '/',
  };
}

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export async function loginAction(
  formData: LoginDto,
): Promise<ActionResult<LoginResponseDto> | void> {
  let targetSlug = 'default';

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
      cache: 'no-store',
    });

    const responseBody = await res.json();

    if (!res.ok || !responseBody.success) {
      return {
        success: false,
        error: responseBody.error || {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password. Please try again.',
        },
      };
    }

    const { tokens } = responseBody.data as LoginResponseDto;

    const cookieStore = await cookies();
    const cookieBase = await getAuthCookieBaseOptions();

    cookieStore.set('access_token', tokens.accessToken, {
      ...cookieBase,
      maxAge: tokens.expiresIn,
    });

    cookieStore.set('refresh_token', tokens.refreshToken, {
      ...cookieBase,
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });

    // Resolve user's default workspace
    try {
      const workspaceRes = await fetch(`${API_BASE}/workspaces`, {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (workspaceRes.ok) {
        const workspaceData = (await workspaceRes.json()) as {
          success: boolean;
          data: UserWorkspaceDto[];
        };
        if (workspaceData.success && workspaceData.data?.length > 0) {
          targetSlug = workspaceData.data[0].slug;
        }
      }
    } catch {
      // Fall back to default slug if workspaces endpoint fails
    }
  } catch (err: any) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: err?.message || 'Unable to connect to the authentication server.',
      },
    };
  }

  // Redirect to dashboard conversations
  redirect(`/${targetSlug}/conversations`);
}

export async function getSocketTokenAction(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token')?.value;

    if (accessToken) {
      return accessToken;
    }

    // Attempt transparent refresh if access_token cookie is missing
    const refreshToken = cookieStore.get('refresh_token')?.value;
    if (!refreshToken) {
      return null;
    }

    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });

    if (!res.ok) {
      return null;
    }

    const responseBody = await res.json();
    if (!responseBody.success || !responseBody.data) {
      return null;
    }

    const tokens = responseBody.data as {
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    };

    const cookieBase = await getAuthCookieBaseOptions();

    cookieStore.set('access_token', tokens.accessToken, {
      ...cookieBase,
      maxAge: tokens.expiresIn,
    });

    cookieStore.set('refresh_token', tokens.refreshToken, {
      ...cookieBase,
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });

    return tokens.accessToken;
  } catch {
    return null;
  }
}

export async function refreshSessionAction(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('refresh_token')?.value;
    if (!refreshToken) {
      return null;
    }

    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });

    if (!res.ok) {
      return null;
    }

    const responseBody = await res.json();
    if (!responseBody.success || !responseBody.data) {
      return null;
    }

    const tokens = responseBody.data as {
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    };

    const cookieBase = await getAuthCookieBaseOptions();

    cookieStore.set('access_token', tokens.accessToken, {
      ...cookieBase,
      maxAge: tokens.expiresIn,
    });

    cookieStore.set('refresh_token', tokens.refreshToken, {
      ...cookieBase,
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });

    return tokens.accessToken;
  } catch {
    return null;
  }
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;
  const refreshToken = cookieStore.get('refresh_token')?.value;

  if (refreshToken || accessToken) {
    try {
      const headersInit: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (accessToken) {
        headersInit['Authorization'] = `Bearer ${accessToken}`;
      }

      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: headersInit,
        body: JSON.stringify({ refreshToken }),
        cache: 'no-store',
      });
    } catch {
      // Ignore network errors on logout
    }
  }

  const cookieBase = await getAuthCookieBaseOptions();
  if (cookieBase.domain) {
    cookieStore.delete({ name: 'access_token', domain: cookieBase.domain, path: '/' });
    cookieStore.delete({ name: 'refresh_token', domain: cookieBase.domain, path: '/' });
  }
  cookieStore.delete('access_token');
  cookieStore.delete('refresh_token');

  redirect('/login');
}
