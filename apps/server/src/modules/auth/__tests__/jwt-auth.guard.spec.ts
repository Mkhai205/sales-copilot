import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { ExecutionContext } from '@nestjs/common';
import { PlatformRole } from '@sales-copilot/shared-contracts';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { TokenService } from '../token.service';

describe('JwtAuthGuard (Authentication & Request Context Injection)', () => {
  let guard: JwtAuthGuard;
  let mockTokenService: Partial<TokenService>;

  beforeEach(() => {
    mockTokenService = {
      verifyAccessToken: async (token: string) => {
        if (token === 'valid.jwt.token') {
          return {
            sub: 'usr_valid_123',
            email: 'agent@salescopilot.io',
            role: PlatformRole.USER,
          };
        }
        throw new Error('Invalid token');
      },
    };

    guard = new JwtAuthGuard(mockTokenService as TokenService);
  });

  function createMockExecutionContext(
    headers: Record<string, string> = {},
    cookies: Record<string, string> = {},
  ): {
    context: ExecutionContext;
    request: any;
  } {
    const request = {
      headers,
      cookies,
      user: undefined,
    };

    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
    } as unknown as ExecutionContext;

    return { context, request };
  }

  it('should allow access and attach user context when valid Bearer token is provided', async () => {
    const { context, request } = createMockExecutionContext({
      authorization: 'Bearer valid.jwt.token',
    });

    const result = await guard.canActivate(context);

    assert.strictEqual(result, true);
    assert.deepStrictEqual(request.user, {
      userId: 'usr_valid_123',
      email: 'agent@salescopilot.io',
      role: PlatformRole.USER,
    });
  });

  it('should allow access via cookie fallback when Authorization header is absent', async () => {
    const { context, request } = createMockExecutionContext(
      {},
      {
        access_token: 'valid.jwt.token',
      },
    );

    const result = await guard.canActivate(context);

    assert.strictEqual(result, true);
    assert.deepStrictEqual(request.user, {
      userId: 'usr_valid_123',
      email: 'agent@salescopilot.io',
      role: PlatformRole.USER,
    });
  });

  it('should throw UnauthorizedException when no token is provided', async () => {
    const { context } = createMockExecutionContext();

    await assert.rejects(
      async () => {
        await guard.canActivate(context);
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'UNAUTHORIZED');
        return true;
      },
    );
  });

  it('should throw UnauthorizedException when token verification fails', async () => {
    const { context } = createMockExecutionContext({
      authorization: 'Bearer invalid.or.expired.token',
    });

    await assert.rejects(async () => {
      await guard.canActivate(context);
    });
  });
});
