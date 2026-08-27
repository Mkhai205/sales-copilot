import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { ChannelCredentialService } from '../channel-credential.service';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import * as crypto from 'crypto';

describe('ChannelCredentialService (AES-256-GCM Credential Encryption & Security)', () => {
  let service: ChannelCredentialService;
  let mockConfigService: any;
  const sampleHexKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  beforeEach(() => {
    mockConfigService = {
      get: (key: string) => {
        if (key === 'CHANNEL_ENCRYPTION_KEY') {
          return sampleHexKey;
        }
        return undefined;
      },
    };

    service = new ChannelCredentialService(mockConfigService as unknown as ConfigService);
  });

  describe('Encryption and Decryption Roundtrip', () => {
    it('should encrypt and decrypt a standard credential payload successfully', () => {
      const credentials = {
        botToken: '1234567890:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
        appSecret: 'super_secret_webhook_key_xyz_987',
        channelType: 'TELEGRAM',
      };

      const encrypted = service.encrypt(credentials);
      assert.ok(typeof encrypted === 'string');
      assert.ok(encrypted.length > 0);

      // Verify format is iv:authTag:ciphertext
      const parts = encrypted.split(':');
      assert.strictEqual(
        parts.length,
        3,
        'Ciphertext must contain exactly 3 colon-separated parts',
      );

      const decrypted = service.decrypt<typeof credentials>(encrypted);
      assert.deepStrictEqual(decrypted, credentials);
    });

    it('should handle complex nested structures with arrays, unicode and numbers', () => {
      const complexCredentials = {
        name: 'Kênh Hỗ Trợ Khách Hàng Zalo OA (Chính thức)',
        oaId: '192837465019283',
        settings: {
          autoReply: true,
          retryAttempts: 5,
          timeoutMs: 3000,
          allowedIps: ['127.0.0.1', '192.168.1.1', '10.0.0.1'],
          metadata: {
            appId: 'app_999',
            roles: ['ADMIN', 'OPERATOR'],
          },
        },
        nullField: null,
      };

      const encrypted = service.encrypt(complexCredentials);
      const decrypted = service.decrypt<typeof complexCredentials>(encrypted);

      assert.deepStrictEqual(decrypted, complexCredentials);
    });

    it('should encrypt and decrypt empty object payload', () => {
      const emptyPayload = {};
      const encrypted = service.encrypt(emptyPayload);
      const decrypted = service.decrypt<Record<string, unknown>>(encrypted);

      assert.deepStrictEqual(decrypted, emptyPayload);
    });
  });

  describe('Cryptographic Invariants & IV Randomness', () => {
    it('should generate a unique random IV for every encryption call (never reuse IVs)', () => {
      const payload = { accessToken: 'shared_access_token_12345' };

      const encrypted1 = service.encrypt(payload);
      const encrypted2 = service.encrypt(payload);
      const encrypted3 = service.encrypt(payload);

      assert.notStrictEqual(encrypted1, encrypted2);
      assert.notStrictEqual(encrypted2, encrypted3);
      assert.notStrictEqual(encrypted1, encrypted3);

      const [iv1] = encrypted1.split(':');
      const [iv2] = encrypted2.split(':');
      const [iv3] = encrypted3.split(':');

      assert.notStrictEqual(iv1, iv2);
      assert.notStrictEqual(iv2, iv3);

      // All must decrypt to the original payload
      assert.deepStrictEqual(service.decrypt(encrypted1), payload);
      assert.deepStrictEqual(service.decrypt(encrypted2), payload);
      assert.deepStrictEqual(service.decrypt(encrypted3), payload);
    });
  });

  describe('Tamper Detection & Integrity Verification', () => {
    it('should throw InternalServerErrorException when ciphertext body is tampered', () => {
      const payload = { token: 'valid_secure_token' };
      const encrypted = service.encrypt(payload);
      const [iv, authTag, ciphertext] = encrypted.split(':');

      // Tamper ciphertext by modifying characters
      const tamperedCiphertext =
        ciphertext.slice(0, -2) + (ciphertext.slice(-2) === 'AA' ? 'BB' : 'AA');
      const tamperedEncrypted = `${iv}:${authTag}:${tamperedCiphertext}`;

      assert.throws(
        () => service.decrypt(tamperedEncrypted),
        (err: any) => {
          assert.ok(err instanceof InternalServerErrorException);
          assert.strictEqual(
            (err.getResponse() as any).code,
            'CHANNEL_CREDENTIAL_DECRYPTION_FAILED',
          );
          return true;
        },
      );
    });

    it('should throw InternalServerErrorException when auth tag is tampered', () => {
      const payload = { token: 'valid_secure_token' };
      const encrypted = service.encrypt(payload);
      const [iv, authTag, ciphertext] = encrypted.split(':');

      // Tamper auth tag
      const tamperedAuthTag = authTag.slice(0, -2) + (authTag.slice(-2) === '11' ? '22' : '11');
      const tamperedEncrypted = `${iv}:${tamperedAuthTag}:${ciphertext}`;

      assert.throws(
        () => service.decrypt(tamperedEncrypted),
        (err: any) => {
          assert.ok(err instanceof InternalServerErrorException);
          assert.strictEqual(
            (err.getResponse() as any).code,
            'CHANNEL_CREDENTIAL_DECRYPTION_FAILED',
          );
          return true;
        },
      );
    });

    it('should throw InternalServerErrorException when IV is tampered', () => {
      const payload = { token: 'valid_secure_token' };
      const encrypted = service.encrypt(payload);
      const [iv, authTag, ciphertext] = encrypted.split(':');

      // Tamper IV
      const tamperedIv = iv.slice(0, -2) + (iv.slice(-2) === '99' ? '88' : '99');
      const tamperedEncrypted = `${tamperedIv}:${authTag}:${ciphertext}`;

      assert.throws(
        () => service.decrypt(tamperedEncrypted),
        (err: any) => {
          assert.ok(err instanceof InternalServerErrorException);
          assert.strictEqual(
            (err.getResponse() as any).code,
            'CHANNEL_CREDENTIAL_DECRYPTION_FAILED',
          );
          return true;
        },
      );
    });

    it('should throw InternalServerErrorException on malformed ciphertext strings', () => {
      const malformedInputs = [
        '',
        'not-a-valid-ciphertext',
        'only-one-colon:test',
        'too:many:colons:in:ciphertext:string',
        '::',
      ];

      for (const input of malformedInputs) {
        assert.throws(
          () => service.decrypt(input),
          (err: any) => {
            assert.ok(err instanceof InternalServerErrorException);
            assert.strictEqual(
              (err.getResponse() as any).code,
              'CHANNEL_CREDENTIAL_DECRYPTION_FAILED',
            );
            return true;
          },
        );
      }
    });

    it('should throw InternalServerErrorException when decrypting with a different key', () => {
      const payload = { apiKey: 'sensitive_channel_api_key' };
      const encrypted = service.encrypt(payload);

      // Create another service with a different 32-byte hex key
      const otherConfigService = {
        get: () => 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
      };
      const otherService = new ChannelCredentialService(
        otherConfigService as unknown as ConfigService,
      );

      assert.throws(
        () => otherService.decrypt(encrypted),
        (err: any) => {
          assert.ok(err instanceof InternalServerErrorException);
          assert.strictEqual(
            (err.getResponse() as any).code,
            'CHANNEL_CREDENTIAL_DECRYPTION_FAILED',
          );
          return true;
        },
      );
    });
  });

  describe('Key Formats and Fallbacks', () => {
    it('should work with 32-character UTF-8 key', () => {
      const utf8Key = '12345678901234567890123456789012'; // 32 characters
      const utf8ConfigService = {
        get: () => utf8Key,
      };
      const utf8Service = new ChannelCredentialService(
        utf8ConfigService as unknown as ConfigService,
      );

      const payload = { service: 'facebook', pageToken: 'EAAB...' };
      const encrypted = utf8Service.encrypt(payload);
      const decrypted = utf8Service.decrypt(encrypted);

      assert.deepStrictEqual(decrypted, payload);
    });

    it('should work with 32-byte Base64 key', () => {
      const base64Key = crypto.randomBytes(32).toString('base64');
      const base64ConfigService = {
        get: () => base64Key,
      };
      const base64Service = new ChannelCredentialService(
        base64ConfigService as unknown as ConfigService,
      );

      const payload = { service: 'email', smtpPass: 'secret_smtp_password' };
      const encrypted = base64Service.encrypt(payload);
      const decrypted = base64Service.decrypt(encrypted);

      assert.deepStrictEqual(decrypted, payload);
    });

    it('should derive 32-byte key via SHA-256 fallback when given arbitrary passphrase', () => {
      const passphrase = 'any-custom-passphrase-of-arbitrary-length';
      const fallbackConfigService = {
        get: () => passphrase,
      };
      const fallbackService = new ChannelCredentialService(
        fallbackConfigService as unknown as ConfigService,
      );

      const payload = { test: 'fallback-derivation' };
      const encrypted = fallbackService.encrypt(payload);
      const decrypted = fallbackService.decrypt(encrypted);

      assert.deepStrictEqual(decrypted, payload);
    });

    it('should throw InternalServerErrorException when ConfigService returns empty/undefined', () => {
      const emptyConfigService = {
        get: () => undefined,
      };

      assert.throws(
        () => new ChannelCredentialService(emptyConfigService as unknown as ConfigService),
        (err: any) => {
          assert.ok(err instanceof InternalServerErrorException);
          assert.strictEqual((err.getResponse() as any).code, 'CHANNEL_ENCRYPTION_KEY_MISSING');
          return true;
        },
      );
    });
  });

  describe('Format Compatibility (Hex & Base64)', () => {
    it('should decrypt Hex-formatted ciphertext components seamlessly', () => {
      // Manually construct Hex-encoded ciphertext
      const iv = crypto.randomBytes(16);
      const key = Buffer.from(sampleHexKey, 'hex');
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const payload = { format: 'hex_encoded_components' };
      const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(payload), 'utf8'),
        cipher.final(),
      ]);
      const authTag = cipher.getAuthTag();

      const hexCiphertext = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
      const decrypted = service.decrypt(hexCiphertext);

      assert.deepStrictEqual(decrypted, payload);
    });
  });
});
