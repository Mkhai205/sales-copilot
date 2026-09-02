import { describe, it } from 'node:test';
import * as assert from 'node:assert';
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
      assert.deepStrictEqual(parsed.CORS_ORIGIN, ['http://localhost:3000']);
    });

    it('should parse comma-separated origins with whitespace', () => {
      const parsed = envSchema.parse({
        ...baseEnv,
        CORS_ORIGIN: 'http://localhost:3000, https://app.salescopilot.vn,  http://localhost:8080 ',
      });
      assert.deepStrictEqual(parsed.CORS_ORIGIN, [
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
      assert.deepStrictEqual(parsed.CORS_ORIGIN, [
        'http://localhost:3000',
        'https://app.salescopilot.vn',
      ]);
    });

    it('should default to [http://localhost:3000] when omitted', () => {
      const parsed = envSchema.parse(baseEnv);
      assert.deepStrictEqual(parsed.CORS_ORIGIN, ['http://localhost:3000']);
    });
  });

  describe('createCorsOptions Configuration Properties', () => {
    it('should construct strict CORS options with credentials and standard headers', () => {
      const options = createCorsOptions(['http://localhost:3000', 'https://app.salescopilot.vn']);

      assert.deepStrictEqual(options.origin, [
        'http://localhost:3000',
        'https://app.salescopilot.vn',
      ]);
      assert.strictEqual(options.credentials, true);
      assert.strictEqual(options.maxAge, 86400);

      // Verify HTTP methods
      assert.deepStrictEqual(options.methods, CORS_ALLOWED_METHODS);
      assert.ok(CORS_ALLOWED_METHODS.includes('GET'));
      assert.ok(CORS_ALLOWED_METHODS.includes('POST'));
      assert.ok(CORS_ALLOWED_METHODS.includes('PUT'));
      assert.ok(CORS_ALLOWED_METHODS.includes('PATCH'));
      assert.ok(CORS_ALLOWED_METHODS.includes('DELETE'));
      assert.ok(CORS_ALLOWED_METHODS.includes('OPTIONS'));

      // Verify allowed and exposed headers
      assert.deepStrictEqual(options.allowedHeaders, CORS_ALLOWED_HEADERS);
      assert.ok(CORS_ALLOWED_HEADERS.includes('Authorization'));
      assert.ok(CORS_ALLOWED_HEADERS.includes('X-Request-Id'));
      assert.ok(CORS_ALLOWED_HEADERS.includes('X-Workspace-Id'));
      assert.ok(CORS_ALLOWED_HEADERS.includes('CF-Connecting-IP'));

      assert.deepStrictEqual(options.exposedHeaders, CORS_EXPOSED_HEADERS);
      assert.ok(CORS_EXPOSED_HEADERS.includes('X-Request-Id'));
      assert.ok(CORS_EXPOSED_HEADERS.includes('Retry-After'));
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

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.headers.get('access-control-allow-origin'), 'http://localhost:3000');
        assert.strictEqual(res.headers.get('access-control-allow-credentials'), 'true');
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

        assert.strictEqual(res.headers.get('access-control-allow-origin'), null);
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

        assert.strictEqual(res.status, 204);
        assert.strictEqual(
          res.headers.get('access-control-allow-origin'),
          'https://app.salescopilot.vn',
        );
        assert.strictEqual(res.headers.get('access-control-allow-credentials'), 'true');
        const methods = res.headers.get('access-control-allow-methods');
        assert.ok(methods?.includes('POST'));
        assert.ok(methods?.includes('GET'));
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

        assert.strictEqual(res.headers.get('access-control-allow-origin'), null);
      } finally {
        await app.close();
      }
    });
  });
});
