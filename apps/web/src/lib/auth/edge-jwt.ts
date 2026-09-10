export interface JwtPayload {
  sub?: string;
  email?: string;
  role?: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

/**
 * Safely decodes the payload of a JWT without verifying the signature.
 * Compatible with Next.js Edge runtime and Node.js.
 * Handles base64url formatting and padding.
 */
export function decodeJwtPayload<T = JwtPayload>(token: string): T | null {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = (4 - (base64.length % 4)) % 4;
    if (pad > 0 && pad < 4) {
      base64 += '='.repeat(pad);
    }

    let jsonStr: string;
    if (typeof Buffer !== 'undefined') {
      jsonStr = Buffer.from(base64, 'base64').toString('utf8');
    } else {
      const binary = atob(base64);
      const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
      jsonStr = new TextDecoder().decode(bytes);
    }

    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    return parsed as T;
  } catch {
    return null;
  }
}

/**
 * Checks whether the JWT token has expired or is about to expire within clockSkewMs.
 * @param payload Decoded JWT payload containing `exp` in seconds
 * @param clockSkewMs Tolerance in milliseconds (default 5000ms = 5s)
 */
export function isTokenExpired(
  payload: { exp?: number } | null | undefined,
  clockSkewMs = 5000,
): boolean {
  if (
    !payload ||
    typeof payload.exp !== 'number' ||
    !Number.isFinite(payload.exp) ||
    payload.exp <= 0
  ) {
    return true;
  }

  const currentTimeMs = Date.now();
  const expTimeMs = payload.exp * 1000;
  return currentTimeMs >= expTimeMs - clockSkewMs;
}

/**
 * Validates whether the decoded payload belongs to a Super Admin.
 */
export function isSuperAdmin(payload: { role?: string } | null | undefined): boolean {
  return payload?.role === 'SUPER_ADMIN';
}
