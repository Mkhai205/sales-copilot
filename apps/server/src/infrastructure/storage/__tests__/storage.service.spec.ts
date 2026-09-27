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
    expect(url).toBe('http://cdn.example.com/test-bucket/avatars/usr_123.png');
  });

  it('should upload buffer/body to bucket', async () => {
    const buffer = Buffer.from('test content');
    await storageService.upload(buffer, 'text/plain', 'test/doc.txt');

    expect(commandsSent.length).toBe(1);
    expect(commandsSent[0].input.Bucket).toBe('test-bucket');
    expect(commandsSent[0].input.Key).toBe('test/doc.txt');
    expect(commandsSent[0].input.ContentType).toBe('text/plain');
  });

  it('should delete object from bucket', async () => {
    await storageService.delete('test/doc.txt');

    expect(commandsSent.length).toBe(1);
    expect(commandsSent[0].input.Bucket).toBe('test-bucket');
    expect(commandsSent[0].input.Key).toBe('test/doc.txt');
  });

  it('should check if object exists in bucket', async () => {
    const exists = await storageService.exists('existing_key.png');
    expect(exists).toBe(true);

    const notExists = await storageService.exists('non_existing_key.png');
    expect(notExists).toBe(false);
  });

  it('should retrieve object stream', async () => {
    const stream = await storageService.getObjectStream('test/doc.txt');
    expect(stream).toBe('mock_stream' as any);
  });

  it('should respond to ping healthcheck with status up', async () => {
    const health = await storageService.ping();
    expect(health.status).toBe('up');
    expect(typeof health.latencyMs === 'number').toBeTruthy();
  });

  it('should report status down when S3 ping fails', async () => {
    (storageService as any).s3Client = {
      send: async () => {
        throw new Error('S3 connection timeout');
      },
    };

    const health = await storageService.ping();
    expect(health.status).toBe('down');
    expect(health.error).toBe('S3 connection timeout');
  });

  it('should sanitize leading slashes in getPublicUrl to prevent double slashes', () => {
    const url = storageService.getPublicUrl('/avatars/usr_123.png');
    expect(url).toBe('http://cdn.example.com/test-bucket/avatars/usr_123.png');
    const urlMultiple = storageService.getPublicUrl('///avatars/usr_123.png');
    expect(urlMultiple).toBe('http://cdn.example.com/test-bucket/avatars/usr_123.png');
  });

  describe('extractStorageKey', () => {
    it('should extract relative key from relative path input', () => {
      expect(storageService.extractStorageKey('avatars/inboxes/ws1/img.png')).toBe(
        'avatars/inboxes/ws1/img.png',
      );
    });

    it('should strip leading slashes from relative storage key', () => {
      expect(storageService.extractStorageKey('/avatars/inboxes/ws1/img.png')).toBe(
        'avatars/inboxes/ws1/img.png',
      );
      expect(storageService.extractStorageKey('///avatars/inboxes/ws1/img.png')).toBe(
        'avatars/inboxes/ws1/img.png',
      );
    });

    it('should extract relative key from localhost MinIO URL', () => {
      expect(
        storageService.extractStorageKey(
          'http://localhost:9000/test-bucket/avatars/inboxes/ws1/img.png',
        ),
      ).toBe('avatars/inboxes/ws1/img.png');
      expect(
        storageService.extractStorageKey(
          'http://localhost:9000/sales-copilot/avatars/inboxes/ws1/img.png',
        ),
      ).toBe('avatars/inboxes/ws1/img.png');
    });

    it('should extract relative key from tunnel kakadev MinIO URL', () => {
      expect(
        storageService.extractStorageKey(
          'https://storage-sales-copilot.kakadev.xyz/sales-copilot/avatars/inboxes/ws1/img.png',
        ),
      ).toBe('avatars/inboxes/ws1/img.png');
      expect(
        storageService.extractStorageKey(
          'https://storage-sales-copilot.kakadev.xyz/test-bucket/avatars/inboxes/ws1/img.png',
        ),
      ).toBe('avatars/inboxes/ws1/img.png');
    });

    it('should extract relative key from configured STORAGE_PUBLIC_ENDPOINT URL', () => {
      expect(
        storageService.extractStorageKey(
          'http://cdn.example.com/test-bucket/avatars/inboxes/ws1/img.png',
        ),
      ).toBe('avatars/inboxes/ws1/img.png');
    });

    it('should pass through external third-party CDN URLs untouched', () => {
      const unsplash = 'https://images.unsplash.com/photo-12345?auto=format';
      expect(storageService.extractStorageKey(unsplash)).toBe(unsplash);

      const facebook =
        'https://platform-lookaside.fbsbx.com/platform/profilepic/?psid=12345&width=100';
      expect(storageService.extractStorageKey(facebook)).toBe(facebook);

      const telegram = 'https://api.telegram.org/file/bot123/photos/file_0.jpg';
      expect(storageService.extractStorageKey(telegram)).toBe(telegram);
    });

    it('should handle null, undefined, empty, or whitespace-only strings gracefully', () => {
      expect(storageService.extractStorageKey(null as any)).toBe('');
      expect(storageService.extractStorageKey(undefined as any)).toBe('');
      expect(storageService.extractStorageKey('')).toBe('');
      expect(storageService.extractStorageKey('   ')).toBe('');
    });
  });

  describe('resolvePublicUrl', () => {
    it('should return null for null, undefined, empty, or whitespace input', () => {
      expect(storageService.resolvePublicUrl(null)).toBeNull();
      expect(storageService.resolvePublicUrl(undefined)).toBeNull();
      expect(storageService.resolvePublicUrl('')).toBeNull();
      expect(storageService.resolvePublicUrl('   ')).toBeNull();
    });

    it('should resolve relative storage key against STORAGE_PUBLIC_ENDPOINT and bucket', () => {
      const resolved = storageService.resolvePublicUrl('avatars/inboxes/ws1/img.png');
      expect(resolved).toBe('http://cdn.example.com/test-bucket/avatars/inboxes/ws1/img.png');
    });

    it('should strip leading slashes before resolving relative key', () => {
      const resolved = storageService.resolvePublicUrl('/avatars/inboxes/ws1/img.png');
      expect(resolved).toBe('http://cdn.example.com/test-bucket/avatars/inboxes/ws1/img.png');
    });

    it('should re-normalize legacy localhost MinIO full URL to current public endpoint', () => {
      const legacyLocalhost = 'http://localhost:9000/test-bucket/avatars/inboxes/ws1/img.png';
      expect(storageService.resolvePublicUrl(legacyLocalhost)).toBe(
        'http://cdn.example.com/test-bucket/avatars/inboxes/ws1/img.png',
      );
    });

    it('should re-normalize legacy tunnel MinIO full URL to current public endpoint', () => {
      const legacyTunnel =
        'https://storage-sales-copilot.kakadev.xyz/sales-copilot/avatars/inboxes/ws1/img.png';
      expect(storageService.resolvePublicUrl(legacyTunnel)).toBe(
        'http://cdn.example.com/test-bucket/avatars/inboxes/ws1/img.png',
      );
    });

    it('should pass through external third-party CDN URLs untouched', () => {
      const external = 'https://images.unsplash.com/photo-12345?auto=format';
      expect(storageService.resolvePublicUrl(external)).toBe(external);
    });

    it('should pass through data URLs untouched', () => {
      const dataUrl =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      expect(storageService.resolvePublicUrl(dataUrl)).toBe(dataUrl);
    });

    it('should be idempotent when called on already resolved public URLs', () => {
      const resolvedOnce = storageService.resolvePublicUrl('avatars/inboxes/ws1/img.png');
      const resolvedTwice = storageService.resolvePublicUrl(resolvedOnce);
      expect(resolvedTwice).toBe(resolvedOnce);
    });
  });
});
