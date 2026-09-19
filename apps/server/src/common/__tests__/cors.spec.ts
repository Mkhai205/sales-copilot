import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  createCorsOptions,
  CORS_ALLOWED_METHODS,
  CORS_ALLOWED_HEADERS,
  CORS_EXPOSED_HEADERS,
} from '../../config/cors.config';
import { envSchema } from '../../config/env.schema';

@Controller('cors-test')
class CorsTestController {
  @Get('ping')
  ping() {
    return { ok: true };
  }
}

@Module({
  controllers: [CorsTestController],
})
class CorsTestModule {}

describe('Strict CORS Configuration & Verification (Task 9 — Feature F-1.11.4)', () => {
  describe('CORS_ORIGIN Schema Parsing', () => {
    const baseEnv = {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      JWT_ACCESS_TOKEN_SECRET: 'test_jwt_secret_32bytes_minimum_length_ok',
      STORAGE_ACCESS_KEY: 'minioadmin',
      STORAGE_SECRET_KEY: 'minioadmin',
      CHANNEL_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    };

    it('should parse single origin string into array', () => {
      const parsed = envSchema.parse({
        ...baseEnv,
        CORS_ORIGIN: 'http://localhost:3000',
      });
      expect(parsed.CORS_ORIGIN).toEqual(['http://localhost:3000']);
    });

    it('should parse comma-separated origins with whitespace', () => {
      const parsed = envSchema.parse({
        ...baseEnv,
        CORS_ORIGIN: 'http://localhost:3000, https://app.salescopilot.vn,  http://localhost:8080 ',
      });
      expect(parsed.CORS_ORIGIN).toEqual([
        'http://localhost:3000',
        'https://app.salescopilot.vn',
        'http://localhost:8080',
      ]);
    });

    it('should preserve array format when supplied as array', () => {
      const parsed = envSchema.parse({
        ...baseEnv,
        CORS_ORIGIN: ['http://localhost:3000', 'https://app.salescopilot.vn'],
      });
      expect(parsed.CORS_ORIGIN).toEqual(['http://localhost:3000', 'https://app.salescopilot.vn']);
    });

    it('should default to [http://localhost:3000] when omitted', () => {
      const parsed = envSchema.parse(baseEnv);
      expect(parsed.CORS_ORIGIN).toEqual(['http://localhost:3000']);
    });
  });

  describe('createCorsOptions Configuration Properties', () => {
    it('should construct strict CORS options with credentials and standard headers', () => {
      const options = createCorsOptions(['http://localhost:3000', 'https://app.salescopilot.vn']);

      expect(options.origin).toEqual(['http://localhost:3000', 'https://app.salescopilot.vn']);
      expect(options.credentials).toBe(true);
      expect(options.maxAge).toBe(86400);

      // Verify HTTP methods
      expect(options.methods).toEqual(CORS_ALLOWED_METHODS);
      expect(CORS_ALLOWED_METHODS.includes('GET')).toBeTruthy();
      expect(CORS_ALLOWED_METHODS.includes('POST')).toBeTruthy();
      expect(CORS_ALLOWED_METHODS.includes('PUT')).toBeTruthy();
      expect(CORS_ALLOWED_METHODS.includes('PATCH')).toBeTruthy();
      expect(CORS_ALLOWED_METHODS.includes('DELETE')).toBeTruthy();
      expect(CORS_ALLOWED_METHODS.includes('OPTIONS')).toBeTruthy();

      // Verify allowed and exposed headers
      expect(options.allowedHeaders).toEqual(CORS_ALLOWED_HEADERS);
      expect(CORS_ALLOWED_HEADERS.includes('Authorization')).toBeTruthy();
      expect(CORS_ALLOWED_HEADERS.includes('X-Request-Id')).toBeTruthy();
      expect(CORS_ALLOWED_HEADERS.includes('X-Workspace-Id')).toBeTruthy();
      expect(CORS_ALLOWED_HEADERS.includes('CF-Connecting-IP')).toBeTruthy();

      expect(options.exposedHeaders).toEqual(CORS_EXPOSED_HEADERS);
      expect(CORS_EXPOSED_HEADERS.includes('X-Request-Id')).toBeTruthy();
      expect(CORS_EXPOSED_HEADERS.includes('Retry-After')).toBeTruthy();
    });
  });

  describe('Live NestJS HTTP Enforcement', () => {
    const allowedOrigins = ['http://localhost:3000', 'https://app.salescopilot.vn'];

    it('should allow whitelisted origin with credentials and allow-origin header', async () => {
      const app = await NestFactory.create(CorsTestModule, { logger: false });
      app.enableCors(createCorsOptions(allowedOrigins));
      await app.listen(0);

      const port = app.getHttpServer().address().port;
      const url = `http://127.0.0.1:${port}/cors-test/ping`;

      try {
        const res = await fetch(url, {
          headers: { Origin: 'http://localhost:3000' },
        });

        expect(res.status).toBe(200);
        expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
        expect(res.headers.get('access-control-allow-credentials')).toBe('true');
      } finally {
        await app.close();
      }
    });

    it('should block unlisted origin by not returning access-control-allow-origin', async () => {
      const app = await NestFactory.create(CorsTestModule, { logger: false });
      app.enableCors(createCorsOptions(allowedOrigins));
      await app.listen(0);

      const port = app.getHttpServer().address().port;
      const url = `http://127.0.0.1:${port}/cors-test/ping`;

      try {
        const res = await fetch(url, {
          headers: { Origin: 'https://malicious-attacker.com' },
        });

        expect(res.headers.get('access-control-allow-origin')).toBe(null);
      } finally {
        await app.close();
      }
    });

    it('should succeed preflight OPTIONS for whitelisted origin with allowed methods', async () => {
      const app = await NestFactory.create(CorsTestModule, { logger: false });
      app.enableCors(createCorsOptions(allowedOrigins));
      await app.listen(0);

      const port = app.getHttpServer().address().port;
      const url = `http://127.0.0.1:${port}/cors-test/ping`;

      try {
        const res = await fetch(url, {
          method: 'OPTIONS',
          headers: {
            Origin: 'https://app.salescopilot.vn',
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'Content-Type, Authorization',
          },
        });

        expect(res.status).toBe(204);
        expect(res.headers.get('access-control-allow-origin')).toBe('https://app.salescopilot.vn');
        expect(res.headers.get('access-control-allow-credentials')).toBe('true');
        const methods = res.headers.get('access-control-allow-methods');
        expect(methods?.includes('POST')).toBeTruthy();
        expect(methods?.includes('GET')).toBeTruthy();
      } finally {
        await app.close();
      }
    });

    it('should block preflight OPTIONS for unlisted origin without allow-origin header', async () => {
      const app = await NestFactory.create(CorsTestModule, { logger: false });
      app.enableCors(createCorsOptions(allowedOrigins));
      await app.listen(0);

      const port = app.getHttpServer().address().port;
      const url = `http://127.0.0.1:${port}/cors-test/ping`;

      try {
        const res = await fetch(url, {
          method: 'OPTIONS',
          headers: {
            Origin: 'https://unauthorized-domain.org',
            'Access-Control-Request-Method': 'POST',
          },
        });

        expect(res.headers.get('access-control-allow-origin')).toBe(null);
      } finally {
        await app.close();
      }
    });
  });
});
