import request from 'supertest';

export interface LoginCredentials {
  email: string;
  password?: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  authHeader: string;
  cookieHeader: string;
  rawCookies: string[];
  user: any;
}

/**
 * Authenticates as an agent/user via POST /api/v1/auth/login
 * and returns bearer token headers and cookie headers for Supertest requests.
 */
export async function loginAsAgent(
  httpServer: any,
  credentials: LoginCredentials,
): Promise<LoginResult> {
  const password = credentials.password ?? 'Password123!';

  const res = await request(httpServer)
    .post('/api/v1/auth/login')
    .send({
      email: credentials.email,
      password,
    })
    .expect(200);

  const body = res.body;
  const data = body.data || body;
  const tokens = data.tokens;

  if (!tokens || !tokens.accessToken) {
    throw new Error(
      `Login failed: No access token returned in response body: ${JSON.stringify(body)}`,
    );
  }

  const accessToken = tokens.accessToken as string;
  const refreshToken = tokens.refreshToken as string;
  const rawCookies: string[] = (res.headers['set-cookie'] as string[]) || [];

  // Format cookie string for subsequent supertest .set('Cookie', ...)
  const cookieHeader =
    rawCookies.length > 0
      ? rawCookies.map(c => c.split(';')[0]).join('; ')
      : `access_token=${accessToken}`;

  return {
    accessToken,
    refreshToken,
    authHeader: `Bearer ${accessToken}`,
    cookieHeader,
    rawCookies,
    user: data.user,
  };
}
