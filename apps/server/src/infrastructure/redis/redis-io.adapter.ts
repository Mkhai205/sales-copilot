import { Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, RedisClientType } from 'redis';
import { Server, ServerOptions } from 'socket.io';

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor?: ReturnType<typeof createAdapter>;
  private pubClient?: RedisClientType;
  private subClient?: RedisClientType;

  async connectToRedis(redisUrl?: string): Promise<void> {
    if (!redisUrl) {
      this.logger.log(
        'REDIS_URL not configured. Operating WebSockets in single-server in-memory mode',
      );
      return;
    }

    try {
      this.pubClient = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries: number) => {
            if (retries > 2) {
              return false; // Prevent process hang on repeated failures
            }
            return Math.min(retries * 50, 200);
          },
        },
      }) as RedisClientType;

      this.subClient = this.pubClient.duplicate() as RedisClientType;

      this.pubClient.on('error', (err: Error) => {
        this.logger.warn(`Redis adapter pubClient error: ${err.message}`);
      });

      this.subClient.on('error', (err: Error) => {
        this.logger.warn(`Redis adapter subClient error: ${err.message}`);
      });

      await Promise.all([this.pubClient.connect(), this.subClient.connect()]);

      this.adapterConstructor = createAdapter(this.pubClient, this.subClient);
      this.logger.log(
        '✅ Socket.io Redis Pub/Sub Adapter initialized successfully for horizontal scaling',
      );
    } catch (err) {
      this.logger.warn(
        `Failed to initialize Redis adapter (${(err as Error).message}). Falling back to single-server in-memory adapter`,
      );
      await this.cleanupRedisClients();
    }
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    const server: Server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }

  override async close(server?: any): Promise<void> {
    if (server) {
      super.close(server);
    }
    await this.cleanupRedisClients();
  }

  private async cleanupRedisClients(): Promise<void> {
    if (this.pubClient?.isOpen) {
      try {
        await this.pubClient.quit();
      } catch (err) {
        this.logger.warn(`Error disconnecting Redis adapter pubClient: ${(err as Error).message}`);
      }
    }
    this.pubClient = undefined;

    if (this.subClient?.isOpen) {
      try {
        await this.subClient.quit();
      } catch (err) {
        this.logger.warn(`Error disconnecting Redis adapter subClient: ${(err as Error).message}`);
      }
    }
    this.subClient = undefined;
  }
}
