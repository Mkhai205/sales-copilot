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
        lazyConnect: true,
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

  async isHealthy(): Promise<boolean> {
    if (!this.client || !this.isConnected) return false;
    try {
      const ping = await this.client.ping();
      return ping === 'PONG';
    } catch {
      return false;
    }
  }
}
