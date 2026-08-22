import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class ChannelCredentialService {
  private readonly logger = new Logger(ChannelCredentialService.name);
  private readonly encryptionKey: Buffer;

  constructor(private readonly configService: ConfigService) {
    const rawKey =
      this.configService.get<string>('CHANNEL_ENCRYPTION_KEY') ||
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    this.encryptionKey = this.resolveKey(rawKey);
  }

  /**
   * Resolves a raw key string into a 32-byte (256-bit) Buffer for AES-256-GCM.
   */
  private resolveKey(key: string): Buffer {
    const trimmed = key.trim();

    // 64 hex characters = 32 bytes
    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
      return Buffer.from(trimmed, 'hex');
    }

    // Exact 32 bytes in UTF-8
    const utf8Buffer = Buffer.from(trimmed, 'utf8');
    if (utf8Buffer.length === 32) {
      return utf8Buffer;
    }

    // 44 characters base64 = 32 bytes
    if (/^[A-Za-z0-9+/]{43}=$/.test(trimmed) || /^[A-Za-z0-9+/]{42}==$/.test(trimmed)) {
      const base64Buffer = Buffer.from(trimmed, 'base64');
      if (base64Buffer.length === 32) {
        return base64Buffer;
      }
    }

    // Fallback: SHA-256 hash to derive standard 32 bytes
    return crypto.createHash('sha256').update(trimmed).digest();
  }

  /**
   * Helper to parse encoded buffer part (supports Base64 and Hex).
   */
  private parseBuffer(str: string, expectedLength?: number): Buffer {
    if (!str) return Buffer.alloc(0);

    // If string matches hex format and expected byte length in hex
    if (/^[0-9a-fA-F]+$/.test(str) && (!expectedLength || str.length === expectedLength * 2)) {
      return Buffer.from(str, 'hex');
    }

    return Buffer.from(str, 'base64');
  }

  /**
   * Encrypts a credentials dictionary using AES-256-GCM.
   * Generates a unique 16-byte random IV per call.
   *
   * @param data Plaintext credential object
   * @returns Formatted ciphertext string: `${iv}:${authTag}:${ciphertext}` (Base64)
   */
  encrypt(data: Record<string, unknown>): string {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
      const plaintext = JSON.stringify(data ?? {});

      const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      const authTag = cipher.getAuthTag();

      return `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
    } catch (_error) {
      this.logger.error('Failed to encrypt channel credentials');
      throw new InternalServerErrorException({
        code: 'CHANNEL_CREDENTIAL_ENCRYPTION_FAILED',
        message: 'Failed to encrypt channel credentials',
      });
    }
  }

  /**
   * Decrypts a formatted ciphertext string and verifies the GCM authentication tag.
   *
   * @param ciphertext Formatted ciphertext string: `${iv}:${authTag}:${ciphertext}`
   * @returns Parsed plain credentials object
   * @throws InternalServerErrorException if verification fails, data is corrupted or tampered
   */
  decrypt<T extends Record<string, unknown> = Record<string, unknown>>(ciphertext: string): T {
    if (!ciphertext || typeof ciphertext !== 'string') {
      throw new InternalServerErrorException({
        code: 'CHANNEL_CREDENTIAL_DECRYPTION_FAILED',
        message: 'Invalid ciphertext input',
      });
    }

    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      throw new InternalServerErrorException({
        code: 'CHANNEL_CREDENTIAL_DECRYPTION_FAILED',
        message: 'Invalid ciphertext format: expected iv:authTag:ciphertext',
      });
    }

    const [ivStr, authTagStr, encryptedStr] = parts;
    const iv = this.parseBuffer(ivStr, 16);
    const authTag = this.parseBuffer(authTagStr, 16);
    const encrypted = this.parseBuffer(encryptedStr);

    if (iv.length !== 16 || authTag.length !== 16 || encrypted.length === 0) {
      throw new InternalServerErrorException({
        code: 'CHANNEL_CREDENTIAL_DECRYPTION_FAILED',
        message: 'Invalid ciphertext components length',
      });
    }

    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      return JSON.parse(decrypted.toString('utf8')) as T;
    } catch (_error) {
      throw new InternalServerErrorException({
        code: 'CHANNEL_CREDENTIAL_DECRYPTION_FAILED',
        message:
          'Failed to decrypt channel credentials: auth tag verification failed or ciphertext is corrupted',
      });
    }
  }
}
