import { envSchema } from '../env.schema';
import { validateEnv } from '../env.validation';

describe('envSchema — BaseUrl & Webhook URL Architecture (Milestone 1)', () => {
  const minimalValidEnv = {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
    JWT_ACCESS_TOKEN_SECRET: 'test_access_token_secret_32_bytes_ok_minimum',
    STORAGE_ACCESS_KEY: 'test_minio_access_key',
    STORAGE_SECRET_KEY: 'test_minio_secret_key',
    CHANNEL_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  };

  describe('APP_BASE_URL Configuration', () => {
    it('should default APP_BASE_URL to http://localhost:8000 when omitted', () => {
      const parsed = envSchema.parse(minimalValidEnv);

      expect(parsed.APP_BASE_URL).toBe('http://localhost:8000');
    });

    it('should accept and trim custom APP_BASE_URL', () => {
      const parsed = envSchema.parse({
        ...minimalValidEnv,
        APP_BASE_URL: '  https://api.sales-copilot.example.com  ',
      });

      expect(parsed.APP_BASE_URL).toBe('https://api.sales-copilot.example.com');
    });

    it('should reject invalid APP_BASE_URL', () => {
      const result = envSchema.safeParse({
        ...minimalValidEnv,
        APP_BASE_URL: 'not-a-valid-url',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('WEBHOOK_BASE_URL Inheritance Logic', () => {
    it('should auto-inherit WEBHOOK_BASE_URL from default APP_BASE_URL when both are omitted', () => {
      const parsed = envSchema.parse(minimalValidEnv);

      expect(parsed.APP_BASE_URL).toBe('http://localhost:8000');
      expect(parsed.WEBHOOK_BASE_URL).toBe('http://localhost:8000');
    });

    it('should auto-inherit WEBHOOK_BASE_URL from custom APP_BASE_URL when WEBHOOK_BASE_URL is omitted', () => {
      const parsed = envSchema.parse({
        ...minimalValidEnv,
        APP_BASE_URL: 'https://sales-copilot.example.com',
      });

      expect(parsed.APP_BASE_URL).toBe('https://sales-copilot.example.com');
      expect(parsed.WEBHOOK_BASE_URL).toBe('https://sales-copilot.example.com');
    });

    it('should auto-inherit WEBHOOK_BASE_URL from APP_BASE_URL when WEBHOOK_BASE_URL is an empty string', () => {
      const parsed = envSchema.parse({
        ...minimalValidEnv,
        APP_BASE_URL: 'https://custom-shop.com',
        WEBHOOK_BASE_URL: '',
      });

      expect(parsed.APP_BASE_URL).toBe('https://custom-shop.com');
      expect(parsed.WEBHOOK_BASE_URL).toBe('https://custom-shop.com');
    });

    it('should auto-inherit WEBHOOK_BASE_URL from APP_BASE_URL when WEBHOOK_BASE_URL contains only whitespace', () => {
      const parsed = envSchema.parse({
        ...minimalValidEnv,
        APP_BASE_URL: 'https://custom-shop.com',
        WEBHOOK_BASE_URL: '   ',
      });

      expect(parsed.APP_BASE_URL).toBe('https://custom-shop.com');
      expect(parsed.WEBHOOK_BASE_URL).toBe('https://custom-shop.com');
    });

    it('should preserve explicit WEBHOOK_BASE_URL override when provided', () => {
      const parsed = envSchema.parse({
        ...minimalValidEnv,
        APP_BASE_URL: 'https://custom-shop.com',
        WEBHOOK_BASE_URL: 'https://webhook.custom-shop.com',
      });

      expect(parsed.APP_BASE_URL).toBe('https://custom-shop.com');
      expect(parsed.WEBHOOK_BASE_URL).toBe('https://webhook.custom-shop.com');
    });

    it('should strip trailing slashes from APP_BASE_URL and WEBHOOK_BASE_URL for consistency', () => {
      const parsed = envSchema.parse({
        ...minimalValidEnv,
        APP_BASE_URL: 'https://custom-shop.com///',
        WEBHOOK_BASE_URL: 'https://webhook.custom-shop.com///',
      });

      expect(parsed.APP_BASE_URL).toBe('https://custom-shop.com');
      expect(parsed.WEBHOOK_BASE_URL).toBe('https://webhook.custom-shop.com');
    });

    it('should reject invalid URL strings for WEBHOOK_BASE_URL', () => {
      const result = envSchema.safeParse({
        ...minimalValidEnv,
        WEBHOOK_BASE_URL: 'not-a-valid-url',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('RESEND_FROM_EMAIL Default Value (RFC 2606)', () => {
    it('should default RESEND_FROM_EMAIL to a standard RFC 2606 email and not contain kakadev.xyz or salescopilot', () => {
      const parsed = envSchema.parse(minimalValidEnv);

      expect(parsed.RESEND_FROM_EMAIL).toBe('Sales Copilot <noreply@example.com>');
      expect(parsed.RESEND_FROM_EMAIL.includes('kakadev.xyz')).toBe(false);
      expect(parsed.RESEND_FROM_EMAIL.includes('salescopilot')).toBe(false);
    });

    it('should allow overriding RESEND_FROM_EMAIL with custom sender', () => {
      const parsed = envSchema.parse({
        ...minimalValidEnv,
        RESEND_FROM_EMAIL: 'Custom Sender <sender@myshop.vn>',
      });

      expect(parsed.RESEND_FROM_EMAIL).toBe('Custom Sender <sender@myshop.vn>');
    });
  });

  describe('validateEnv() Integration Helper', () => {
    it('should successfully validate and return EnvConfig with inherited baseUrl', () => {
      const config = validateEnv(minimalValidEnv);

      expect(config.APP_BASE_URL).toBe('http://localhost:8000');
      expect(config.WEBHOOK_BASE_URL).toBe('http://localhost:8000');
    });

    it('should throw descriptive error when mandatory environment variable is missing', () => {
      const invalidEnv = { ...minimalValidEnv };
      delete (invalidEnv as any).DATABASE_URL;

      expect(() => validateEnv(invalidEnv)).toThrow(/Configuration validation failed/);
    });
  });
});
