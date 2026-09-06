import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { HttpException, HttpStatus } from '@nestjs/common';
import { RateLimiterService } from '../rate-limiter.service';

describe('RateLimiterService (Redis Token Bucket)', () => {
  let service: RateLimiterService;
  let mockRedisClient: any;
  let mockRedisService: any;
  let storage: Map<string, number>;

  beforeEach(() => {
    storage = new Map();

    mockRedisClient = {
      pipeline: () => {
        const commands: Array<() => any> = [];
        const pipe = {
          incr: (key: string) => {
            commands.push(() => {
              const val = (storage.get(key) || 0) + 1;
              storage.set(key, val);
              return [null, val];
            });
            return pipe;
          },
          incrby: (key: string, amount: number) => {
            commands.push(() => {
              const val = (storage.get(key) || 0) + amount;
              storage.set(key, val);
              return [null, val];
            });
            return pipe;
          },
          expire: (_key: string, _ttl: number) => {
            commands.push(() => [null, 1]);
            return pipe;
          },
          exec: async () => {
            return commands.map(cmd => cmd());
          },
        };
        return pipe;
      },
      incrby: async (key: string, amount: number) => {
        const val = (storage.get(key) || 0) + amount;
        storage.set(key, val);
        return val;
      },
      decrby: async (key: string, amount: number) => {
        const val = (storage.get(key) || 0) - amount;
        storage.set(key, val);
        return val;
      },
    };

    mockRedisService = {
      getClient: () => mockRedisClient,
    };

    service = new RateLimiterService(mockRedisService);
  });

  it('should accurately estimate tokens from string length', () => {
    const text = 'Xin chào, tôi cần báo giá sản phẩm CRM cho doanh nghiệp.';
    const estimated = service.estimateTokens(text);
    assert.ok(estimated > 10 && estimated < 25);
  });

  it('should allow requests within workspace quota limits', async () => {
    const wsId = 'ws_standard_tenant';
    const result = await service.checkAndReserve(wsId, 500, 'STANDARD');

    assert.strictEqual(result.remainingRpm, 119); // 120 - 1
    assert.strictEqual(result.remainingTpm, 199_500); // 200,000 - 500
  });

  it('should reject requests exceeding RPM quota with HTTP 429', async () => {
    const wsId = 'ws_standard_tenant';
    const currentMinute = Math.floor(Date.now() / 60_000);
    storage.set(`ws:${wsId}:llm:rpm:${currentMinute}`, 120); // At limit

    await assert.rejects(
      async () => {
        await service.checkAndReserve(wsId, 100, 'STANDARD');
      },
      (err: any) => {
        assert.ok(err instanceof HttpException);
        assert.strictEqual(err.getStatus(), HttpStatus.TOO_MANY_REQUESTS);
        const response = err.getResponse() as any;
        assert.strictEqual(response.code, 'WORKSPACE_LLM_QUOTA_EXCEEDED');
        assert.ok(response.details.retryAfterSeconds > 0);
        return true;
      },
    );
  });

  it('should reject requests exceeding TPM quota with HTTP 429', async () => {
    const wsId = 'ws_standard_tenant';
    const currentMinute = Math.floor(Date.now() / 60_000);
    storage.set(`ws:${wsId}:llm:tpm:${currentMinute}`, 199_800); // Near limit

    await assert.rejects(
      async () => {
        // Request estimating 500 tokens -> would exceed 200,000
        await service.checkAndReserve(wsId, 500, 'STANDARD');
      },
      (err: any) => {
        assert.ok(err instanceof HttpException);
        assert.strictEqual(err.getStatus(), HttpStatus.TOO_MANY_REQUESTS);
        const response = err.getResponse() as any;
        assert.strictEqual(response.code, 'WORKSPACE_LLM_QUOTA_EXCEEDED');
        return true;
      },
    );
  });

  it('should reconcile actual usage accurately', async () => {
    const wsId = 'ws_test_reconcile';
    const currentMinute = Math.floor(Date.now() / 60_000);
    const key = `ws:${wsId}:llm:tpm:${currentMinute}`;
    storage.set(key, 1000); // 1000 was reserved initially

    // Actual usage was only 800 (overestimated by 200)
    await service.recordActualUsage(wsId, 800, 1000);
    assert.strictEqual(storage.get(key), 800);

    // Later actual usage was 1200 (underestimated by 200)
    await service.recordActualUsage(wsId, 1200, 1000);
    assert.strictEqual(storage.get(key), 1000);
  });

  it('should gracefully bypass when Redis client is unavailable', async () => {
    const noRedisService = { getClient: () => null };
    const fallbackService = new RateLimiterService(noRedisService as any);

    const result = await fallbackService.checkAndReserve('ws_any', 500, 'FREE');
    assert.strictEqual(result.remainingRpm, 30);
    assert.strictEqual(result.remainingTpm, 50_000);
  });
});
