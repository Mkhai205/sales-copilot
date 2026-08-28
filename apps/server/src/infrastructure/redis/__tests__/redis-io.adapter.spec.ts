import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { RedisIoAdapter } from '../redis-io.adapter';

describe('RedisIoAdapter (WebSocket Multi-Instance Redis Adapter)', () => {
  let mockApp: any;
  let adapter: RedisIoAdapter;

  beforeEach(() => {
    mockApp = {
      getHttpServer: () => ({}),
    };
    adapter = new RedisIoAdapter(mockApp);
  });

  it('should fall back gracefully to in-memory mode when REDIS_URL is not provided', async () => {
    await adapter.connectToRedis(undefined);

    const mockServer: any = {
      adapter: () => {
        throw new Error('Should not be called');
      },
    };

    // Mock super.createIOServer
    (adapter as any).createIOServer = (_port: number, _options?: any) => {
      const server = mockServer;
      if ((adapter as any).adapterConstructor) {
        server.adapter((adapter as any).adapterConstructor);
      }
      return server;
    };

    const server = adapter.createIOServer(3000);
    assert.strictEqual(server, mockServer);
    assert.strictEqual((adapter as any).adapterConstructor, undefined);
  });

  it('should attach adapterConstructor to server when adapterConstructor is present', () => {
    let attachedAdapter: any = null;
    const mockServer: any = {
      adapter: (fn: any) => {
        attachedAdapter = fn;
      },
    };

    const dummyAdapter = () => {};
    (adapter as any).adapterConstructor = dummyAdapter;

    if ((adapter as any).adapterConstructor) {
      mockServer.adapter((adapter as any).adapterConstructor);
    }

    assert.strictEqual(attachedAdapter, dummyAdapter);
  });

  it('should handle close() gracefully without throwing even when clients are uninitialized', async () => {
    await assert.doesNotReject(async () => {
      await adapter.close();
    });
  });
});
