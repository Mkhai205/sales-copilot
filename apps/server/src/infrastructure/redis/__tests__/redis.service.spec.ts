import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis.service';

describe('RedisService (Cache & Data Store Operations)', () => {
  let redisService: RedisService;
  let mockConfigService: Partial<ConfigService>;
  let memoryStore: Map<string, string>;
  let hashStore: Map<string, Map<string, string>>;
  let listStore: Map<string, string[]>;

  beforeEach(() => {
    memoryStore = new Map();
    hashStore = new Map();
    listStore = new Map();

    mockConfigService = {
      getOrThrow: <T = string>(key: string): T => {
        if (key === 'REDIS_URL') return 'redis://localhost:6379' as unknown as T;
        throw new Error(`Config key ${key} not found`);
      },
    };

    redisService = new RedisService(mockConfigService as ConfigService);

    const mockClient = {
      get: async (key: string) => memoryStore.get(key) ?? null,
      set: async (key: string, value: string, ...args: any[]) => {
        if (args.includes('NX') && memoryStore.has(key)) {
          return null;
        }
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
      lrange: async (key: string, start: number, stop: number) => {
        const list = listStore.get(key) || [];
        const end = stop === -1 ? list.length : stop + 1;
        return list.slice(start, end);
      },
      rpush: async (key: string, ...values: string[]) => {
        const list = listStore.get(key) || [];
        list.push(...values);
        listStore.set(key, list);
        return list.length;
      },
      lpush: async (key: string, ...values: string[]) => {
        const list = listStore.get(key) || [];
        list.unshift(...values);
        listStore.set(key, list);
        return list.length;
      },
      lrem: async (key: string, count: number, value: string) => {
        const list = listStore.get(key) || [];
        const filtered = list.filter(v => v !== value);
        const removed = list.length - filtered.length;
        listStore.set(key, filtered);
        return removed;
      },
      eval: async (_script: string, _numKeys: number, key: string, token: string) => {
        if (memoryStore.get(key) === token) {
          memoryStore.delete(key);
          return 1;
        }
        return 0;
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

  it('should support list operations (rpush, lrange, lpush, lrem)', async () => {
    await redisService.rpush('queue:1', 'agent_1', 'agent_2');
    let items = await redisService.lrange('queue:1');
    assert.deepStrictEqual(items, ['agent_1', 'agent_2']);

    await redisService.lpush('queue:1', 'agent_0');
    items = await redisService.lrange('queue:1');
    assert.deepStrictEqual(items, ['agent_0', 'agent_1', 'agent_2']);

    const removed = await redisService.lrem('queue:1', 0, 'agent_1');
    assert.strictEqual(removed, 1);
    items = await redisService.lrange('queue:1');
    assert.deepStrictEqual(items, ['agent_0', 'agent_2']);
  });

  it('should support acquiring and releasing distributed locks', async () => {
    const lockKey = 'lock:auto_assign:inbox_123';

    // 1. First acquire succeeds
    const token1 = await redisService.acquireLock(lockKey, 3000);
    assert.ok(token1 !== null);

    // 2. Second acquire fails while lock held
    const token2 = await redisService.acquireLock(lockKey, 3000);
    assert.strictEqual(token2, null);

    // 3. Release with wrong token fails
    const releasedWrong = await redisService.releaseLock(lockKey, 'wrong_token');
    assert.strictEqual(releasedWrong, false);

    // 4. Release with correct token succeeds
    const releasedCorrect = await redisService.releaseLock(lockKey, token1);
    assert.strictEqual(releasedCorrect, true);

    // 5. Can acquire again after release
    const token3 = await redisService.acquireLock(lockKey, 3000);
    assert.ok(token3 !== null);
  });
});
