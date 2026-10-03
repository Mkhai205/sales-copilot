import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { envSchema } from '../env.schema';
import { validateEnv } from '../env.validation';

describe('Empirical Adversarial Stress Tests: envSchema & Environment Configuration', () => {
  const baseValidEnv = {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
    JWT_ACCESS_TOKEN_SECRET: 'test_access_token_secret_32_bytes_ok_minimum',
    WIDGET_TOKEN_SECRET: 'test_widget_token_secret_32_bytes_ok_minimum',
    STORAGE_ACCESS_KEY: 'test_minio_access_key',
    STORAGE_SECRET_KEY: 'test_minio_secret_key',
    CHANNEL_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  };

  describe('1. APP_BASE_URL Edge Cases & Normalization', () => {
    it('handles empty string "" as undefined, applying default http://localhost:8000', () => {
      const parsed = envSchema.parse({
        ...baseValidEnv,
        APP_BASE_URL: '',
      });
      expect(parsed.APP_BASE_URL).toBe('http://localhost:8000');
    });

    it('handles whitespace-only "   \\t\\n  " as undefined, applying default http://localhost:8000', () => {
      const parsed = envSchema.parse({
        ...baseValidEnv,
        APP_BASE_URL: '   \t\n  ',
      });
      expect(parsed.APP_BASE_URL).toBe('http://localhost:8000');
    });

    it('strips single and multiple trailing slashes from APP_BASE_URL', () => {
      const singleSlash = envSchema.parse({
        ...baseValidEnv,
        APP_BASE_URL: 'https://api.example.com/',
      });
      expect(singleSlash.APP_BASE_URL).toBe('https://api.example.com');

      const multiSlash = envSchema.parse({
        ...baseValidEnv,
        APP_BASE_URL: 'https://api.example.com/////',
      });
      expect(multiSlash.APP_BASE_URL).toBe('https://api.example.com');
    });

    it('trims leading and trailing whitespace around APP_BASE_URL', () => {
      const parsed = envSchema.parse({
        ...baseValidEnv,
        APP_BASE_URL: '   https://api.example.com/   ',
      });
      expect(parsed.APP_BASE_URL).toBe('https://api.example.com');
    });

    it('handles custom ports and unusual port numbers', () => {
      const ports = [80, 443, 3000, 8000, 8080, 9000, 65535];
      for (const port of ports) {
        const parsed = envSchema.parse({
          ...baseValidEnv,
          APP_BASE_URL: `http://localhost:${port}/`,
        });
        expect(parsed.APP_BASE_URL).toBe(`http://localhost:${port}`);
      }
    });

    it('handles IPv4 and IPv6 URLs', () => {
      const ipv4 = envSchema.parse({
        ...baseValidEnv,
        APP_BASE_URL: 'http://127.0.0.1:8000/',
      });
      expect(ipv4.APP_BASE_URL).toBe('http://127.0.0.1:8000');

      const ipv6 = envSchema.parse({
        ...baseValidEnv,
        APP_BASE_URL: 'http://[::1]:8000/',
      });
      expect(ipv6.APP_BASE_URL).toBe('http://[::1]:8000');
    });

    it('handles multi-level subdomains with paths and preserves path while stripping trailing slash', () => {
      const parsed = envSchema.parse({
        ...baseValidEnv,
        APP_BASE_URL: '  https://sub.staging.api.example.co.uk:8443/core/api///  ',
      });
      expect(parsed.APP_BASE_URL).toBe('https://sub.staging.api.example.co.uk:8443/core/api');
    });

    it.each([
      ['not-a-valid-url'],
      ['http://'], // missing host
      ['https://'],
      ['http://:8000'],
      ['http://localhost:invalid-port'],
      ['http://localhost:9999999'], // invalid port
      ['//localhost:8000'], // protocol-relative URL without scheme
      ['http://    '],
      ['127.0.0.1:8000'], // missing scheme (127 cannot be a scheme)
      ['example.com'], // missing scheme
      ['https://'], // incomplete
    ])('rejects invalid APP_BASE_URL: %s', invalidUrl => {
      const result = envSchema.safeParse({
        ...baseValidEnv,
        APP_BASE_URL: invalidUrl,
      });
      expect(result.success).toBe(false);
    });

    it('rejects schemes without http:// or https:// (e.g. localhost:8000 without protocol)', () => {
      const parsed = envSchema.safeParse({
        ...baseValidEnv,
        APP_BASE_URL: 'localhost:8000',
      });
      // Enforced by .regex(/^https?:\/\//)
      expect(parsed.success).toBe(false);
    });
  });

  describe('2. WEBHOOK_BASE_URL Inheritance & Edge Cases', () => {
    it('inherits default APP_BASE_URL when both are omitted', () => {
      const parsed = envSchema.parse(baseValidEnv);
      expect(parsed.APP_BASE_URL).toBe('http://localhost:8000');
      expect(parsed.WEBHOOK_BASE_URL).toBe('http://localhost:8000');
    });

    it('inherits default APP_BASE_URL when both are empty string', () => {
      const parsed = envSchema.parse({
        ...baseValidEnv,
        APP_BASE_URL: '',
        WEBHOOK_BASE_URL: '',
      });
      expect(parsed.APP_BASE_URL).toBe('http://localhost:8000');
      expect(parsed.WEBHOOK_BASE_URL).toBe('http://localhost:8000');
    });

    it('inherits custom APP_BASE_URL when WEBHOOK_BASE_URL is omitted', () => {
      const parsed = envSchema.parse({
        ...baseValidEnv,
        APP_BASE_URL: 'https://custom.example.com',
      });
      expect(parsed.APP_BASE_URL).toBe('https://custom.example.com');
      expect(parsed.WEBHOOK_BASE_URL).toBe('https://custom.example.com');
    });

    it('inherits custom APP_BASE_URL when WEBHOOK_BASE_URL is empty string ""', () => {
      const parsed = envSchema.parse({
        ...baseValidEnv,
        APP_BASE_URL: 'https://custom.example.com',
        WEBHOOK_BASE_URL: '',
      });
      expect(parsed.APP_BASE_URL).toBe('https://custom.example.com');
      expect(parsed.WEBHOOK_BASE_URL).toBe('https://custom.example.com');
    });

    it('inherits custom APP_BASE_URL when WEBHOOK_BASE_URL is whitespace only', () => {
      const parsed = envSchema.parse({
        ...baseValidEnv,
        APP_BASE_URL: 'https://custom.example.com',
        WEBHOOK_BASE_URL: '  \t  \n  ',
      });
      expect(parsed.APP_BASE_URL).toBe('https://custom.example.com');
      expect(parsed.WEBHOOK_BASE_URL).toBe('https://custom.example.com');
    });

    it('inherits normalized APP_BASE_URL (trailing slash stripped) when WEBHOOK_BASE_URL is empty', () => {
      const parsed = envSchema.parse({
        ...baseValidEnv,
        APP_BASE_URL: 'https://custom.example.com////',
        WEBHOOK_BASE_URL: '',
      });
      expect(parsed.APP_BASE_URL).toBe('https://custom.example.com');
      expect(parsed.WEBHOOK_BASE_URL).toBe('https://custom.example.com');
    });

    it('preserves distinct WEBHOOK_BASE_URL when explicitly specified', () => {
      const parsed = envSchema.parse({
        ...baseValidEnv,
        APP_BASE_URL: 'http://localhost:8000',
        WEBHOOK_BASE_URL: 'https://sales-copilot.kakadev.xyz',
      });
      expect(parsed.APP_BASE_URL).toBe('http://localhost:8000');
      expect(parsed.WEBHOOK_BASE_URL).toBe('https://sales-copilot.kakadev.xyz');
    });

    it('trims whitespace and trailing slashes from explicit WEBHOOK_BASE_URL', () => {
      const parsed = envSchema.parse({
        ...baseValidEnv,
        APP_BASE_URL: 'http://localhost:8000',
        WEBHOOK_BASE_URL: '   https://sales-copilot.kakadev.xyz:8443///   ',
      });
      expect(parsed.WEBHOOK_BASE_URL).toBe('https://sales-copilot.kakadev.xyz:8443');
    });

    it.each([
      ['not-a-valid-url'],
      ['http://'],
      ['https://'],
      ['http://:8000'],
      ['//tunnel.example.com'],
      ['127.0.0.1:8000'],
      ['example.com'],
    ])('rejects invalid WEBHOOK_BASE_URL: %s', invalidUrl => {
      const result = envSchema.safeParse({
        ...baseValidEnv,
        WEBHOOK_BASE_URL: invalidUrl,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('3. Production & Development .env File Integrity', () => {
    const serverEnvPath = path.resolve(__dirname, '../../../.env');
    const serverEnvExamplePath = path.resolve(__dirname, '../../../.env.example');

    it('verifies apps/server/.env exists and loads STORAGE_PUBLIC_ENDPOINT without collision', () => {
      expect(fs.existsSync(serverEnvPath)).toBe(true);

      const rawContent = fs.readFileSync(serverEnvPath, 'utf-8');
      const lines = rawContent.split(/\r?\n/);

      // Check occurrences of STORAGE_PUBLIC_ENDPOINT
      const storagePublicLines = lines.filter(line =>
        line.trim().startsWith('STORAGE_PUBLIC_ENDPOINT='),
      );
      expect(storagePublicLines.length).toBe(1);
      expect(storagePublicLines[0].trim()).toMatch(/^STORAGE_PUBLIC_ENDPOINT=https?:\/\//);

      // Check occurrences of STORAGE_ENDPOINT
      const storageLines = lines.filter(line => line.trim().startsWith('STORAGE_ENDPOINT='));
      expect(storageLines.length).toBe(1);
      expect(storageLines[0].trim()).toMatch(/^STORAGE_ENDPOINT=https?:\/\//);

      // Check APP_BASE_URL
      const appBaseUrlLines = lines.filter(line => line.trim().startsWith('APP_BASE_URL='));
      expect(appBaseUrlLines.length).toBe(1);
      expect(appBaseUrlLines[0].trim()).toMatch(/^APP_BASE_URL=https?:\/\//);

      // Check WEBHOOK_BASE_URL is commented out in default local .env
      const webhookActiveLines = lines.filter(line => line.trim().startsWith('WEBHOOK_BASE_URL='));
      expect(webhookActiveLines.length).toBe(0);

      const webhookCommentedLines = lines.filter(line => line.trim().includes('WEBHOOK_BASE_URL='));
      expect(webhookCommentedLines.length).toBeGreaterThan(0);
    });

    it('verifies dotenv parsing of apps/server/.env validates cleanly with validateEnv()', () => {
      const parsedEnv = dotenv.parse(fs.readFileSync(serverEnvPath, 'utf-8'));

      const config = validateEnv(parsedEnv);
      expect(config.APP_BASE_URL).toMatch(/^https?:\/\//);
      // When WEBHOOK_BASE_URL is not defined in .env, it inherits APP_BASE_URL
      expect(config.WEBHOOK_BASE_URL).toBe(config.APP_BASE_URL);
      expect(config.STORAGE_PUBLIC_ENDPOINT).toMatch(/^https?:\/\//);
      expect(config.STORAGE_ENDPOINT).toMatch(/^https?:\/\//);
      expect(config.RESEND_FROM_EMAIL).toBe('Sales Copilot <sales-copilot@kakadev.xyz>');
    });

    it('verifies apps/server/.env.example has documented inheritance and tunnel mode commented out', () => {
      expect(fs.existsSync(serverEnvExamplePath)).toBe(true);

      const rawContent = fs.readFileSync(serverEnvExamplePath, 'utf-8');
      const lines = rawContent.split(/\r?\n/);

      const appBaseUrlLines = lines.filter(line => line.trim().startsWith('APP_BASE_URL='));
      expect(appBaseUrlLines.length).toBe(1);

      // Active WEBHOOK_BASE_URL should not be uncommented in the main section
      const activeWebhookLines = lines.filter(line => line.trim().startsWith('WEBHOOK_BASE_URL='));
      expect(activeWebhookLines.length).toBe(0);

      // Commented WEBHOOK_BASE_URL should exist in tunnel section
      const commentedWebhookLines = lines.filter(line =>
        line.trim().startsWith('# WEBHOOK_BASE_URL='),
      );
      expect(commentedWebhookLines.length).toBeGreaterThanOrEqual(1);
    });
  });
});
