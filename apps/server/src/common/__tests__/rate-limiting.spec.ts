import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerStorageService, ThrottlerException } from '@nestjs/throttler';
import { THROTTLER_LIMIT, THROTTLER_TTL } from '@nestjs/throttler/dist/throttler.constants';
import { ThrottlerBehindProxyGuard } from '../guards/throttler-behind-proxy.guard';
import { WebhooksController } from '../../modules/webhooks/webhooks.controller';
import { FacebookController } from '../../integrations/facebook/facebook.controller';
import { MessagesController } from '../../modules/messages/messages.controller';
import { AuthController } from '../../modules/auth/auth.controller';
import { HttpExceptionFilter } from '../filters/http-exception.filter';

describe('Per-Route Rate Limiting & Proxy Tracking (Task 8 — Feature F-1.11.4)', () => {
  class TestableThrottlerBehindProxyGuard extends ThrottlerBehindProxyGuard {
    public override async getTracker(req: Record<string, any>): Promise<string> {
      return super.getTracker(req);
    }
  }

  describe('Client IP Detection Behind Proxies (ThrottlerBehindProxyGuard)', () => {
    const guard = new TestableThrottlerBehindProxyGuard(
      [{ ttl: 60000, limit: 100 }],
      {} as ThrottlerStorageService,
      new Reflector(),
    );

    it('should prioritize cf-connecting-ip for Cloudflare Tunnel requests', async () => {
      const req = {
        headers: {
          'cf-connecting-ip': '203.0.113.195',
          'x-forwarded-for': '198.51.100.1, 10.0.0.1',
          'x-real-ip': '192.0.2.1',
        },
        ip: '127.0.0.1',
      };

      const tracker = await guard.getTracker(req);
      assert.strictEqual(tracker, '203.0.113.195');
    });

    it('should extract first client IP from x-forwarded-for header string', async () => {
      const req = {
        headers: {
          'x-forwarded-for': '198.51.100.42, 10.0.0.2, 172.16.0.1',
        },
        ip: '10.0.0.2',
      };

      const tracker = await guard.getTracker(req);
      assert.strictEqual(tracker, '198.51.100.42');
    });

    it('should extract first client IP from x-forwarded-for header array', async () => {
      const req = {
        headers: {
          'x-forwarded-for': ['203.0.113.50, 10.0.0.5'],
        },
        ip: '10.0.0.5',
      };

      const tracker = await guard.getTracker(req);
      assert.strictEqual(tracker, '203.0.113.50');
    });

    it('should extract x-real-ip when x-forwarded-for is absent', async () => {
      const req = {
        headers: {
          'x-real-ip': '192.0.2.88',
        },
        ip: '127.0.0.1',
      };

      const tracker = await guard.getTracker(req);
      assert.strictEqual(tracker, '192.0.2.88');
    });

    it('should fall back to Express req.ips when present', async () => {
      const req = {
        headers: {},
        ips: ['198.51.100.99', '10.0.0.1'],
        ip: '10.0.0.1',
      };

      const tracker = await guard.getTracker(req);
      assert.strictEqual(tracker, '198.51.100.99');
    });

    it('should fall back to direct req.ip when no proxy headers exist', async () => {
      const req = {
        headers: {},
        ip: '172.16.0.25',
      };

      const tracker = await guard.getTracker(req);
      assert.strictEqual(tracker, '172.16.0.25');
    });

    it('should fall back to 127.0.0.1 if request has no IP properties', async () => {
      const req = {
        headers: {},
      };

      const tracker = await guard.getTracker(req);
      assert.strictEqual(tracker, '127.0.0.1');
    });
  });

  describe('Route Throttle Metadata Verification', () => {
    const reflector = new Reflector();

    it('should configure WebhooksController.handleInboundWebhook with 200 req/min limit', () => {
      const handler = WebhooksController.prototype.handleInboundWebhook;
      const limit = reflector.get(THROTTLER_LIMIT + 'default', handler);
      const ttl = reflector.get(THROTTLER_TTL + 'default', handler);

      assert.strictEqual(limit, 200);
      assert.strictEqual(ttl, 60000);
    });

    it('should configure FacebookController.handleCentralWebhook with 200 req/min limit', () => {
      const handler = FacebookController.prototype.handleCentralWebhook;
      const limit = reflector.get(THROTTLER_LIMIT + 'default', handler);
      const ttl = reflector.get(THROTTLER_TTL + 'default', handler);

      assert.strictEqual(limit, 200);
      assert.strictEqual(ttl, 60000);
    });

    it('should configure MessagesController.create (file upload) with 20 req/min limit', () => {
      const handler = MessagesController.prototype.create;
      const limit = reflector.get(THROTTLER_LIMIT + 'default', handler);
      const ttl = reflector.get(THROTTLER_TTL + 'default', handler);

      assert.strictEqual(limit, 20);
      assert.strictEqual(ttl, 60000);
    });

    it('should configure AuthController.login with 5 req/min limit', () => {
      const handler = AuthController.prototype.login;
      const limit = reflector.get(THROTTLER_LIMIT + 'default', handler);
      const ttl = reflector.get(THROTTLER_TTL + 'default', handler);

      assert.strictEqual(limit, 5);
      assert.strictEqual(ttl, 60000);
    });

    it('should configure AuthController.refresh with 10 req/min limit', () => {
      const handler = AuthController.prototype.refresh;
      const limit = reflector.get(THROTTLER_LIMIT + 'default', handler);
      const ttl = reflector.get(THROTTLER_TTL + 'default', handler);

      assert.strictEqual(limit, 10);
      assert.strictEqual(ttl, 60000);
    });
  });

  describe('Rate Limit Exceeded Enforcement & 429 Status', () => {
    it('should throw ThrottlerException (429) when storage indicates blocked', async () => {
      const mockStorage = {
        increment: async () => ({
          totalHits: 21,
          timeToExpire: 45,
          isBlocked: true,
          timeToBlockExpire: 45,
        }),
      } as unknown as ThrottlerStorageService;

      const reflector = new Reflector();
      const guard = new ThrottlerBehindProxyGuard(
        [{ ttl: 60000, limit: 20 }],
        mockStorage,
        reflector,
      );

      await guard.onModuleInit();

      const req = {
        headers: { 'cf-connecting-ip': '203.0.113.1' },
        ip: '203.0.113.1',
      };
      const res = {
        header: () => {},
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => req,
          getResponse: () => res,
        }),
        getHandler: () => MessagesController.prototype.create,
        getClass: () => MessagesController,
      } as unknown as ExecutionContext;

      await assert.rejects(
        async () => guard.canActivate(context),
        (err: any) => {
          assert.ok(err instanceof ThrottlerException);
          assert.strictEqual(err.getStatus(), 429);
          return true;
        },
      );
    });

    it('should format 429 Too Many Requests into standard error envelope via HttpExceptionFilter', () => {
      const filter = new HttpExceptionFilter();
      let sentStatus = 0;
      let sentBody: any = null;

      const mockResponse = {
        status(code: number) {
          sentStatus = code;
          return this;
        },
        json(body: any) {
          sentBody = body;
          return this;
        },
      };

      const mockRequest = {
        headers: { 'x-request-id': 'req-rate-limit-1' },
        method: 'POST',
        url: '/api/v1/auth/login',
      };

      const host = {
        getType: () => 'http',
        switchToHttp: () => ({
          getResponse: () => mockResponse,
          getRequest: () => mockRequest,
        }),
      } as unknown as any;

      const throttlerException = new ThrottlerException('Too Many Requests');
      filter.catch(throttlerException, host);

      assert.strictEqual(sentStatus, 429);
      assert.strictEqual(sentBody.success, false);
      assert.strictEqual(sentBody.error.code, 'THROTTLER');
      assert.strictEqual(sentBody.error.message, 'Too Many Requests');
    });
  });
});
