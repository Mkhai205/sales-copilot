import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const redisUrl = this.configService.getOrThrow<string>('REDIS_URL');

    try {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 1000, 5000);
          return delay;
        },
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log('✅ Redis client connected successfully');
      });

      this.client.on('error', (err: Error) => {
        this.isConnected = false;
        this.logger.warn(`Redis connection error: ${err.message}`);
      });

      this.client.on('close', () => {
        this.isConnected = false;
      });
    } catch (error) {
      this.logger.error('Failed to initialize Redis client:', error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
        this.logger.log('🔌 Redis client disconnected gracefully');
      } catch (err) {
        this.logger.error('Error during Redis disconnection:', err);
      }
    }
  }

  getClient(): Redis | null {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    try {
      return await this.client.get(key);
    } catch (err) {
      this.logger.error(`Redis GET error for key ${key}:`, err);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.client) return;
    try {
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
    } catch (err) {
      this.logger.error(`Redis SET error for key ${key}:`, err);
    }
  }

  async setex(key: string, seconds: number, value: string): Promise<void> {
    return this.set(key, value, seconds);
  }

  async del(keyOrKeys: string | string[]): Promise<number> {
    if (!this.client) return 0;
    try {
      const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
      if (keys.length === 0) return 0;
      return await this.client.del(...keys);
    } catch (err) {
      this.logger.error(`Redis DEL error:`, err);
      return 0;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client) return false;
    try {
      const count = await this.client.exists(key);
      return count > 0;
    } catch (err) {
      this.logger.error(`Redis EXISTS error for key ${key}:`, err);
      return false;
    }
  }

  async incr(key: string): Promise<number> {
    if (!this.client) return 0;
    try {
      return await this.client.incr(key);
    } catch (err) {
      this.logger.error(`Redis INCR error for key ${key}:`, err);
      return 0;
    }
  }

  async decr(key: string): Promise<number> {
    if (!this.client) return 0;
    try {
      return await this.client.decr(key);
    } catch (err) {
      this.logger.error(`Redis DECR error for key ${key}:`, err);
      return 0;
    }
  }

  async hget(key: string, field: string): Promise<string | null> {
    if (!this.client) return null;
    try {
      return await this.client.hget(key, field);
    } catch (err) {
      this.logger.error(`Redis HGET error for key ${key}, field ${field}:`, err);
      return null;
    }
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    if (!this.client) return 0;
    try {
      return await this.client.hset(key, field, value);
    } catch (err) {
      this.logger.error(`Redis HSET error for key ${key}, field ${field}:`, err);
      return 0;
    }
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    if (!this.client || fields.length === 0) return 0;
    try {
      return await this.client.hdel(key, ...fields);
    } catch (err) {
      this.logger.error(`Redis HDEL error for key ${key}:`, err);
      return 0;
    }
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    if (!this.client) return {};
    try {
      return await this.client.hgetall(key);
    } catch (err) {
      this.logger.error(`Redis HGETALL error for key ${key}:`, err);
      return {};
    }
  }

  async mget(keys: string[]): Promise<(string | null)[]> {
    if (!this.client || keys.length === 0) return [];
    try {
      return await this.client.mget(...keys);
    } catch (err) {
      this.logger.error(`Redis MGET error:`, err);
      return keys.map(() => null);
    }
  }

  async ttl(key: string): Promise<number> {
    if (!this.client) return -2;
    try {
      return await this.client.ttl(key);
    } catch (err) {
      this.logger.error(`Redis TTL error for key ${key}:`, err);
      return -2;
    }
  }

  /**
   * Scans for keys matching a pattern using SCAN (non-blocking, production-safe).
   * NOTE: Avoid calling this in hot paths — use dedicated index structures (Sets) instead.
   */
  async scan(pattern: string): Promise<string[]> {
    if (!this.client) return [];
    try {
      const results: string[] = [];
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        results.push(...keys);
      } while (cursor !== '0');
      return results;
    } catch (err) {
      this.logger.error(`Redis SCAN error for pattern ${pattern}:`, err);
      return [];
    }
  }

  /**
   * Healthcheck function to verify Redis connectivity and roundtrip latency.
   */
  async ping(): Promise<{ status: 'up' | 'down'; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      if (!this.client) {
        throw new Error('Redis client is not initialized');
      }
      const response = await this.client.ping();
      const latencyMs = Date.now() - start;
      if (response !== 'PONG') {
        throw new Error(`Unexpected ping response: ${response}`);
      }
      return { status: 'up', latencyMs };
    } catch (err) {
      const latencyMs = Date.now() - start;
      return {
        status: 'down',
        latencyMs,
        error: (err as Error)?.message || 'Redis unreachable',
      };
    }
  }

  async isHealthy(): Promise<boolean> {
    const health = await this.ping();
    return health.status === 'up';
  }
}
