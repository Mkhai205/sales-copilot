import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { zaloApi, type ConnectZaloOaDto } from '../api/zalo';
import { zaloChannelSchema } from '../new/channels/zalo/zalo-schema';

describe('Zalo OA OAuth Connection Flow', () => {
  let originalFetch: typeof globalThis.fetch;
  const workspaceId = 'ws_zalo_test_123';

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('zaloApi Client Methods', () => {
    it('getAuthUrl() should make GET request with workspaceId header and channelId param', async () => {
      let requestedUrl = '';
      let requestedHeaders: Record<string, string> = {};

      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        requestedUrl = url.toString();
        requestedHeaders = (init?.headers || {}) as Record<string, string>;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { authUrl: 'https://oauth.zaloapp.com/v4/oa/permission?app_id=123' },
          }),
        } as unknown as Response;
      }) as typeof globalThis.fetch;

      const res = await zaloApi.getAuthUrl(
        workspaceId,
        'https://app.example.com',
        '/auth/zalo/callback',
        'chan_zalo_1',
      );

      assert.strictEqual(res.success, true);
      assert.ok(requestedUrl.includes('/integrations/zalo/auth-url'));
      assert.ok(requestedUrl.includes(encodeURIComponent('https://app.example.com')));
      assert.ok(requestedUrl.includes('chan_zalo_1'));
      assert.strictEqual(requestedHeaders['X-Workspace-Id'], workspaceId);
    });

    it('getSessionInfo() should make GET request with sessionId query param', async () => {
      let requestedUrl = '';

      globalThis.fetch = (async (url: string | URL | Request) => {
        requestedUrl = url.toString();
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { oaId: 'oa_123', oaName: 'Shop OA', oaAvatar: 'https://zalo/oa.png' },
          }),
        } as unknown as Response;
      }) as typeof globalThis.fetch;

      const res = await zaloApi.getSessionInfo(workspaceId, 'sess_1');

      assert.strictEqual(res.data.oaName, 'Shop OA');
      assert.ok(requestedUrl.includes('/integrations/zalo/session'));
      assert.ok(requestedUrl.includes('sess_1'));
    });

    it('connect() should POST sessionId + oaSecretKey with workspaceId header', async () => {
      let requestedUrl = '';
      let requestedBody: any = {};
      let requestedHeaders: Record<string, string> = {};

      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        requestedUrl = url.toString();
        requestedBody = JSON.parse(String(init?.body || '{}'));
        requestedHeaders = (init?.headers || {}) as Record<string, string>;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { inboxId: 'inbox_1', channelId: 'chan_1', oaId: 'oa_123', oaName: 'Shop OA' },
          }),
        } as unknown as Response;
      }) as typeof globalThis.fetch;

      const dto: ConnectZaloOaDto = {
        sessionId: 'sess_1',
        oaSecretKey: 'my_oa_secret',
        memberUserIds: ['member_1'],
        assignAllMembers: true,
      };
      const res = await zaloApi.connect(workspaceId, dto);

      assert.strictEqual(res.data.inboxId, 'inbox_1');
      assert.ok(requestedUrl.endsWith('/integrations/zalo/connect'));
      assert.strictEqual(requestedBody.sessionId, 'sess_1');
      assert.strictEqual(requestedBody.oaSecretKey, 'my_oa_secret');
      assert.strictEqual(requestedHeaders['X-Workspace-Id'], workspaceId);
    });

    it('connect() should omit oaSecretKey on reauthorize (server preserves the stored one)', async () => {
      let requestedBody: any = {};

      globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
        requestedBody = JSON.parse(String(init?.body || '{}'));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { inboxId: 'inbox_1', channelId: 'chan_1', oaId: 'oa_123', oaName: 'Shop OA' },
          }),
        } as unknown as Response;
      }) as typeof globalThis.fetch;

      await zaloApi.connect(workspaceId, { sessionId: 'sess_reauth' });
      assert.strictEqual(requestedBody.oaSecretKey, undefined);
    });
  });

  describe('Zalo Channel Schema (OA Secret Key step)', () => {
    it('should accept a valid OA Secret Key', () => {
      const result = zaloChannelSchema.safeParse({ oaSecretKey: 'abcd1234abcd1234abcd' });
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.oaSecretKey, 'abcd1234abcd1234abcd');
      }
    });

    it('should trim surrounding whitespace from the key', () => {
      const result = zaloChannelSchema.safeParse({ oaSecretKey: '   my_oa_secret_key_value   ' });
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.oaSecretKey, 'my_oa_secret_key_value');
      }
    });

    it('should reject empty or whitespace-only keys', () => {
      assert.strictEqual(zaloChannelSchema.safeParse({ oaSecretKey: '' }).success, false);
      assert.strictEqual(zaloChannelSchema.safeParse({ oaSecretKey: '    ' }).success, false);
      assert.strictEqual(zaloChannelSchema.safeParse({}).success, false);
    });

    it('should reject suspiciously short keys', () => {
      const result = zaloChannelSchema.safeParse({ oaSecretKey: 'abc' });
      assert.strictEqual(result.success, false);
    });
  });
});
