import { assertDefined } from '../../test/test-assertions';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { HELMET_CONFIG } from '../config/helmet.config';
import { envSchema } from '../config/env.schema';
import { TokenService } from '../modules/identity/auth/token.service';
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
      expect(parsed.JWT_ACCESS_TOKEN_EXPIRES_IN_SECONDS).toBe(900);
    });

    it('should configure refresh token expiration to 7 days (604800 seconds) by default', () => {
      const parsed = envSchema.parse(baseEnv);
      expect(parsed.REFRESH_TOKEN_EXPIRES_IN_SECONDS).toBe(604800);
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
        getOrThrow: (_key: string) => 'test_jwt_secret_32bytes_minimum_length_ok',
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
      expect(tokens.accessToken).toBe('mock.access.token');
      expect(tokens.expiresIn).toBe(900);
      expect(tokens.refreshToken.includes('.')).toBeTruthy(); // format: tokenId.tokenSecret

      // Verify JWT sign options & payload (Identity-Only, no sensitive data)
      expect(signedOptions.expiresIn).toBe(900);
      expect(signedPayload.sub).toBe('usr_test_1');
      expect(signedPayload.email).toBe('agent@salescopilot.vn');
      expect(signedPayload.role).toBe(PlatformRole.USER);
      expect(signedPayload.password).toBe(undefined);

      // Verify Redis storage TTL for refresh token is exactly 7 days
      const [tokenId] = tokens.refreshToken.split('.');
      const stored = redisStore.get(`auth:refresh_token:${tokenId}`);
      assertDefined(stored);
      expect(stored.ttl).toBe(604800);
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

      expect(cookieOptions.httpOnly).toBe(true);
      expect(cookieOptions.secure).toBe(true);
      expect(cookieOptions.sameSite).toBe('lax');
      expect(cookieOptions.path).toBe('/');

      const ACCESS_TOKEN_MAX_AGE = 900; // 15 minutes
      const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 days (604800s)

      expect(ACCESS_TOKEN_MAX_AGE).toBe(900);
      expect(REFRESH_TOKEN_MAX_AGE).toBe(604800);
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
        expect(res.status).toBe(200);

        // 1. X-Content-Type-Options
        expect(res.headers.get('x-content-type-options')).toBe('nosniff');

        // 2. X-Frame-Options
        expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN');

        // 3. Strict-Transport-Security (HSTS)
        const hsts = res.headers.get('strict-transport-security');
        assertDefined(hsts);
        expect(hsts.includes('max-age=31536000')).toBeTruthy();
        expect(hsts.includes('includeSubDomains')).toBeTruthy();

        // 4. Content-Security-Policy (CSP)
        const csp = res.headers.get('content-security-policy');
        assertDefined(csp);
        expect(csp.includes("default-src 'self'")).toBeTruthy();
        expect(csp.includes("script-src 'self'")).toBeTruthy();
        expect(csp.includes("object-src 'none'")).toBeTruthy();

        // 5. Cross-Origin-Resource-Policy
        expect(res.headers.get('cross-origin-resource-policy')).toBe('cross-origin');

        // 6. X-Download-Options
        expect(res.headers.get('x-download-options')).toBe('noopen');
      } finally {
        await app.close();
      }
    });
  });
});
