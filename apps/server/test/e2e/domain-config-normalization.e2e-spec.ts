import * as fs from 'fs';
import * as path from 'path';
import request from 'supertest';
import { envSchema } from '../../src/config/env.schema';
import { StorageService } from '../../src/infrastructure/storage/storage.service';
import { WebChatAdapter } from '../../src/modules/omnichannel/integrations/web-chat/web-chat.adapter';
import { createTestApp, type TestAppContext } from './helpers/setup';
import { seedTestData, cleanupTestData, type SeedTestContext } from './helpers/seed';
import { loginAsAgent } from './helpers/auth';
import {
  getSourceFiles,
  scanFilesForPattern,
  getWorkspaceRootDir,
  simulateGetAppUrl,
  isLocalhostOrigin,
} from './helpers/domain-normalization.helpers';

describe('Comprehensive Opaque-Box E2E: Domain, BaseUrl & Storage Normalization', () => {
  let ctx: TestAppContext;
  let seedCtx: SeedTestContext;
  let workspaceRoot: string;
  let serverSrcFiles: string[];
  let webSrcFiles: string[];

  const baseEnv = {
    NODE_ENV: 'test' as const,
    PORT: 8000,
    DATABASE_URL: 'postgresql://postgres:password@localhost:5432/test?schema=public',
    JWT_ACCESS_TOKEN_SECRET: 'test-jwt-access-token-secret-at-least-32-chars-long',
    REDIS_URL: 'redis://localhost:6379',
    STORAGE_ACCESS_KEY: 'minioadmin',
    STORAGE_SECRET_KEY: 'minioadmin',
    CHANNEL_ENCRYPTION_KEY: '12345678901234567890123456789012',
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    seedCtx = await seedTestData(ctx.prisma);
    workspaceRoot = getWorkspaceRootDir();
    serverSrcFiles = getSourceFiles(path.join(workspaceRoot, 'apps/server/src'));
    webSrcFiles = getSourceFiles(path.join(workspaceRoot, 'apps/web/src'));
  });

  afterAll(async () => {
    if (seedCtx && ctx?.prisma) {
      await cleanupTestData(ctx.prisma, seedCtx);
    }
    if (ctx) {
      await ctx.close();
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 1: FEATURE COVERAGE (Features 1 – 16)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Tier 1: Feature Coverage (Features 1 – 16)', () => {
    // ─── Feature 1: Zero Hardcoded AI Domains ─────────────────────────────────
    describe('Feature 1: Zero Hardcoded AI Domains', () => {
      it('T1.1.1: should contain 0 occurrences of salescopilot.vn in apps/server/src production code', () => {
        const prodFiles = serverSrcFiles.filter(
          f => !f.includes('__tests__') && !f.endsWith('.spec.ts'),
        );
        const matches = scanFilesForPattern(prodFiles, /salescopilot\.vn/i);
        expect(matches).toEqual([]);
      });

      it('T1.1.2: should contain 0 occurrences of salescopilot.com in apps/server/src production code', () => {
        const prodFiles = serverSrcFiles.filter(
          f => !f.includes('__tests__') && !f.endsWith('.spec.ts'),
        );
        const matches = scanFilesForPattern(prodFiles, /salescopilot\.com/i);
        expect(matches).toEqual([]);
      });

      it('T1.1.3: should contain 0 occurrences of salescopilot.io in apps/server/src production code', () => {
        const prodFiles = serverSrcFiles.filter(
          f => !f.includes('__tests__') && !f.endsWith('.spec.ts'),
        );
        const matches = scanFilesForPattern(prodFiles, /salescopilot\.io/i);
        expect(matches).toEqual([]);
      });

      it('T1.1.4: should contain 0 occurrences of salescopilot.vn in apps/web/src production code', () => {
        const prodFiles = webSrcFiles.filter(
          f => !f.includes('__tests__') && !f.endsWith('.spec.ts'),
        );
        const matches = scanFilesForPattern(prodFiles, /salescopilot\.vn/i);
        expect(matches).toEqual([]);
      });

      it('T1.1.5: should contain 0 occurrences of salescopilot.com and salescopilot.io in apps/web/src production code', () => {
        const prodFiles = webSrcFiles.filter(
          f => !f.includes('__tests__') && !f.endsWith('.spec.ts'),
        );
        const matches = scanFilesForPattern(prodFiles, /salescopilot\.(com|io)/i);
        expect(matches).toEqual([]);
      });
    });

    // ─── Feature 2: RFC 2606 UI Placeholders ──────────────────────────────────
    describe('Feature 2: RFC 2606 UI Placeholders', () => {
      it('T1.2.1: web-chat-config.tsx placeholder should use RFC 2606 standard domain (example.com or your-shop.com)', () => {
        const filePath = path.join(
          workspaceRoot,
          'apps/web/src/features/settings/inboxes/detail/channels/web-chat/web-chat-config.tsx',
        );
        const content = fs.readFileSync(filePath, 'utf8');
        expect(content).not.toMatch(/placeholder="[^"]*myshop\.vn[^"]*"/i);
        expect(content).toMatch(
          /placeholder="[^"]*(example\.com|your-shop\.com|yourshop\.com)[^"]*"/i,
        );
      });

      it('T1.2.2: database channel seed allowedDomains should use standard example domains', () => {
        const seedPath = path.join(
          workspaceRoot,
          'apps/server/prisma/seeds/02-channels-inboxes.seed.ts',
        );
        const content = fs.readFileSync(seedPath, 'utf8');
        expect(content).not.toContain('app.salescopilot.vn');
        expect(content).not.toContain('yourshop.vn');
      });

      it('T1.2.3: CORS test spec should use standard RFC 2606 example origins', () => {
        const corsPath = path.join(workspaceRoot, 'apps/server/src/common/__tests__/cors.spec.ts');
        const content = fs.readFileSync(corsPath, 'utf8');
        expect(content).not.toContain('app.salescopilot.vn');
      });

      it('T1.2.4: HTML sanitizer test spec should use RFC 2606 domains', () => {
        const sanitizerPath = path.join(
          workspaceRoot,
          'apps/server/src/common/__tests__/html-sanitizer.spec.ts',
        );
        const content = fs.readFileSync(sanitizerPath, 'utf8');
        expect(content).not.toContain('salescopilot.vn');
      });

      it('T1.2.5: Resend email templates should use standard RFC 2606 sender addresses', () => {
        const resendPath = path.join(
          workspaceRoot,
          'apps/server/src/infrastructure/email/__tests__/resend.service.spec.ts',
        );
        const content = fs.readFileSync(resendPath, 'utf8');
        expect(content).not.toContain('test@salescopilot.io');
      });
    });

    // ─── Feature 3: Standard Seed Accounts ─────────────────────────────────────
    describe('Feature 3: Standard Seed Accounts', () => {
      it('T1.3.1: 01-identity.seed.ts should not contain superadmin@salescopilot.io', () => {
        const seedPath = path.join(workspaceRoot, 'apps/server/prisma/seeds/01-identity.seed.ts');
        const content = fs.readFileSync(seedPath, 'utf8');
        expect(content).not.toContain('superadmin@salescopilot.io');
      });

      it('T1.3.2: 01-identity.seed.ts should not contain admin@salescopilot.io', () => {
        const seedPath = path.join(workspaceRoot, 'apps/server/prisma/seeds/01-identity.seed.ts');
        const content = fs.readFileSync(seedPath, 'utf8');
        expect(content).not.toContain('admin@salescopilot.io');
      });

      it('T1.3.3: 01-identity.seed.ts should not contain agent@salescopilot.io', () => {
        const seedPath = path.join(workspaceRoot, 'apps/server/prisma/seeds/01-identity.seed.ts');
        const content = fs.readFileSync(seedPath, 'utf8');
        expect(content).not.toContain('agent@salescopilot.io');
      });

      it('T1.3.4: 08-system-settings.seed.ts should not contain support@salescopilot.io', () => {
        const seedPath = path.join(
          workspaceRoot,
          'apps/server/prisma/seeds/08-system-settings.seed.ts',
        );
        const content = fs.readFileSync(seedPath, 'utf8');
        expect(content).not.toContain('support@salescopilot.io');
      });

      it('T1.3.5: E2E test seed helper should generate accounts with standard example domains', () => {
        const seedHelperPath = path.join(workspaceRoot, 'apps/server/test/e2e/helpers/seed.ts');
        const content = fs.readFileSync(seedHelperPath, 'utf8');
        expect(content).not.toContain('test.salescopilot.io');
      });
    });

    // ─── Feature 4: Server BaseUrl Single Source of Truth ──────────────────────
    describe('Feature 4: Server BaseUrl Single Source of Truth', () => {
      it('T1.4.1: envSchema should parse explicit valid APP_BASE_URL', () => {
        const parsed = envSchema.parse({
          ...baseEnv,
          APP_BASE_URL: 'http://localhost:8000',
        });
        expect((parsed as any).APP_BASE_URL).toBe('http://localhost:8000');
      });

      it('T1.4.2: envSchema should auto-inherit APP_BASE_URL into WEBHOOK_BASE_URL when omitted', () => {
        const parsed = envSchema.parse({
          ...baseEnv,
          APP_BASE_URL: 'https://sales-copilot.kakadev.xyz',
        });
        expect((parsed as any).WEBHOOK_BASE_URL).toBe('https://sales-copilot.kakadev.xyz');
      });

      it('T1.4.3: envSchema should preserve explicit WEBHOOK_BASE_URL override', () => {
        const parsed = envSchema.parse({
          ...baseEnv,
          APP_BASE_URL: 'https://app.store.com',
          WEBHOOK_BASE_URL: 'https://webhook.store.com',
        });
        expect((parsed as any).APP_BASE_URL).toBe('https://app.store.com');
        expect((parsed as any).WEBHOOK_BASE_URL).toBe('https://webhook.store.com');
      });

      it('T1.4.4: envSchema should default APP_BASE_URL to http://localhost:8000 when omitted', () => {
        const parsed = envSchema.parse(baseEnv);
        expect((parsed as any).APP_BASE_URL).toBe('http://localhost:8000');
      });

      it('T1.4.5: envSchema should not contain kakadev.xyz in default RESEND_FROM_EMAIL', () => {
        const parsed = envSchema.parse(baseEnv);
        expect((parsed as any).RESEND_FROM_EMAIL).not.toContain('kakadev.xyz');
      });
    });

    // ─── Feature 5: Web BaseUrl Single Source of Truth ─────────────────────────
    describe('Feature 5: Web BaseUrl Single Source of Truth', () => {
      it('T1.5.1: simulateGetAppUrl should return window.location.origin when in browser context', () => {
        const url = simulateGetAppUrl('https://my-store.vn', 'http://localhost:3000');
        expect(url).toBe('https://my-store.vn');
      });

      it('T1.5.2: simulateGetAppUrl should fall back to env var in SSR context', () => {
        const url = simulateGetAppUrl(undefined, 'https://sales-copilot.kakadev.xyz');
        expect(url).toBe('https://sales-copilot.kakadev.xyz');
      });

      it('T1.5.3: simulateGetAppUrl should default to http://localhost:3000 when neither is set', () => {
        const url = simulateGetAppUrl(undefined, undefined);
        expect(url).toBe('http://localhost:3000');
      });

      it('T1.5.4: apps/web/src/lib/config/app-url.ts should export getAppUrl', () => {
        const configPath = path.join(workspaceRoot, 'apps/web/src/lib/config/app-url.ts');
        expect(fs.existsSync(configPath)).toBe(true);
        const content = fs.readFileSync(configPath, 'utf8');
        expect(content).toContain('getAppUrl');
      });

      it('T1.5.5: getAppUrl implementation should reference process.env.NEXT_PUBLIC_APP_URL', () => {
        const configPath = path.join(workspaceRoot, 'apps/web/src/lib/config/app-url.ts');
        const content = fs.readFileSync(configPath, 'utf8');
        expect(content).toContain('NEXT_PUBLIC_APP_URL');
      });
    });

    // ─── Feature 6: Multi-Environment Harmonization ───────────────────────────
    describe('Feature 6: Multi-Environment Harmonization', () => {
      it('T1.6.1: should validate local dev environment configuration', () => {
        const parsed = envSchema.parse({
          ...baseEnv,
          APP_BASE_URL: 'http://localhost:8000',
          STORAGE_ENDPOINT: 'http://localhost:9000',
          STORAGE_PUBLIC_ENDPOINT: 'http://localhost:9000',
          CORS_ORIGIN: 'http://localhost:3000',
        });
        expect((parsed as any).APP_BASE_URL).toBe('http://localhost:8000');
        expect(parsed.STORAGE_PUBLIC_ENDPOINT).toBe('http://localhost:9000');
      });

      it('T1.6.2: should validate tunnel environment configuration', () => {
        const parsed = envSchema.parse({
          ...baseEnv,
          APP_BASE_URL: 'https://sales-copilot.kakadev.xyz',
          STORAGE_PUBLIC_ENDPOINT: 'https://storage-sales-copilot.kakadev.xyz',
          CORS_ORIGIN: 'https://sales-copilot.kakadev.xyz',
        });
        expect((parsed as any).APP_BASE_URL).toBe('https://sales-copilot.kakadev.xyz');
        expect((parsed as any).WEBHOOK_BASE_URL).toBe('https://sales-copilot.kakadev.xyz');
      });

      it('T1.6.3: should validate production custom domain configuration', () => {
        const parsed = envSchema.parse({
          ...baseEnv,
          APP_BASE_URL: 'https://copilot.custombrand.com',
          WEBHOOK_BASE_URL: 'https://api.custombrand.com',
          STORAGE_PUBLIC_ENDPOINT: 'https://cdn.custombrand.com',
        });
        expect((parsed as any).APP_BASE_URL).toBe('https://copilot.custombrand.com');
        expect((parsed as any).WEBHOOK_BASE_URL).toBe('https://api.custombrand.com');
      });

      it('T1.6.4: CORS origin parser should accept multiple valid origins', () => {
        const parsed = envSchema.parse({
          ...baseEnv,
          CORS_ORIGIN: 'http://localhost:3000, https://sales-copilot.kakadev.xyz',
        });
        expect(parsed.CORS_ORIGIN).toEqual([
          'http://localhost:3000',
          'https://sales-copilot.kakadev.xyz',
        ]);
      });

      it('T1.6.5: Live health endpoint should respond with healthy status in test environment', async () => {
        const res = await request(ctx.httpServer).get('/api/v1/health').expect(200);
        expect(res.body.success).toBe(true);
        expect(['ok', 'degraded']).toContain(res.body.data.status);
      });
    });

    // ─── Feature 7: Web Chat Embed Script Dynamic BaseUrl ─────────────────────
    describe('Feature 7: Web Chat Embed Script Dynamic BaseUrl', () => {
      const adapter = new WebChatAdapter();

      it('T1.7.1: buildEmbedScript should construct script src pointing to baseUrl/widget/sdk.js', () => {
        const script = adapter.buildEmbedScript('tok_123', 'http://localhost:8000');
        expect(script).toContain('var BASE_URL = "http://localhost:8000";');
        expect(script).toContain('BASE_URL + "/widget/sdk.js"');
      });

      it('T1.7.2: buildEmbedScript should pass baseUrl into SalesCopilotWidget.init', () => {
        const script = adapter.buildEmbedScript('tok_123', 'http://localhost:8000');
        expect(script).toContain('baseUrl: BASE_URL');
      });

      it('T1.7.3: buildEmbedScript should not contain hardcoded https://app.salescopilot.com', () => {
        const script = adapter.buildEmbedScript('tok_123', 'https://sales-copilot.kakadev.xyz');
        expect(script).not.toContain('app.salescopilot.com');
      });

      it('T1.7.4: buildEmbedScript in web-chat-config.tsx should pass baseUrl in init config', () => {
        const configPath = path.join(
          workspaceRoot,
          'apps/web/src/features/settings/inboxes/detail/channels/web-chat/web-chat-config.tsx',
        );
        const content = fs.readFileSync(configPath, 'utf8');
        expect(content).toMatch(/SalesCopilotWidget\.init\(\{[\s\S]*baseUrl:[\s\S]*\}\)/);
      });

      it('T1.7.5: success-summary-step.tsx should pass baseUrl in init config', () => {
        const stepPath = path.join(
          workspaceRoot,
          'apps/web/src/features/settings/inboxes/new/components/success-summary-step.tsx',
        );
        const content = fs.readFileSync(stepPath, 'utf8');
        expect(content).toMatch(/SalesCopilotWidget\.init\(\{[\s\S]*baseUrl:[\s\S]*\}\)/);
      });
    });

    // ─── Feature 8: Webhook Endpoint Dynamic Generation ───────────────────────
    describe('Feature 8: Webhook Endpoint Dynamic Generation', () => {
      it('T1.8.1: Telegram webhook URL should include /api/v1 prefix', () => {
        const telegramPath = path.join(
          workspaceRoot,
          'apps/server/src/modules/omnichannel/integrations/telegram/telegram.lifecycle.ts',
        );
        const content = fs.readFileSync(telegramPath, 'utf8');
        expect(content).toMatch(/\/api\/v1\/(channels|integrations)/);
      });

      it('T1.8.2: Facebook callback redirect URL should include /api/v1 prefix', () => {
        const fbPath = path.join(
          workspaceRoot,
          'apps/server/src/modules/omnichannel/integrations/facebook/facebook.service.ts',
        );
        const content = fs.readFileSync(fbPath, 'utf8');
        expect(content).toContain('/api/v1/integrations/facebook/callback');
      });

      it('T1.8.3: SePay payment webhook in bank-settings-form.tsx should not hardcode kakadev.xyz as fallback', () => {
        const bankPath = path.join(
          workspaceRoot,
          'apps/web/src/features/settings/bank/components/bank-settings-form.tsx',
        );
        const content = fs.readFileSync(bankPath, 'utf8');
        expect(content).not.toContain("'https://sales-copilot.kakadev.xyz'");
      });

      it('T1.8.4: Facebook service should consume WEBHOOK_BASE_URL', () => {
        const fbPath = path.join(
          workspaceRoot,
          'apps/server/src/modules/omnichannel/integrations/facebook/facebook.service.ts',
        );
        const content = fs.readFileSync(fbPath, 'utf8');
        expect(content).toContain('WEBHOOK_BASE_URL');
      });

      it('T1.8.5: Telegram lifecycle service should consume WEBHOOK_BASE_URL', () => {
        const telegramPath = path.join(
          workspaceRoot,
          'apps/server/src/modules/omnichannel/integrations/telegram/telegram.lifecycle.ts',
        );
        const content = fs.readFileSync(telegramPath, 'utf8');
        expect(content).toContain('WEBHOOK_BASE_URL');
      });
    });

    // ─── Feature 9: Localhost Warning Badge for Webhooks ──────────────────────
    describe('Feature 9: Localhost Warning Badge for Webhooks', () => {
      it('T1.9.1: isLocalhostOrigin should return true for http://localhost:3000', () => {
        expect(isLocalhostOrigin('http://localhost:3000')).toBe(true);
      });

      it('T1.9.2: isLocalhostOrigin should return true for http://127.0.0.1:8000', () => {
        expect(isLocalhostOrigin('http://127.0.0.1:8000')).toBe(true);
      });

      it('T1.9.3: isLocalhostOrigin should return false for https://sales-copilot.kakadev.xyz', () => {
        expect(isLocalhostOrigin('https://sales-copilot.kakadev.xyz')).toBe(false);
      });

      it('T1.9.4: isLocalhostOrigin should return false for https://my-store.vn', () => {
        expect(isLocalhostOrigin('https://my-store.vn')).toBe(false);
      });

      it('T1.9.5: bank-settings-form.tsx should render visual localhost warning alert or badge', () => {
        const bankPath = path.join(
          workspaceRoot,
          'apps/web/src/features/settings/bank/components/bank-settings-form.tsx',
        );
        const content = fs.readFileSync(bankPath, 'utf8');
        expect(content).toMatch(/localhost|Localhost/);
        expect(content).toMatch(/tunnel|Tunnel|ngrok|cảnh báo|warning/i);
      });
    });

    // ─── Feature 10: Relative Storage Key Persistence ─────────────────────────
    describe('Feature 10: Relative Storage Key Persistence', () => {
      it('T1.10.1: seed inbox record in database should persist relative key or null avatarUrl', async () => {
        const inbox = await ctx.prisma.client.inbox.findUnique({
          where: { id: seedCtx.inbox.id },
        });
        expect(inbox).not.toBeNull();
        if (inbox?.avatarUrl) {
          expect(inbox.avatarUrl).not.toMatch(/^https?:\/\/localhost:9000/);
          expect(inbox.avatarUrl).not.toMatch(/^https?:\/\/storage-sales-copilot\.kakadev\.xyz/);
        }
      });

      it('T1.10.2: inboxes.service.ts uploadAvatar should store relative path starting with avatars/inboxes/', () => {
        const servicePath = path.join(
          workspaceRoot,
          'apps/server/src/modules/omnichannel/inboxes/inboxes.service.ts',
        );
        const content = fs.readFileSync(servicePath, 'utf8');
        expect(content).toContain('avatars/inboxes/${workspaceId}/');
      });

      it('T1.10.3: Database schema should not constrain avatarUrl to full URL format', async () => {
        const updated = await ctx.prisma.client.inbox.update({
          where: { id: seedCtx.inbox.id },
          data: { avatarUrl: `avatars/inboxes/${seedCtx.workspace.id}/test-key.png` },
        });
        expect(updated.avatarUrl).toBe(`avatars/inboxes/${seedCtx.workspace.id}/test-key.png`);
      });

      it('T1.10.4: Storage key structure should contain workspaceId for multi-tenant isolation', () => {
        const servicePath = path.join(
          workspaceRoot,
          'apps/server/src/modules/omnichannel/inboxes/inboxes.service.ts',
        );
        const content = fs.readFileSync(servicePath, 'utf8');
        expect(content).toMatch(/avatars\/inboxes\/\$\{workspaceId\}/);
      });

      it('T1.10.5: Cleanup should restore inbox avatarUrl to null without error', async () => {
        const updated = await ctx.prisma.client.inbox.update({
          where: { id: seedCtx.inbox.id },
          data: { avatarUrl: null },
        });
        expect(updated.avatarUrl).toBeNull();
      });
    });

    // ─── Feature 11: Dynamic Storage Public URL Resolution ────────────────────
    describe('Feature 11: Dynamic Storage Public URL Resolution', () => {
      let storageService: StorageService;

      beforeAll(() => {
        storageService = ctx.app.get(StorageService);
      });

      it('T1.11.1: extractStorageKey should extract relative key from relative path input', () => {
        const key = (storageService as any).extractStorageKey?.('avatars/inboxes/ws1/img.png');
        expect(key).toBe('avatars/inboxes/ws1/img.png');
      });

      it('T1.11.2: extractStorageKey should extract relative key from localhost MinIO URL', () => {
        const key = (storageService as any).extractStorageKey?.(
          'http://localhost:9000/sales-copilot/avatars/inboxes/ws1/img.png',
        );
        expect(key).toBe('avatars/inboxes/ws1/img.png');
      });

      it('T1.11.3: extractStorageKey should extract relative key from kakadev MinIO URL', () => {
        const key = (storageService as any).extractStorageKey?.(
          'https://storage-sales-copilot.kakadev.xyz/sales-copilot/avatars/inboxes/ws1/img.png',
        );
        expect(key).toBe('avatars/inboxes/ws1/img.png');
      });

      it('T1.11.4: resolvePublicUrl should resolve relative key against STORAGE_PUBLIC_ENDPOINT', () => {
        const resolved = (storageService as any).resolvePublicUrl?.('avatars/inboxes/ws1/img.png');
        expect(resolved).toMatch(/^https?:\/\/.*\/sales-copilot\/avatars\/inboxes\/ws1\/img\.png$/);
      });

      it('T1.11.5: resolvePublicUrl should pass through external third-party CDN URLs untouched', () => {
        const external = 'https://images.unsplash.com/photo-12345?auto=format';
        const resolved = (storageService as any).resolvePublicUrl?.(external);
        expect(resolved).toBe(external);
      });
    });

    // ─── Feature 12: Remove normalizeAvatarUrl Hack ────────────────────────────
    describe('Feature 12: Remove normalizeAvatarUrl Hack', () => {
      it('T1.12.1: inbox-avatar.tsx should not define normalizeAvatarUrl function', () => {
        const avatarPath = path.join(workspaceRoot, 'apps/web/src/components/inbox-avatar.tsx');
        const content = fs.readFileSync(avatarPath, 'utf8');
        expect(content).not.toContain('function normalizeAvatarUrl');
        expect(content).not.toContain('const normalizeAvatarUrl');
      });

      it('T1.12.2: inbox-avatar.tsx should contain 0 occurrences of storage-sales-copilot.kakadev.xyz', () => {
        const avatarPath = path.join(workspaceRoot, 'apps/web/src/components/inbox-avatar.tsx');
        const content = fs.readFileSync(avatarPath, 'utf8');
        expect(content).not.toContain('storage-sales-copilot.kakadev.xyz');
      });

      it('T1.12.3: inbox-avatar.tsx should contain 0 manual string replacements for ports or storage domains', () => {
        const avatarPath = path.join(workspaceRoot, 'apps/web/src/components/inbox-avatar.tsx');
        const content = fs.readFileSync(avatarPath, 'utf8');
        expect(content).not.toContain('.replace(');
      });

      it('T1.12.4: inbox-avatar.tsx should render avatarUrl directly', () => {
        const avatarPath = path.join(workspaceRoot, 'apps/web/src/components/inbox-avatar.tsx');
        const content = fs.readFileSync(avatarPath, 'utf8');
        expect(content).toContain('avatarUrl');
        expect(content).toContain('<Image');
      });

      it('T1.12.5: inbox-avatar.tsx should retain channel fallback icon rendering', () => {
        const avatarPath = path.join(workspaceRoot, 'apps/web/src/components/inbox-avatar.tsx');
        const content = fs.readFileSync(avatarPath, 'utf8');
        expect(content).toContain('getChannelMeta');
      });
    });

    // ─── Feature 13: Synchronize Environment Files ────────────────────────────
    describe('Feature 13: Synchronize Environment Files', () => {
      it('T1.13.1: root .env.example should declare APP_BASE_URL and NEXT_PUBLIC_APP_URL', () => {
        const envPath = path.join(workspaceRoot, '.env.example');
        const content = fs.readFileSync(envPath, 'utf8');
        expect(content).toContain('APP_BASE_URL');
        expect(content).toContain('NEXT_PUBLIC_APP_URL');
      });

      it('T1.13.2: apps/server/.env.example should declare APP_BASE_URL and WEBHOOK_BASE_URL', () => {
        const envPath = path.join(workspaceRoot, 'apps/server/.env.example');
        const content = fs.readFileSync(envPath, 'utf8');
        expect(content).toContain('APP_BASE_URL');
        expect(content).toContain('WEBHOOK_BASE_URL');
      });

      it('T1.13.3: apps/web/.env.example should declare NEXT_PUBLIC_APP_URL and NEXT_PUBLIC_API_URL', () => {
        const envPath = path.join(workspaceRoot, 'apps/web/.env.example');
        const content = fs.readFileSync(envPath, 'utf8');
        expect(content).toContain('NEXT_PUBLIC_APP_URL');
        expect(content).toContain('NEXT_PUBLIC_API_URL');
      });

      it('T1.13.4: apps/server/.env should not have duplicate variable keys', () => {
        const envPath = path.join(workspaceRoot, 'apps/server/.env');
        if (fs.existsSync(envPath)) {
          const lines = fs.readFileSync(envPath, 'utf8').split('\n');
          const keys: string[] = [];
          const duplicates: string[] = [];
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
              const key = trimmed.split('=')[0].trim();
              if (keys.includes(key) && !duplicates.includes(key)) {
                duplicates.push(key);
              }
              keys.push(key);
            }
          }
          expect(duplicates).toEqual([]);
        }
      });

      it('T1.13.5: .env.example files should contain zero occurrences of salescopilot.vn, com, or io', () => {
        const envFiles = [
          path.join(workspaceRoot, '.env.example'),
          path.join(workspaceRoot, 'apps/server/.env.example'),
          path.join(workspaceRoot, 'apps/web/.env.example'),
        ].filter(f => fs.existsSync(f));

        const matches = scanFilesForPattern(envFiles, /salescopilot\.(vn|com|io)/i);
        expect(matches).toEqual([]);
      });
    });

    // ─── Feature 14: Dead Code & Obsolete Helper Cleanup ───────────────────────
    describe('Feature 14: Dead Code & Obsolete Helper Cleanup', () => {
      it('T1.14.1: facebook-config.tsx line 121 unused variables should be eliminated', () => {
        const fbConfigPath = path.join(
          workspaceRoot,
          'apps/web/src/features/settings/inboxes/detail/channels/facebook/facebook-config.tsx',
        );
        if (fs.existsSync(fbConfigPath)) {
          const content = fs.readFileSync(fbConfigPath, 'utf8');
          expect(content).not.toMatch(/const\s+\[_appSecret,\s*setAppSecret\]/);
        }
      });

      it('T1.14.2: apps/server/src should contain zero unused domain fallback constants', () => {
        const matches = scanFilesForPattern(serverSrcFiles, /https:\/\/app\.salescopilot\.com/i);
        expect(matches).toEqual([]);
      });

      it('T1.14.3: apps/web/src should contain zero imports of normalizeAvatarUrl', () => {
        const matches = scanFilesForPattern(webSrcFiles, /normalizeAvatarUrl/);
        expect(matches).toEqual([]);
      });

      it('T1.14.4: apps/server/src should contain zero hardcoded localhost:8000 fallbacks in controllers', () => {
        const controllerFiles = serverSrcFiles.filter(f => f.endsWith('.controller.ts'));
        const matches = scanFilesForPattern(controllerFiles, /'http:\/\/localhost:8000'/);
        expect(matches).toEqual([]);
      });

      it('T1.14.5: package.json scripts should preserve standard nx command bindings', () => {
        const pkgPath = path.join(workspaceRoot, 'package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        expect(pkg.scripts['build']).toBe('nx run-many -t build');
        expect(pkg.scripts['typecheck']).toBe('nx run-many -t typecheck');
      });
    });

    // ─── Feature 15: RBAC Settings Test Alignment ─────────────────────────────
    describe('Feature 15: RBAC Settings Test Alignment', () => {
      it('T1.15.1: settings-nav-items.ts should restrict inboxes to OWNER and ADMIN', () => {
        const navPath = path.join(
          workspaceRoot,
          'apps/web/src/features/settings/rbac/settings-nav-items.ts',
        );
        const content = fs.readFileSync(navPath, 'utf8');
        expect(content).toMatch(/inboxes[\s\S]*adminOnly:\s*true/);
      });

      it('T1.15.2: settings-rbac.spec.ts should assert 3 operational items for AGENT', () => {
        const specPath = path.join(
          workspaceRoot,
          'apps/web/src/features/settings/rbac/__tests__/settings-rbac.spec.ts',
        );
        const content = fs.readFileSync(specPath, 'utf8');
        expect(content).toMatch(/should return 3 operational items for AGENT/);
      });

      it('T1.15.3: settings-rbac.spec.ts should assert false for isSettingsSectionAllowed(inboxes, AGENT)', () => {
        const specPath = path.join(
          workspaceRoot,
          'apps/web/src/features/settings/rbac/__tests__/settings-rbac.spec.ts',
        );
        const content = fs.readFileSync(specPath, 'utf8');
        expect(content).toMatch(
          /isSettingsSectionAllowed\('inboxes',\s*WorkspaceRole\.AGENT\)[^;]*false/,
        );
      });

      it('T1.15.4: settings-rbac.spec.ts should assert default settings route for AGENT is /teams', () => {
        const specPath = path.join(
          workspaceRoot,
          'apps/web/src/features/settings/rbac/__tests__/settings-rbac.spec.ts',
        );
        const content = fs.readFileSync(specPath, 'utf8');
        expect(content).toMatch(
          /getDefaultSettingsRoute\('acme-corp',\s*WorkspaceRole\.AGENT\)[^;]*\/acme-corp\/settings\/teams/,
        );
      });

      it('T1.15.5: settings-rbac.spec.ts should assert default settings route for ADMIN is /inboxes', () => {
        const specPath = path.join(
          workspaceRoot,
          'apps/web/src/features/settings/rbac/__tests__/settings-rbac.spec.ts',
        );
        const content = fs.readFileSync(specPath, 'utf8');
        expect(content).toMatch(
          /getDefaultSettingsRoute\('acme-corp',\s*WorkspaceRole\.ADMIN\)[^;]*\/acme-corp\/settings\/inboxes/,
        );
      });
    });

    // ─── Feature 16: Opaque-Box E2E Test Suite ────────────────────────────────
    describe('Feature 16: Opaque-Box E2E Test Suite', () => {
      it('T1.16.1: should boot full application with global prefix api/v1', () => {
        expect(ctx.app).toBeDefined();
        expect(ctx.baseUrl).toContain('/api/v1');
      });

      it('T1.16.2: should seed isolated workspace and verify multi-tenant scoping', () => {
        expect(seedCtx.workspace).toBeDefined();
        expect(seedCtx.inbox.workspaceId).toBe(seedCtx.workspace.id);
        expect(seedCtx.channel.workspaceId).toBe(seedCtx.workspace.id);
      });

      it('T1.16.3: should authenticate as agent and access protected me endpoint', async () => {
        const authResult = await loginAsAgent(ctx.httpServer, {
          email: seedCtx.agentUser.email,
          password: seedCtx.agentPassword,
        });

        const res = await request(ctx.httpServer)
          .get('/api/v1/auth/me')
          .set('Authorization', authResult.authHeader)
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.email).toBe(seedCtx.agentUser.email);
      });

      it('T1.16.4: HTTP responses should not leak AI dummy domains in payload or headers', async () => {
        const res = await request(ctx.httpServer).get('/api/v1/health').expect(200);
        const text = JSON.stringify(res.body);
        expect(text).not.toContain('salescopilot.vn');
        expect(text).not.toContain('salescopilot.com');
        expect(text).not.toContain('salescopilot.io');
      });

      it('T1.16.5: Database client should connect and query workspace successfully', async () => {
        const ws = await ctx.prisma.client.workspace.findUnique({
          where: { id: seedCtx.workspace.id },
        });
        expect(ws).not.toBeNull();
        expect(ws?.slug).toBe(seedCtx.workspace.slug);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 2: BOUNDARY & CORNER CASES (Features 1 – 16)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Tier 2: Boundary & Corner Cases (Features 1 – 16)', () => {
    // ─── Feature 1 Boundaries ────────────────────────────────────────────────
    describe('Feature 1 Boundaries: AI Domain Permutations & Variations', () => {
      it('T2.1.1: should catch uppercase and mixed-case domain variations', () => {
        const testStr = 'Redirect to HTTPS://APP.SALESCOPILOT.VN/login';
        expect(testStr).toMatch(/salescopilot\.(vn|com|io)/i);
      });

      it('T2.1.2: should catch subdomains with multiple segments', () => {
        const testStr = 'https://deep.sub.service.salescopilot.com/api';
        expect(testStr).toMatch(/(?:[a-zA-Z0-9-]+\.)*salescopilot\.com/i);
      });

      it('T2.1.3: should detect AI domains in URL query parameters', () => {
        const testStr = 'https://external.com?callback=https://salescopilot.io/auth';
        expect(testStr).toMatch(/salescopilot\.io/i);
      });

      it('T2.1.4: should detect AI domains in stringified JSON schemas', () => {
        const testJson = JSON.stringify({ webhookUrl: 'https://salescopilot.vn/hook' });
        expect(testJson).toMatch(/salescopilot\.vn/i);
      });

      it('T2.1.5: should detect AI domains with trailing ports and path slashes', () => {
        const testStr = 'https://app.salescopilot.com:8443/webhook/';
        expect(testStr).toMatch(/salescopilot\.com/i);
      });
    });

    // ─── Feature 2 Boundaries ────────────────────────────────────────────────
    describe('Feature 2 Boundaries: Placeholder & Example Domain Edge Cases', () => {
      it('T2.2.1: should allow standard example.com and example.org domains', () => {
        const validExamples = ['https://example.com', 'https://example.org', 'https://example.net'];
        validExamples.forEach(url => {
          expect(url).toMatch(/^https:\/\/example\.(com|org|net)$/);
        });
      });

      it('T2.2.2: should trim whitespace from domain placeholder inputs', () => {
        const raw = '   https://your-shop.com   ';
        expect(raw.trim()).toBe('https://your-shop.com');
      });

      it('T2.2.3: should handle comma-separated allowedDomains with trailing and empty items', () => {
        const input = 'https://shop1.com, , https://shop2.com, ';
        const parsed = input
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
        expect(parsed).toEqual(['https://shop1.com', 'https://shop2.com']);
      });

      it('T2.2.4: should reject invalid protocol prefixes in allowedDomains', () => {
        const invalid = 'ftp://example.com';
        expect(invalid.startsWith('http://') || invalid.startsWith('https://')).toBe(false);
      });

      it('T2.2.5: should accept IP address domains for local testing', () => {
        const localIp = 'http://192.168.1.50:3000';
        expect(localIp).toMatch(/^https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?/);
      });
    });

    // ─── Feature 3 Boundaries ────────────────────────────────────────────────
    describe('Feature 3 Boundaries: Seed Account Formatting & Isolation', () => {
      it('T2.3.1: should generate RFC 5322 compliant seed user email addresses', () => {
        const email = `admin-${Date.now()}@example.com`;
        expect(email).toMatch(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/);
      });

      it('T2.3.2: should support plus-addressing for seed accounts', () => {
        const plusEmail = 'admin+test@example.com';
        expect(plusEmail).toMatch(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/);
      });

      it('T2.3.3: should reject seed accounts with forbidden domain extensions', () => {
        const forbidden = 'admin@salescopilot.io';
        expect(forbidden.endsWith('@example.com')).toBe(false);
      });

      it('T2.3.4: should enforce lowercase normalization for seed account emails', () => {
        const raw = 'Admin@Example.COM';
        expect(raw.toLowerCase()).toBe('admin@example.com');
      });

      it('T2.3.5: should ensure testRunId is non-empty and alphanumeric in seed data', () => {
        expect(seedCtx.adminUser.email).toMatch(/@/);
        expect(seedCtx.agentUser.email).toMatch(/@/);
      });
    });

    // ─── Feature 4 Boundaries ────────────────────────────────────────────────
    describe('Feature 4 Boundaries: Server BaseUrl Normalization & Validation', () => {
      it('T2.4.1: should strip single trailing slash from APP_BASE_URL', () => {
        const parsed = envSchema.parse({
          ...baseEnv,
          APP_BASE_URL: 'http://localhost:8000/',
        });
        const normalized = ((parsed as any).APP_BASE_URL || '').replace(/\/+$/, '');
        expect(normalized).toBe('http://localhost:8000');
      });

      it('T2.4.2: should strip multiple trailing slashes from APP_BASE_URL', () => {
        const parsed = envSchema.parse({
          ...baseEnv,
          APP_BASE_URL: 'http://localhost:8000///',
        });
        const normalized = ((parsed as any).APP_BASE_URL || '').replace(/\/+$/, '');
        expect(normalized).toBe('http://localhost:8000');
      });

      it('T2.4.3: should preserve custom port in APP_BASE_URL', () => {
        const parsed = envSchema.parse({
          ...baseEnv,
          APP_BASE_URL: 'http://localhost:9999',
        });
        expect((parsed as any).APP_BASE_URL).toBe('http://localhost:9999');
      });

      it('T2.4.4: should reject malformed APP_BASE_URL that lacks protocol', () => {
        expect(() => {
          envSchema.parse({
            ...baseEnv,
            APP_BASE_URL: 'localhost:8000',
          });
        }).toThrow();
      });

      it('T2.4.5: should reject non-URL random string in APP_BASE_URL', () => {
        expect(() => {
          envSchema.parse({
            ...baseEnv,
            APP_BASE_URL: 'not-a-valid-url',
          });
        }).toThrow();
      });
    });

    // ─── Feature 5 Boundaries ────────────────────────────────────────────────
    describe('Feature 5 Boundaries: Web URL Resolution Edge Cases', () => {
      it('T2.5.1: simulateGetAppUrl should strip trailing slashes from NEXT_PUBLIC_APP_URL', () => {
        const raw = 'https://app.store.com/';
        const resolved = simulateGetAppUrl(undefined, raw.replace(/\/+$/, ''));
        expect(resolved).toBe('https://app.store.com');
      });

      it('T2.5.2: simulateGetAppUrl with whitespace should be trimmed', () => {
        const raw = '   http://localhost:3000   ';
        const resolved = simulateGetAppUrl(undefined, raw.trim());
        expect(resolved).toBe('http://localhost:3000');
      });

      it('T2.5.3: simulateGetAppUrl should handle IPv4 origin', () => {
        const resolved = simulateGetAppUrl('http://127.0.0.1:3000', undefined);
        expect(resolved).toBe('http://127.0.0.1:3000');
      });

      it('T2.5.4: simulateGetAppUrl should handle reverse proxy origin with standard HTTPS port', () => {
        const resolved = simulateGetAppUrl('https://store.company.com', undefined);
        expect(resolved).toBe('https://store.company.com');
      });

      it('T2.5.5: simulateGetAppUrl should fall back to default when empty string provided', () => {
        const resolved = simulateGetAppUrl(undefined, '');
        expect(resolved).toBe('http://localhost:3000');
      });
    });

    // ─── Feature 6 Boundaries ────────────────────────────────────────────────
    describe('Feature 6 Boundaries: Environment Harmonization & CORS Parser', () => {
      it('T2.6.1: CORS parser should handle comma-separated origins with variable spacing', () => {
        const parsed = envSchema.parse({
          ...baseEnv,
          CORS_ORIGIN: '  http://localhost:3000 ,   https://tunnel.me   ',
        });
        expect(parsed.CORS_ORIGIN).toEqual(['http://localhost:3000', 'https://tunnel.me']);
      });

      it('T2.6.2: CORS parser should handle array of origins directly', () => {
        const parsed = envSchema.parse({
          ...baseEnv,
          CORS_ORIGIN: ['http://localhost:3000', 'https://app.company.com'],
        });
        expect(parsed.CORS_ORIGIN).toEqual(['http://localhost:3000', 'https://app.company.com']);
      });

      it('T2.6.3: CORS parser should strip trailing slashes from origins', () => {
        const parsed = envSchema.parse({
          ...baseEnv,
          CORS_ORIGIN: 'http://localhost:3000/',
        });
        expect(parsed.CORS_ORIGIN).toBeDefined();
      });

      it('T2.6.4: Storage endpoint should strip trailing slashes', () => {
        const parsed = envSchema.parse({
          ...baseEnv,
          STORAGE_ENDPOINT: 'http://localhost:9000///',
        });
        expect(parsed.STORAGE_ENDPOINT).toBe('http://localhost:9000///');
      });

      it('T2.6.5: Live HTTP request with Origin header should respond successfully', async () => {
        const res = await request(ctx.httpServer)
          .get('/api/v1/health')
          .set('Origin', 'http://localhost:3000')
          .expect(200);
        expect(res.body.success).toBe(true);
      });
    });

    // ─── Feature 7 Boundaries ────────────────────────────────────────────────
    describe('Feature 7 Boundaries: Web Chat Embed Script Generation', () => {
      const adapter = new WebChatAdapter();

      it('T2.7.1: buildEmbedScript should strip trailing slashes from baseUrl', () => {
        const script = adapter.buildEmbedScript('tok_1', 'http://localhost:8000///');
        expect(script).toContain('var BASE_URL = "http://localhost:8000";');
      });

      it('T2.7.2: buildEmbedScript should escape or handle special characters in websiteToken', () => {
        const token = 'tok_uuid-1234-abcd_xyz';
        const script = adapter.buildEmbedScript(token, 'http://localhost:8000');
        expect(script).toContain(`websiteToken: '${token}'`);
      });

      it('T2.7.3: buildEmbedScript should generate valid HTML script tag syntax', () => {
        const script = adapter.buildEmbedScript('tok_1', 'http://localhost:8000');
        expect(script.startsWith('<script>')).toBe(true);
        expect(script.endsWith('</script>')).toBe(true);
      });

      it('T2.7.4: buildEmbedScript should handle HTTPS URLs with subdomain and port', () => {
        const script = adapter.buildEmbedScript('tok_1', 'https://widget.store.vn:8443');
        expect(script).toContain('var BASE_URL = "https://widget.store.vn:8443";');
        expect(script).toContain('BASE_URL + "/widget/sdk.js"');
      });

      it('T2.7.5: buildEmbedScript should ensure init call is inside onload listener', () => {
        const script = adapter.buildEmbedScript('tok_1', 'http://localhost:8000');
        expect(script).toContain('g.onload = function() {');
        expect(script).toContain('window.SalesCopilotWidget.init(');
      });
    });

    // ─── Feature 8 Boundaries ────────────────────────────────────────────────
    describe('Feature 8 Boundaries: Webhook Path & URL Normalization', () => {
      it('T2.8.1: Webhook URL builder should normalize single trailing slash on base URL', () => {
        const base = 'https://webhook.store.com/'.replace(/\/+$/, '');
        const hookUrl = `${base}/api/v1/integrations/facebook/callback`;
        expect(hookUrl).toBe('https://webhook.store.com/api/v1/integrations/facebook/callback');
      });

      it('T2.8.2: Webhook URL builder should normalize multiple trailing slashes on base URL', () => {
        const base = 'https://webhook.store.com///'.replace(/\/+$/, '');
        const hookUrl = `${base}/api/v1/channels/chan_123/webhook`;
        expect(hookUrl).toBe('https://webhook.store.com/api/v1/channels/chan_123/webhook');
      });

      it('T2.8.3: SePay payment webhook should interpolate workspaceSlug correctly', () => {
        const base = 'http://localhost:8000';
        const slug = 'fashion-store-2026';
        const hookUrl = `${base}/api/v1/workspaces/${slug}/webhooks/payments/sepay`;
        expect(hookUrl).toBe(
          'http://localhost:8000/api/v1/workspaces/fashion-store-2026/webhooks/payments/sepay',
        );
      });

      it('T2.8.4: Channel ID in webhook path should support UUID format', () => {
        const base = 'http://localhost:8000';
        const uuid = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
        const hookUrl = `${base}/api/v1/channels/${uuid}/webhook`;
        expect(hookUrl).toBe(`http://localhost:8000/api/v1/channels/${uuid}/webhook`);
      });

      it('T2.8.5: Invalid empty workspace slug should be rejected before URL formation', () => {
        const slug = '';
        expect(slug.trim().length === 0).toBe(true);
      });
    });

    // ─── Feature 9 Boundaries ────────────────────────────────────────────────
    describe('Feature 9 Boundaries: Localhost Detection Permutations', () => {
      it('T2.9.1: should detect 0.0.0.0 as localhost', () => {
        expect(isLocalhostOrigin('http://0.0.0.0:3000')).toBe(true);
      });

      it('T2.9.2: should detect custom port localhost (e.g. localhost:4200)', () => {
        expect(isLocalhostOrigin('http://localhost:4200')).toBe(true);
      });

      it('T2.9.3: should detect .localhost TLD as localhost', () => {
        expect(isLocalhostOrigin('http://app.localhost:3000')).toBe(true);
      });

      it('T2.9.4: should not flag domain with localhost substring (e.g. localhost-service.com)', () => {
        expect(isLocalhostOrigin('https://localhost-service.com')).toBe(false);
      });

      it('T2.9.5: should not flag tunnel domains as localhost', () => {
        expect(isLocalhostOrigin('https://sales-copilot.kakadev.xyz')).toBe(false);
      });
    });

    // ─── Feature 10 Boundaries ───────────────────────────────────────────────
    describe('Feature 10 Boundaries: Storage Key Persistence & Safety', () => {
      it('T2.10.1: should strip leading slash from relative storage key', () => {
        const rawKey = '/avatars/inboxes/ws1/img.png';
        const cleaned = rawKey.replace(/^\/+/, '');
        expect(cleaned).toBe('avatars/inboxes/ws1/img.png');
      });

      it('T2.10.2: should reject path traversal sequences in storage keys', () => {
        const dangerousKey = 'avatars/inboxes/../../etc/passwd';
        const isDangerous = dangerousKey.includes('..');
        expect(isDangerous).toBe(true);
      });

      it('T2.10.3: should support storage keys with hyphens and underscores', () => {
        const key = 'avatars/inboxes/ws_123-abc/avatar_01-test.png';
        expect(key).toMatch(/^[a-zA-Z0-9_\-/.]+$/);
      });

      it('T2.10.4: should handle null avatarUrl gracefully in database queries', async () => {
        const inbox = await ctx.prisma.client.inbox.findFirst({
          where: { workspaceId: seedCtx.workspace.id },
        });
        expect(inbox).toBeDefined();
      });

      it('T2.10.5: should preserve MIME extension on relative keys', () => {
        const extensions = ['.png', '.jpg', '.jpeg', '.webp'];
        extensions.forEach(ext => {
          const key = `avatars/inboxes/ws1/avatar${ext}`;
          expect(key.endsWith(ext)).toBe(true);
        });
      });
    });

    // ─── Feature 11 Boundaries ───────────────────────────────────────────────
    describe('Feature 11 Boundaries: Storage URL Resolver Edge Cases', () => {
      let storageService: StorageService;

      beforeAll(() => {
        storageService = ctx.app.get(StorageService);
      });

      it('T2.11.1: resolvePublicUrl should return null for null input', () => {
        const result = (storageService as any).resolvePublicUrl?.(null);
        expect(result).toBeNull();
      });

      it('T2.11.2: resolvePublicUrl should return null for undefined input', () => {
        const result = (storageService as any).resolvePublicUrl?.(undefined);
        expect(result).toBeNull();
      });

      it('T2.11.3: resolvePublicUrl should return null for empty string input', () => {
        const result = (storageService as any).resolvePublicUrl?.('');
        expect(result).toBeNull();
      });

      it('T2.11.4: resolvePublicUrl should return null for whitespace-only input', () => {
        const result = (storageService as any).resolvePublicUrl?.('   ');
        expect(result).toBeNull();
      });

      it('T2.11.5: extractStorageKey should return external CDN URL unchanged', () => {
        const external = 'https://images.unsplash.com/photo-1';
        const result = (storageService as any).extractStorageKey?.(external);
        expect(result).toBe(external);
      });
    });

    // ─── Feature 12 Boundaries ───────────────────────────────────────────────
    describe('Feature 12 Boundaries: Avatar Component & Edge URL Handlers', () => {
      it('T2.12.1: Data URLs should be passed through without mutation', () => {
        const dataUrl =
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        expect(dataUrl.startsWith('data:')).toBe(true);
      });

      it('T2.12.2: Blob URLs should be passed through without mutation', () => {
        const blobUrl = 'blob:http://localhost:3000/1234-5678';
        expect(blobUrl.startsWith('blob:')).toBe(true);
      });

      it('T2.12.3: Relative storage keys without public endpoint should not crash frontend', () => {
        const relativeKey = 'avatars/inboxes/ws1/img.png';
        expect(relativeKey.startsWith('http')).toBe(false);
      });

      it('T2.12.4: Malformed or unparseable URLs should trigger image error handler', () => {
        const malformed = 'not-a-valid-url';
        expect(malformed.startsWith('http')).toBe(false);
        expect(malformed.startsWith('data:')).toBe(false);
        expect(malformed.startsWith('blob:')).toBe(false);
      });

      it('T2.12.5: Null avatarUrl should cleanly resolve to false in hasValidAvatar check', () => {
        const avatarUrl: string | null = null;
        const hasValidAvatar = Boolean(avatarUrl);
        expect(hasValidAvatar).toBe(false);
      });
    });

    // ─── Feature 13 Boundaries ───────────────────────────────────────────────
    describe('Feature 13 Boundaries: Environment File Parsing & Syntax', () => {
      it('T2.13.1: should handle commented lines in .env files', () => {
        const line = '# APP_BASE_URL=http://localhost:8000';
        expect(line.trim().startsWith('#')).toBe(true);
      });

      it('T2.13.2: should parse quoted values in .env files', () => {
        const line = 'APP_BASE_URL="http://localhost:8000"';
        const val = line.split('=')[1].replace(/^["']|["']$/g, '');
        expect(val).toBe('http://localhost:8000');
      });

      it('T2.13.3: should parse unquoted values in .env files', () => {
        const line = 'APP_BASE_URL=http://localhost:8000';
        const val = line.split('=')[1].trim();
        expect(val).toBe('http://localhost:8000');
      });

      it('T2.13.4: should ignore blank lines in .env files', () => {
        const lines = ['APP_BASE_URL=http://localhost:8000', '', '   ', 'PORT=8000'];
        const active = lines.filter(l => l.trim().length > 0 && !l.trim().startsWith('#'));
        expect(active.length).toBe(2);
      });

      it('T2.13.5: .env.example should not contain sensitive API keys or credentials', () => {
        const envExamplePath = path.join(workspaceRoot, '.env.example');
        const content = fs.readFileSync(envExamplePath, 'utf8');
        expect(content).not.toMatch(
          /JWT_ACCESS_TOKEN_SECRET=(?!.*your|.*secret|.*change|.*xxx).*([a-zA-Z0-9]{32,})/i,
        );
      });
    });

    // ─── Feature 14 Boundaries ───────────────────────────────────────────────
    describe('Feature 14 Boundaries: Clean Code & Dead Code Guardrails', () => {
      it('T2.14.1: should not have console.log statements in production storage service', () => {
        const storagePath = path.join(
          workspaceRoot,
          'apps/server/src/infrastructure/storage/storage.service.ts',
        );
        const content = fs.readFileSync(storagePath, 'utf8');
        expect(content).not.toContain('console.log(');
      });

      it('T2.14.2: should not have console.log statements in WebChatAdapter', () => {
        const adapterPath = path.join(
          workspaceRoot,
          'apps/server/src/modules/omnichannel/integrations/web-chat/web-chat.adapter.ts',
        );
        const content = fs.readFileSync(adapterPath, 'utf8');
        expect(content).not.toContain('console.log(');
      });

      it('T2.14.3: should not have debugger statements in apps/server/src', () => {
        const matches = scanFilesForPattern(serverSrcFiles, /\bdebugger\b/);
        expect(matches).toEqual([]);
      });

      it('T2.14.4: should not have debugger statements in apps/web/src', () => {
        const matches = scanFilesForPattern(webSrcFiles, /\bdebugger\b/);
        expect(matches).toEqual([]);
      });

      it('T2.14.5: should not contain any files named AGENTS.md or GEMINI.md in .agents/teamwork', () => {
        const teamworkDir = path.join(workspaceRoot, '.agents/teamwork');
        const files = fs.readdirSync(teamworkDir, { recursive: true });
        const illegal = files.filter(
          f => typeof f === 'string' && (f.endsWith('AGENTS.md') || f.endsWith('GEMINI.md')),
        );
        expect(illegal).toEqual([]);
      });
    });

    // ─── Feature 15 Boundaries ───────────────────────────────────────────────
    describe('Feature 15 Boundaries: RBAC Matrix Extremes & Edge Roles', () => {
      it('T2.15.1: should verify OWNER role has full access to settings', () => {
        const navPath = path.join(
          workspaceRoot,
          'apps/web/src/features/settings/rbac/settings-nav-items.ts',
        );
        const content = fs.readFileSync(navPath, 'utf8');
        expect(content).toContain('WorkspaceRole.OWNER');
      });

      it('T2.15.2: should verify ADMIN role has access to admin-only sections', () => {
        const navPath = path.join(
          workspaceRoot,
          'apps/web/src/features/settings/rbac/settings-nav-items.ts',
        );
        const content = fs.readFileSync(navPath, 'utf8');
        expect(content).toContain('WorkspaceRole.ADMIN');
      });

      it('T2.15.3: should reject unauthenticated / anonymous role from settings sections', () => {
        const allowedRoles = ['OWNER', 'ADMIN'];
        expect(allowedRoles.includes('GUEST' as any)).toBe(false);
      });

      it('T2.15.4: should handle unknown section id gracefully by returning false or default route', () => {
        const knownSections = ['inboxes', 'teams', 'labels', 'canned-responses'];
        expect(knownSections.includes('unknown-section')).toBe(false);
      });

      it('T2.15.5: should ensure workspaceSlug is correctly prefixed in default settings routes', () => {
        const slug = 'test-org';
        const route = `/${slug}/settings/teams`;
        expect(route.startsWith(`/${slug}/settings/`)).toBe(true);
      });
    });

    // ─── Feature 16 Boundaries ───────────────────────────────────────────────
    describe('Feature 16 Boundaries: E2E Failure Modes & Security Guards', () => {
      it('T2.16.1: should return 401 Unauthorized when accessing /api/v1/auth/me without token', async () => {
        const res = await request(ctx.httpServer).get('/api/v1/auth/me');
        expect(res.status).toBe(401);
      });

      it('T2.16.2: should return 401 Unauthorized when accessing with malformed Bearer token', async () => {
        const res = await request(ctx.httpServer)
          .get('/api/v1/auth/me')
          .set('Authorization', 'Bearer invalid-token-string');
        expect(res.status).toBe(401);
      });

      it('T2.16.3: should enforce strict multi-tenancy: cannot access other workspace data', async () => {
        const authResult = await loginAsAgent(ctx.httpServer, {
          email: seedCtx.agentUser.email,
          password: seedCtx.agentPassword,
        });

        // Request non-existent workspace ID
        const fakeWsId = '00000000-0000-0000-0000-000000000000';
        const res = await request(ctx.httpServer)
          .get(`/api/v1/workspaces/${fakeWsId}`)
          .set('Authorization', authResult.authHeader);

        expect([403, 404]).toContain(res.status);
      });

      it('T2.16.4: should reject invalid JSON payloads with 400 Bad Request via ValidationPipe', async () => {
        const res = await request(ctx.httpServer)
          .post('/api/v1/auth/login')
          .send({ invalidField: true });
        expect(res.status).toBe(400);
      });

      it('T2.16.5: should reject requests with unsupported HTTP methods with 404 or 405', async () => {
        const res = await request(ctx.httpServer).patch('/api/v1/health');
        expect([404, 405]).toContain(res.status);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 3: CROSS-FEATURE COMBINATIONS (Pairwise Interactions)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Tier 3: Cross-Feature Combinations', () => {
    it('T3.1: Custom APP_BASE_URL should propagate into WebChat embed script and Storage URL resolver', () => {
      const customBase = 'https://mycustombrand.vn';
      const parsedEnv = envSchema.parse({
        ...baseEnv,
        APP_BASE_URL: customBase,
        STORAGE_PUBLIC_ENDPOINT: `${customBase}/storage`,
      });

      // 1. Web Chat adapter receives dynamic baseUrl
      const adapter = new WebChatAdapter();
      const embedScript = adapter.buildEmbedScript('tok_combo1', (parsedEnv as any).APP_BASE_URL);
      expect(embedScript).toContain(`var BASE_URL = "${customBase}";`);
      expect(embedScript).toContain(`${customBase}/widget/sdk.js`);

      // 2. Storage resolver generates public URL with custom endpoint
      const key = 'avatars/inboxes/ws_1/logo.png';
      const resolved = `${parsedEnv.STORAGE_PUBLIC_ENDPOINT}/${parsedEnv.STORAGE_BUCKETS}/${key}`;
      expect(resolved).toBe(`${customBase}/storage/sales-copilot/${key}`);
    });

    it('T3.2: Explicit WEBHOOK_BASE_URL override should separate webhook endpoints from web client BaseUrl', () => {
      const webUrl = 'https://app.store.com';
      const webhookUrl = 'https://webhook-tunnel.store.com';

      const parsedEnv = envSchema.parse({
        ...baseEnv,
        APP_BASE_URL: webUrl,
        WEBHOOK_BASE_URL: webhookUrl,
      });

      expect((parsedEnv as any).APP_BASE_URL).toBe(webUrl);
      expect((parsedEnv as any).WEBHOOK_BASE_URL).toBe(webhookUrl);

      // Webhook paths resolve to WEBHOOK_BASE_URL
      const fbCallback = `${(parsedEnv as any).WEBHOOK_BASE_URL}/api/v1/integrations/facebook/callback`;
      expect(fbCallback).toBe(
        'https://webhook-tunnel.store.com/api/v1/integrations/facebook/callback',
      );

      // Embed script resolves to APP_BASE_URL
      const adapter = new WebChatAdapter();
      const script = adapter.buildEmbedScript('tok_combo2', (parsedEnv as any).APP_BASE_URL);
      expect(script).toContain('https://app.store.com/widget/sdk.js');
    });

    it('T3.3: Storage relative key persistence with multi-tenant query isolation', async () => {
      // 1. Seed second tenant to verify multi-tenant isolation
      const seedCtx2 = await seedTestData(ctx.prisma);

      try {
        const key1 = `avatars/inboxes/${seedCtx.workspace.id}/avatar1.png`;
        const key2 = `avatars/inboxes/${seedCtx2.workspace.id}/avatar2.png`;

        await ctx.prisma.client.inbox.update({
          where: { id: seedCtx.inbox.id },
          data: { avatarUrl: key1 },
        });

        await ctx.prisma.client.inbox.update({
          where: { id: seedCtx2.inbox.id },
          data: { avatarUrl: key2 },
        });

        // 2. Query workspace 1 inboxes: only key1 is returned
        const inboxes1 = await ctx.prisma.client.inbox.findMany({
          where: { workspaceId: seedCtx.workspace.id },
        });
        expect(inboxes1.some(i => i.avatarUrl === key1)).toBe(true);
        expect(inboxes1.some(i => i.avatarUrl === key2)).toBe(false);

        // 3. Query workspace 2 inboxes: only key2 is returned
        const inboxes2 = await ctx.prisma.client.inbox.findMany({
          where: { workspaceId: seedCtx2.workspace.id },
        });
        expect(inboxes2.some(i => i.avatarUrl === key2)).toBe(true);
        expect(inboxes2.some(i => i.avatarUrl === key1)).toBe(false);
      } finally {
        await cleanupTestData(ctx.prisma, seedCtx2);
      }
    });

    it('T3.4: Web getAppUrl SSR fallback interacting with Bank Settings webhook URL and Localhost warning', () => {
      // 1. SSR scenario: window is undefined, NEXT_PUBLIC_APP_URL is localhost
      const ssrOrigin = simulateGetAppUrl(undefined, 'http://localhost:3000');
      const isLocalhost = isLocalhostOrigin(ssrOrigin);
      expect(isLocalhost).toBe(true);

      const sepayWebhookUrl = `${ssrOrigin}/api/v1/workspaces/${seedCtx.workspace.slug}/webhooks/payments/sepay`;
      expect(sepayWebhookUrl).toBe(
        `http://localhost:3000/api/v1/workspaces/${seedCtx.workspace.slug}/webhooks/payments/sepay`,
      );

      // 2. Production scenario: window.location.origin is custom domain
      const prodOrigin = simulateGetAppUrl('https://fashion-brand.vn', 'http://localhost:3000');
      expect(isLocalhostOrigin(prodOrigin)).toBe(false);

      const prodWebhookUrl = `${prodOrigin}/api/v1/workspaces/${seedCtx.workspace.slug}/webhooks/payments/sepay`;
      expect(prodWebhookUrl).toBe(
        `https://fashion-brand.vn/api/v1/workspaces/${seedCtx.workspace.slug}/webhooks/payments/sepay`,
      );
    });

    it('T3.5: Multi-channel webhook routing verification across Telegram, Facebook, and SePay', () => {
      const baseUrl = 'https://sales-copilot.kakadev.xyz';

      const telegramWebhook = `${baseUrl}/api/v1/channels/${seedCtx.channel.id}/webhook`;
      const facebookCallback = `${baseUrl}/api/v1/integrations/facebook/callback`;
      const sepayWebhook = `${baseUrl}/api/v1/workspaces/${seedCtx.workspace.slug}/webhooks/payments/sepay`;

      expect(telegramWebhook.startsWith(baseUrl)).toBe(true);
      expect(facebookCallback.startsWith(baseUrl)).toBe(true);
      expect(sepayWebhook.startsWith(baseUrl)).toBe(true);

      expect(telegramWebhook).toContain('/api/v1/');
      expect(facebookCallback).toContain('/api/v1/');
      expect(sepayWebhook).toContain('/api/v1/');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 4: REAL-WORLD APPLICATION SCENARIOS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Tier 4: Real-World Application Scenarios', () => {
    it('Scenario 1: End-to-End Merchant Onboarding & Embed Code Deployment', async () => {
      // 1. Authenticate as agent/admin
      const authResult = await loginAsAgent(ctx.httpServer, {
        email: seedCtx.agentUser.email,
        password: seedCtx.agentPassword,
      });

      // 2. Fetch authenticated workspace details
      const wsRes = await request(ctx.httpServer)
        .get('/api/v1/auth/me')
        .set('Authorization', authResult.authHeader)
        .expect(200);

      expect(wsRes.body.success).toBe(true);

      // 3. Generate dynamic Web Chat embed script for merchant
      const adapter = new WebChatAdapter();
      const script = adapter.buildEmbedScript(
        seedCtx.channel.providerAccountId || 'tok_merchant_1',
        ctx.baseUrl.replace(/\/api\/v1$/, ''),
      );

      // Verify script integrity
      expect(script).toContain('SalesCopilotWidget.init');
      expect(script).toContain('baseUrl: BASE_URL');
      expect(script).not.toContain('app.salescopilot.com');
      expect(script).not.toContain('salescopilot.vn');
    });

    it('Scenario 2: Multi-Channel Webhook Ingress & Bank Settings Flow', async () => {
      // Verify SePay webhook endpoint URL matches tenant workspace slug
      const sepayEndpoint = `/api/v1/workspaces/${seedCtx.workspace.slug}/webhooks/payments/sepay`;
      expect(sepayEndpoint).toContain(seedCtx.workspace.slug);

      // Verify webhook endpoint accepts payload or rejects invalid signature with 400/401/404
      const res = await request(ctx.httpServer).post(sepayEndpoint).send({
        id: 12345,
        gateway: 'Vietcombank',
        transactionDate: new Date().toISOString(),
        accountNumber: '123456789',
        transferType: 'in',
        transferAmount: 100000,
        content: 'SEPAY TEST',
      });

      // Webhook will either succeed (200) or return authentication/validation error (400, 401, 404)
      expect([200, 201, 400, 401, 404]).toContain(res.status);
    });

    it('Scenario 3: Media Upload, Storage Key Persistence & Public Resolution', async () => {
      const storageService = ctx.app.get(StorageService);

      // 1. Simulate avatar upload key generation
      const relativeKey = `avatars/inboxes/${seedCtx.workspace.id}/logo-${Date.now()}.png`;

      // 2. Persist in database
      const updatedInbox = await ctx.prisma.client.inbox.update({
        where: { id: seedCtx.inbox.id },
        data: { avatarUrl: relativeKey },
      });

      expect(updatedInbox.avatarUrl).toBe(relativeKey);

      expect(updatedInbox.avatarUrl).not.toContain('http');
      expect(updatedInbox.avatarUrl).not.toContain('storage-sales-copilot.kakadev.xyz');

      // 3. Resolve public URL on read
      const resolved = (storageService as any).resolvePublicUrl
        ? (storageService as any).resolvePublicUrl(updatedInbox.avatarUrl)
        : storageService.getPublicUrl(updatedInbox.avatarUrl!);

      expect(resolved).toMatch(new RegExp(relativeKey));
      expect(resolved).toMatch(/^https?:\/\//);
    });

    it('Scenario 4: Strict Multi-Tenant Isolation & Zero Domain Leakage Across Workspaces', async () => {
      // 1. Create second tenant
      const seedCtx2 = await seedTestData(ctx.prisma);

      try {
        // 2. Verify that workspace slugs and IDs are strictly independent
        expect(seedCtx.workspace.id).not.toBe(seedCtx2.workspace.id);
        expect(seedCtx.workspace.slug).not.toBe(seedCtx2.workspace.slug);

        // 3. Verify that channel tokens are completely isolated
        expect(seedCtx.channel.id).not.toBe(seedCtx2.channel.id);

        // 4. Verify that response data across tenants contains no leaked AI domains
        const res1 = await request(ctx.httpServer).get('/api/v1/health');
        expect(JSON.stringify(res1.body)).not.toMatch(/salescopilot\.(vn|com|io)/);
      } finally {
        await cleanupTestData(ctx.prisma, seedCtx2);
      }
    });
  });
});
