'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { API_BASE } from '@/lib/api/client';
import type { LoginDto, LoginResponseDto, UserWorkspaceDto } from '@sales-copilot/shared-contracts';

const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 days (matching REFRESH_TOKEN_EXPIRES_IN_SECONDS: 604800)

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

    cookieStore.set('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokens.expiresIn,
      path: '/',
    });

    cookieStore.set('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: REFRESH_TOKEN_MAX_AGE,
      path: '/',
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

    cookieStore.set('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokens.expiresIn,
      path: '/',
    });

    cookieStore.set('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: REFRESH_TOKEN_MAX_AGE,
      path: '/',
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

    cookieStore.set('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokens.expiresIn,
      path: '/',
    });

    cookieStore.set('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: REFRESH_TOKEN_MAX_AGE,
      path: '/',
    });

    return tokens.accessToken;
  } catch {
    return null;
  }
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('refresh_token')?.value;

  if (refreshToken) {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
        cache: 'no-store',
      });
    } catch {
      // Ignore network errors on logout
    }
  }

  cookieStore.delete('access_token');
  cookieStore.delete('refresh_token');

  redirect('/login');
}
