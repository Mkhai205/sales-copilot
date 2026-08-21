import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../storage.service';

describe('StorageService (S3 / MinIO Storage Operations)', () => {
  let storageService: StorageService;
  let mockConfigService: Partial<ConfigService>;
  let commandsSent: any[];

  beforeEach(() => {
    commandsSent = [];

    mockConfigService = {
      getOrThrow: <T = string>(key: string): T => {
        const configMap: Record<string, string> = {
          STORAGE_ENDPOINT: 'http://localhost:9000',
          STORAGE_PUBLIC_ENDPOINT: 'http://cdn.example.com',
          STORAGE_BUCKETS: 'test-bucket',
          STORAGE_ACCESS_KEY: 'test-access-key',
          STORAGE_SECRET_KEY: 'test-secret-key',
        };
        if (configMap[key]) return configMap[key] as unknown as T;
        throw new Error(`Missing config: ${key}`);
      },
      get: <T = unknown>(key: string, defaultValue?: T): T => {
        if (key === 'STORAGE_REGION') return 'us-east-1' as unknown as T;
        if (key === 'STORAGE_PRESIGNED_URL_EXPIRES_IN_SECONDS') return 900 as unknown as T;
        return defaultValue as T;
      },
    };

    storageService = new StorageService(mockConfigService as ConfigService);

    // Mock s3Client.send
    const mockS3Client = {
      send: async (command: any) => {
        commandsSent.push(command);
        if (command.constructor.name === 'HeadBucketCommand') {
          return {};
        }
        if (command.constructor.name === 'HeadObjectCommand') {
          if (command.input?.Key === 'existing_key.png') {
            return {};
          }
          const err: any = new Error('NotFound');
          err.name = 'NotFound';
          throw err;
        }
        if (command.constructor.name === 'GetObjectCommand') {
          return { Body: 'mock_stream' };
        }
        return {};
      },
      destroy: () => {},
    };

    (storageService as any).s3Client = mockS3Client;
  });

  it('should generate correct public URLs', () => {
    const url = storageService.getPublicUrl('avatars/usr_123.png');
    assert.strictEqual(url, 'http://cdn.example.com/test-bucket/avatars/usr_123.png');
  });

  it('should upload buffer/body to bucket', async () => {
    const buffer = Buffer.from('test content');
    await storageService.upload(buffer, 'text/plain', 'test/doc.txt');

    assert.strictEqual(commandsSent.length, 1);
    assert.strictEqual(commandsSent[0].input.Bucket, 'test-bucket');
    assert.strictEqual(commandsSent[0].input.Key, 'test/doc.txt');
    assert.strictEqual(commandsSent[0].input.ContentType, 'text/plain');
  });

  it('should delete object from bucket', async () => {
    await storageService.delete('test/doc.txt');

    assert.strictEqual(commandsSent.length, 1);
    assert.strictEqual(commandsSent[0].input.Bucket, 'test-bucket');
    assert.strictEqual(commandsSent[0].input.Key, 'test/doc.txt');
  });

  it('should check if object exists in bucket', async () => {
    const exists = await storageService.exists('existing_key.png');
    assert.strictEqual(exists, true);

    const notExists = await storageService.exists('non_existing_key.png');
    assert.strictEqual(notExists, false);
  });

  it('should retrieve object stream', async () => {
    const stream = await storageService.getObjectStream('test/doc.txt');
    assert.strictEqual(stream, 'mock_stream' as any);
  });

  it('should respond to ping healthcheck with status up', async () => {
    const health = await storageService.ping();
    assert.strictEqual(health.status, 'up');
    assert.ok(typeof health.latencyMs === 'number');
  });

  it('should report status down when S3 ping fails', async () => {
    (storageService as any).s3Client = {
      send: async () => {
        throw new Error('S3 connection timeout');
      },
    };

    const health = await storageService.ping();
    assert.strictEqual(health.status, 'down');
    assert.strictEqual(health.error, 'S3 connection timeout');
  });
});
