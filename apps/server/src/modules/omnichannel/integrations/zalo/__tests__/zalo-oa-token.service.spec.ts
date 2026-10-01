import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChannelType } from '@sales-copilot/shared-contracts';
import { expectReject } from '../../../../../../test/test-assertions';
import { ZaloOaTokenService } from '../zalo-oa-token.service';
import { ChannelCredentialService } from '../../../../../infrastructure/crypto/channel-credential.service';
import { PrismaService } from '../../../../../infrastructure/database/prisma.service';
import type { ChannelContext } from '../../channel-adapter.types';

const ZALO_APP_ID = 'zalo_app_id_1';
const ZALO_APP_SECRET = 'zalo_app_secret_1';

function makeChannel(overrides: Record<string, unknown> = {}): ChannelContext {
  return {
    channelId: 'chan_zalo_1',
    inboxId: 'inbox_1',
    workspaceId: 'ws_1',
    channelType: ChannelType.ZALO,
    credentials: {
      appId: ZALO_APP_ID,
      accessToken: 'old_access_token',
      refreshToken: 'old_refresh_token',
      accessTokenExpiresAt: new Date(Date.now() + 20 * 24 * 3600 * 1000).toISOString(),
      oaSecretKey: 'oa_secret',
      oaId: 'oa_123',
      ...overrides,
    },
    settings: {},
    providerAccountId: 'oa_123',
  };
}

describe('ZaloOaTokenService (OAuth token lifecycle & rotation)', () => {
  let service: ZaloOaTokenService;
  let credentialService: ChannelCredentialService;
  let channelsDb: Map<string, any>;
  let updateCalls: Array<{ where: any; data: any }>;
  let originalFetch: typeof globalThis.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    channelsDb = new Map();
    updateCalls = [];

    const configService = {
      get: (key: string) => {
        if (key === 'ZALO_APP_ID') return ZALO_APP_ID;
        if (key === 'ZALO_APP_SECRET') return ZALO_APP_SECRET;
        if (key === 'CHANNEL_ENCRYPTION_KEY') {
          return '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
        }
        return undefined;
      },
    } as unknown as ConfigService;

    credentialService = new ChannelCredentialService(configService);

    const clientMock = {
      channel: {
        findFirst: async ({ where }: { where: { id: string; workspaceId?: string } }) => {
          const c = channelsDb.get(where.id);
          if (!c) return null;
          if (where.workspaceId && c.workspaceId !== where.workspaceId) return null;
          return { ...c };
        },
        update: async ({ where, data }: { where: any; data: any }) => {
          updateCalls.push({ where, data });
          const id = where.workspaceId_id ? where.workspaceId_id.id : where.id;
          const c = channelsDb.get(id);
          if (!c) throw new Error('Channel not found');
          const updated = { ...c, ...data };
          channelsDb.set(id, updated);
          return updated;
        },
      },
    };

    const prismaMock = {
      getClient: () => clientMock,
    } as unknown as PrismaService;

    service = new ZaloOaTokenService(configService, prismaMock, credentialService);

    originalFetch = globalThis.fetch;
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function seedChannel(channel: ChannelContext, extra: Record<string, unknown> = {}) {
    channelsDb.set(channel.channelId, {
      id: channel.channelId,
      workspaceId: channel.workspaceId,
      channelType: ChannelType.ZALO,
      credentials: { encrypted: credentialService.encrypt(channel.credentials) },
      settings: {},
      ...extra,
    });
  }

  function stubTokenResponse(body: unknown, status = 200) {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));
  }

  describe('platform app config', () => {
    it('should expose isPlatformConfigured', () => {
      expect(service.isPlatformConfigured()).toBe(true);
    });

    it('should throw a descriptive error when ZALO_APP_ID is missing', () => {
      const badConfig = { get: () => undefined } as unknown as ConfigService;
      const badService = new ZaloOaTokenService(
        badConfig,
        { getClient: () => ({}) } as unknown as PrismaService,
        credentialService,
      );
      expect(() => badService.getAppId()).toThrow(/ZALO_APP_ID/);
    });
  });

  describe('exchangeCode()', () => {
    it('should exchange an authorization code with the secret_key header', async () => {
      stubTokenResponse({
        access_token: 'at_code',
        refresh_token: 'rt_code',
        expires_in: 90000,
      });

      const tokens = await service.exchangeCode('auth_code_123');

      expect(tokens.access_token).toBe('at_code');
      const [, init] = fetchMock.mock.calls[0];
      expect(init.method).toBe('POST');
      // App secret travels in the `secret_key` HEADER (Zalo OAuth v4 docs)
      expect(init.headers.secret_key).toBe(ZALO_APP_SECRET);
      expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
      // Body only carries app_id + grant_type + code
      expect(init.body).toContain(`app_id=${encodeURIComponent(ZALO_APP_ID)}`);
      expect(init.body).toContain('grant_type=authorization_code');
      expect(init.body).toContain('code=auth_code_123');
      expect(init.body).not.toContain('secret_key');
      expect(init.body).not.toContain('app_secret');
    });

    it('should throw ZALO_TOKEN_EXCHANGE_FAILED when Zalo rejects the code', async () => {
      stubTokenResponse({ error: -1, message: 'invalid code' }, 400);

      await expectReject(
        service.exchangeCode('bad_code'),
        err =>
          err instanceof InternalServerErrorException &&
          err.response?.code === 'ZALO_TOKEN_EXCHANGE_FAILED',
      );
    });
  });

  describe('getValidAccessToken()', () => {
    it('should return the cached token without any HTTP call when well within the margin', async () => {
      const channel = makeChannel();
      seedChannel(channel);

      const token = await service.getValidAccessToken(channel);

      expect(token).toBe('old_access_token');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should refresh + persist the rotated pair when the token is within the margin', async () => {
      const channel = makeChannel({
        accessTokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30min < 1h margin
      });
      seedChannel(channel);
      stubTokenResponse({
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        expires_in: 2592000,
      });

      const token = await service.getValidAccessToken(channel);

      expect(token).toBe('new_access_token');
      expect(updateCalls).toHaveLength(1);

      const encrypted = updateCalls[0].data.credentials.encrypted;
      const persisted = credentialService.decryptChannelCredentials({ encrypted });
      expect(persisted.accessToken).toBe('new_access_token');
      expect(persisted.refreshToken).toBe('new_refresh_token');
      expect(persisted.oaSecretKey).toBe('oa_secret'); // merged, not clobbered
      expect(persisted.accessTokenExpiresAt).toBeDefined();
      // New expiry should be ~30 days out
      const expiryMs = Date.parse(persisted.accessTokenExpiresAt as string);
      expect(expiryMs).toBeGreaterThan(Date.now() + 29 * 24 * 3600 * 1000);
    });

    it('should refresh immediately when expiry metadata is missing', async () => {
      const channel = makeChannel({ accessTokenExpiresAt: undefined });
      seedChannel(channel);
      stubTokenResponse({
        access_token: 'at2',
        refresh_token: 'rt2',
        expires_in: 2592000,
      });

      const token = await service.getValidAccessToken(channel);
      expect(token).toBe('at2');
    });

    it('should mark reauthorizationRequired and throw when the refresh token is dead', async () => {
      const channel = makeChannel({ accessTokenExpiresAt: new Date().toISOString() });
      seedChannel(channel);
      stubTokenResponse({ error: -216, message: 'refresh token expired' }, 400);

      await expectReject(
        service.getValidAccessToken(channel),
        err =>
          err instanceof InternalServerErrorException &&
          err.response?.code === 'ZALO_TOKEN_REFRESH_FAILED',
      );

      const stored = channelsDb.get(channel.channelId);
      expect(stored.isConnected).toBe(false);
      expect(stored.settings.reauthorizationRequired).toBe(true);
      expect(stored.settings.lastSyncError).toContain('REFRESH_TOKEN_EXPIRED');
    });

    it('should retry once with the DB-stored token when another worker already rotated', async () => {
      const channel = makeChannel({ accessTokenExpiresAt: new Date().toISOString() });
      seedChannel(channel);

      // First call: Zalo rejects the (already-consumed) refresh token.
      // Simulates the other worker having rotated the DB row before this retry re-reads it.
      fetchMock.mockImplementationOnce(async () => {
        const stored = credentialService.decryptChannelCredentials(
          channelsDb.get(channel.channelId).credentials,
        );
        stored.refreshToken = 'rotated_refresh_token';
        channelsDb.set(channel.channelId, {
          ...channelsDb.get(channel.channelId),
          credentials: { encrypted: credentialService.encrypt(stored) },
        });
        return new Response(JSON.stringify({ error: -216, message: 'token used' }), {
          status: 400,
        });
      });
      // Second attempt (with the rotated token) succeeds.
      stubTokenResponse({
        access_token: 'at_rotated',
        refresh_token: 'rt_rotated2',
        expires_in: 2592000,
      });

      const token = await service.getValidAccessToken(channel);
      expect(token).toBe('at_rotated');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should propagate retryable (network/5xx) failures without marking the channel dead', async () => {
      const channel = makeChannel({ accessTokenExpiresAt: new Date().toISOString() });
      seedChannel(channel);
      fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));

      await expectReject(service.getValidAccessToken(channel), /ZALO_TOKEN_REFRESH_RETRYABLE/);

      const stored = channelsDb.get(channel.channelId);
      expect(stored.settings.reauthorizationRequired).toBeUndefined();
    });

    it('should deduplicate concurrent refreshes (single-flight)', async () => {
      const channel = makeChannel({ accessTokenExpiresAt: new Date().toISOString() });
      seedChannel(channel);
      stubTokenResponse({
        access_token: 'at_sf',
        refresh_token: 'rt_sf',
        expires_in: 2592000,
      });

      const [t1, t2] = await Promise.all([
        service.getValidAccessToken(channel),
        service.getValidAccessToken(channel),
      ]);

      expect(t1).toBe('at_sf');
      expect(t2).toBe('at_sf');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('forceRefresh()', () => {
    it('should bypass the cached token and rotate immediately', async () => {
      const channel = makeChannel(); // cached token still valid
      seedChannel(channel);
      stubTokenResponse({
        access_token: 'at_forced',
        refresh_token: 'rt_forced',
        expires_in: 2592000,
      });

      const token = await service.forceRefresh(channel);

      expect(token).toBe('at_forced');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
