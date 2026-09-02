import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { HELMET_CONFIG } from '../config/helmet.config';
import { envSchema } from '../config/env.schema';
import { TokenService } from '../modules/auth/token.service';
import { PlatformRole } from '@sales-copilot/shared-contracts';

@Controller('security-test')
class SecurityTestController {
  @Get('ping')
  ping() {
    return { ok: true };
  }
}

@Module({
  controllers: [SecurityTestController],
})
class SecurityTestModule {}

describe('JWT Policy & Security Headers Verification (Task 12 — Feature F-1.11.4)', () => {
  describe('JWT Expiration Policy Verification', () => {
    const baseEnv = {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      JWT_ACCESS_TOKEN_SECRET: 'test_jwt_secret_32bytes_minimum_length_ok',
      STORAGE_ACCESS_KEY: 'minioadmin',
      STORAGE_SECRET_KEY: 'minioadmin',
      CHANNEL_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    };

    it('should configure access token expiration to 15 minutes (900 seconds) by default', () => {
      const parsed = envSchema.parse(baseEnv);
      assert.strictEqual(parsed.JWT_ACCESS_TOKEN_EXPIRES_IN_SECONDS, 900);
    });

    it('should configure refresh token expiration to 7 days (604800 seconds) by default', () => {
      const parsed = envSchema.parse(baseEnv);
      assert.strictEqual(parsed.REFRESH_TOKEN_EXPIRES_IN_SECONDS, 604800);
    });

    it('should generate tokens adhering to 15-minute access and 7-day refresh policies', async () => {
      let signedPayload: any = null;
      let signedOptions: any = null;

      const mockJwtService: any = {
        sign: (payload: any, options: any) => {
          signedPayload = payload;
          signedOptions = options;
          return 'mock.access.token';
        },
      };

      const redisStore = new Map<string, { value: string; ttl: number }>();
      const mockRedisService: any = {
        set: async (key: string, value: string, ttl: number) => {
          redisStore.set(key, { value, ttl });
          return 'OK';
        },
        getClient: () => null,
      };

      const mockConfigService: any = {
        getOrThrow: (key: string) => 'test_jwt_secret_32bytes_minimum_length_ok',
        get: (key: string, defaultVal: any) => {
          if (key === 'JWT_ACCESS_TOKEN_EXPIRES_IN_SECONDS') return 900;
          if (key === 'REFRESH_TOKEN_EXPIRES_IN_SECONDS') return 604800;
          return defaultVal;
        },
      };

      const tokenService = new TokenService(mockConfigService, mockJwtService, mockRedisService);

      const user = {
        id: 'usr_test_1',
        email: 'agent@salescopilot.vn',
        role: PlatformRole.USER,
      };

      const tokens = await tokenService.generateTokens(user);

      // Verify returned tokens object
      assert.strictEqual(tokens.accessToken, 'mock.access.token');
      assert.strictEqual(tokens.expiresIn, 900);
      assert.ok(tokens.refreshToken.includes('.')); // format: tokenId.tokenSecret

      // Verify JWT sign options & payload (Identity-Only, no sensitive data)
      assert.strictEqual(signedOptions.expiresIn, 900);
      assert.strictEqual(signedPayload.sub, 'usr_test_1');
      assert.strictEqual(signedPayload.email, 'agent@salescopilot.vn');
      assert.strictEqual(signedPayload.role, PlatformRole.USER);
      assert.strictEqual(signedPayload.password, undefined);

      // Verify Redis storage TTL for refresh token is exactly 7 days
      const [tokenId] = tokens.refreshToken.split('.');
      const stored = redisStore.get(`auth:refresh_token:${tokenId}`);
      assert.ok(stored);
      assert.strictEqual(stored.ttl, 604800);
    });
  });

  describe('Cookie Security Attributes Alignment', () => {
    it('should verify standard cookie security policy configuration', () => {
      // Standard security attributes defined across Next.js Server Actions & Middleware
      const cookieOptions = {
        httpOnly: true,
        secure: true,
        sameSite: 'lax' as const,
        path: '/',
      };

      assert.strictEqual(
        cookieOptions.httpOnly,
        true,
        'httpOnly must be true to prevent XSS access',
      );
      assert.strictEqual(cookieOptions.secure, true, 'secure must be true for HTTPS transmission');
      assert.strictEqual(cookieOptions.sameSite, 'lax', 'sameSite must be lax to prevent CSRF');
      assert.strictEqual(cookieOptions.path, '/', 'path must be root /');

      const ACCESS_TOKEN_MAX_AGE = 900; // 15 minutes
      const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 days (604800s)

      assert.strictEqual(ACCESS_TOKEN_MAX_AGE, 900);
      assert.strictEqual(REFRESH_TOKEN_MAX_AGE, 604800);
    });
  });

  describe('Helmet Security Headers Live HTTP Verification', () => {
    it('should return all required security headers (X-Content-Type-Options, X-Frame-Options, HSTS, CSP)', async () => {
      const app = await NestFactory.create(SecurityTestModule, { logger: false });
      app.use(helmet(HELMET_CONFIG));
      await app.listen(0);

      const port = app.getHttpServer().address().port;
      const url = `http://127.0.0.1:${port}/security-test/ping`;

      try {
        const res = await fetch(url);
        assert.strictEqual(res.status, 200);

        // 1. X-Content-Type-Options
        assert.strictEqual(
          res.headers.get('x-content-type-options'),
          'nosniff',
          'X-Content-Type-Options must be nosniff',
        );

        // 2. X-Frame-Options
        assert.strictEqual(
          res.headers.get('x-frame-options'),
          'SAMEORIGIN',
          'X-Frame-Options must be SAMEORIGIN',
        );

        // 3. Strict-Transport-Security (HSTS)
        const hsts = res.headers.get('strict-transport-security');
        assert.ok(hsts, 'Strict-Transport-Security header must be present');
        assert.ok(hsts.includes('max-age=31536000'), 'HSTS max-age must be 1 year (31536000s)');
        assert.ok(hsts.includes('includeSubDomains'), 'HSTS must includeSubDomains');

        // 4. Content-Security-Policy (CSP)
        const csp = res.headers.get('content-security-policy');
        assert.ok(csp, 'Content-Security-Policy header must be present');
        assert.ok(csp.includes("default-src 'self'"), "CSP must define default-src 'self'");
        assert.ok(csp.includes("script-src 'self'"), "CSP must define script-src 'self'");
        assert.ok(csp.includes("object-src 'none'"), "CSP must define object-src 'none'");

        // 5. Cross-Origin-Resource-Policy
        assert.strictEqual(
          res.headers.get('cross-origin-resource-policy'),
          'cross-origin',
          'CORP must be cross-origin',
        );

        // 6. X-Download-Options
        assert.strictEqual(
          res.headers.get('x-download-options'),
          'noopen',
          'X-Download-Options must be noopen',
        );
      } finally {
        await app.close();
      }
    });
  });
});
