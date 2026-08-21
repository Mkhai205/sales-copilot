import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis.service';

describe('RedisService (Cache & Data Store Operations)', () => {
  let redisService: RedisService;
  let mockConfigService: Partial<ConfigService>;
  let memoryStore: Map<string, string>;
  let hashStore: Map<string, Map<string, string>>;

  beforeEach(() => {
    memoryStore = new Map();
    hashStore = new Map();

    mockConfigService = {
      getOrThrow: <T = string>(key: string): T => {
        if (key === 'REDIS_URL') return 'redis://localhost:6379' as unknown as T;
        throw new Error(`Config key ${key} not found`);
      },
    };

    redisService = new RedisService(mockConfigService as ConfigService);

    // Mock client internal methods for unit testing without a live Redis server
    const mockClient = {
      get: async (key: string) => memoryStore.get(key) ?? null,
      set: async (key: string, value: string, ..._args: any[]) => {
        memoryStore.set(key, value);
        return 'OK';
      },
      del: async (...keys: string[]) => {
        let count = 0;
        for (const k of keys) {
          if (memoryStore.delete(k)) count++;
        }
        return count;
      },
      exists: async (key: string) => (memoryStore.has(key) ? 1 : 0),
      incr: async (key: string) => {
        const val = parseInt(memoryStore.get(key) || '0', 10) + 1;
        memoryStore.set(key, val.toString());
        return val;
      },
      decr: async (key: string) => {
        const val = parseInt(memoryStore.get(key) || '0', 10) - 1;
        memoryStore.set(key, val.toString());
        return val;
      },
      hget: async (key: string, field: string) => {
        const map = hashStore.get(key);
        return map?.get(field) ?? null;
      },
      hset: async (key: string, field: string, value: string) => {
        let map = hashStore.get(key);
        if (!map) {
          map = new Map();
          hashStore.set(key, map);
        }
        const isNew = !map.has(field);
        map.set(field, value);
        return isNew ? 1 : 0;
      },
      hdel: async (key: string, ...fields: string[]) => {
        const map = hashStore.get(key);
        if (!map) return 0;
        let count = 0;
        for (const f of fields) {
          if (map.delete(f)) count++;
        }
        return count;
      },
      hgetall: async (key: string) => {
        const map = hashStore.get(key);
        if (!map) return {};
        return Object.fromEntries(map.entries());
      },
      mget: async (...keys: string[]) => {
        return keys.map(k => memoryStore.get(k) ?? null);
      },
      ttl: async (key: string) => {
        return memoryStore.has(key) ? 3600 : -2;
      },
      ping: async () => 'PONG',
      quit: async () => 'OK',
    };

    (redisService as any).client = mockClient;
    (redisService as any).isConnected = true;
  });

  it('should get, set and delete key values', async () => {
    await redisService.set('test_key', 'hello_world', 60);
    assert.strictEqual(await redisService.get('test_key'), 'hello_world');
    assert.strictEqual(await redisService.exists('test_key'), true);

    const deletedCount = await redisService.del('test_key');
    assert.strictEqual(deletedCount, 1);
    assert.strictEqual(await redisService.get('test_key'), null);
    assert.strictEqual(await redisService.exists('test_key'), false);
  });

  it('should support atomic incr and decr counters', async () => {
    assert.strictEqual(await redisService.incr('rate_limit:user1'), 1);
    assert.strictEqual(await redisService.incr('rate_limit:user1'), 2);
    assert.strictEqual(await redisService.decr('rate_limit:user1'), 1);
  });

  it('should support hash operations (hset, hget, hdel, hgetall)', async () => {
    await redisService.hset('session:123', 'ip', '127.0.0.1');
    await redisService.hset('session:123', 'userAgent', 'Mozilla');

    assert.strictEqual(await redisService.hget('session:123', 'ip'), '127.0.0.1');
    assert.strictEqual(await redisService.hget('session:123', 'nonexistent'), null);

    const all = await redisService.hgetall('session:123');
    assert.deepStrictEqual(all, { ip: '127.0.0.1', userAgent: 'Mozilla' });

    const deleted = await redisService.hdel('session:123', 'ip');
    assert.strictEqual(deleted, 1);
    assert.strictEqual(await redisService.hget('session:123', 'ip'), null);
  });

  it('should support batch mget and ttl lookups', async () => {
    await redisService.set('k1', 'v1');
    await redisService.set('k2', 'v2');

    const values = await redisService.mget(['k1', 'k2', 'k3']);
    assert.deepStrictEqual(values, ['v1', 'v2', null]);

    const ttl = await redisService.ttl('k1');
    assert.strictEqual(ttl, 3600);
    const nonExistentTtl = await redisService.ttl('k_unknown');
    assert.strictEqual(nonExistentTtl, -2);
  });

  it('should respond to ping healthcheck with status up', async () => {
    const health = await redisService.ping();
    assert.strictEqual(health.status, 'up');
    assert.ok(typeof health.latencyMs === 'number');
    assert.strictEqual(await redisService.isHealthy(), true);
  });

  it('should report status down when ping fails', async () => {
    (redisService as any).client = {
      ping: async () => {
        throw new Error('Connection refused');
      },
    };

    const health = await redisService.ping();
    assert.strictEqual(health.status, 'down');
    assert.strictEqual(health.error, 'Connection refused');
    assert.strictEqual(await redisService.isHealthy(), false);
  });
});
