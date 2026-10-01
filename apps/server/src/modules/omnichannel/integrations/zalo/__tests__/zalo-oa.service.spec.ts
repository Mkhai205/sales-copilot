import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChannelType } from '@sales-copilot/shared-contracts';
import { expectReject } from '../../../../../../test/test-assertions';
import { ZaloOaService } from '../zalo-oa.service';
import { ZaloOaAdapter } from '../zalo.adapter';
import { ZaloOaTokenService } from '../zalo-oa-token.service';
import { ChannelCredentialService } from '../../../../../infrastructure/crypto/channel-credential.service';
import { PrismaService } from '../../../../../infrastructure/database/prisma.service';

const ZALO_APP_ID = 'zalo_app_id_1';
const ZALO_APP_SECRET = 'zalo_app_secret_1';
const WORKSPACE_ID = 'ws_1';

function makeRedisMock() {
  const store = new Map<string, string>();
  return {
    store,
    set: async (key: string, value: string, _ttl?: number) => {
      store.set(key, value);
      return 'OK';
    },
    get: async (key: string) => store.get(key) ?? null,
    del: async (...keys: string[]) => {
      for (const key of keys) store.delete(key);
      return keys.length;
    },
  };
}

describe('ZaloOaService (OAuth provisioning & connect)', () => {
  let service: ZaloOaService;
  let redis: ReturnType<typeof makeRedisMock>;
  let credentialService: ChannelCredentialService;
  let channelsDb: Map<string, any>;
  let inboxesDb: Map<string, any>;
  let emittedEvents: Array<{ name: string; payload: any }>;
  let originalFetch: typeof globalThis.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    redis = makeRedisMock();
    channelsDb = new Map();
    inboxesDb = new Map();
    emittedEvents = [];

    const configService = {
      get: (key: string) => {
        if (key === 'ZALO_APP_ID') return ZALO_APP_ID;
        if (key === 'ZALO_APP_SECRET') return ZALO_APP_SECRET;
        if (key === 'CHANNEL_ENCRYPTION_KEY') {
          return '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
        }
        if (key === 'WEBHOOK_BASE_URL') return 'https://api.example.com';
        return undefined;
      },
    } as unknown as ConfigService;

    credentialService = new ChannelCredentialService(configService);

    const clientMock = {
      channel: {
        findFirst: async ({ where }: { where: any }) => {
          if (where.providerAccountId && where.id === undefined) {
            // Lookup by provider account across all workspaces (collision check)
            for (const ch of channelsDb.values()) {
              if (ch.providerAccountId === where.providerAccountId) return { ...ch };
            }
            return null;
          }
          const c = channelsDb.get(where.id);
          if (!c) return null;
          if (where.workspaceId && c.workspaceId !== where.workspaceId) return null;
          return { ...c };
        },
        create: async ({ data }: { data: any }) => {
          const channel = { id: `chan_${channelsDb.size + 1}`, isConnected: false, ...data };
          channelsDb.set(channel.id, channel);
          return channel;
        },
        update: async ({ where, data }: { where: any; data: any }) => {
          const id = where.workspaceId_id ? where.workspaceId_id.id : where.id;
          const c = channelsDb.get(id);
          if (!c) throw new Error('Channel not found');
          const updated = { ...c, ...data };
          channelsDb.set(id, updated);
          return updated;
        },
      },
      workspaceMember: {
        findMany: async () => [{ userId: 'member_1' }, { userId: 'member_2' }],
      },
      inbox: {
        create: async ({ data }: { data: any }) => {
          const inbox = { id: `inbox_${inboxesDb.size + 1}`, ...data };
          inboxesDb.set(inbox.id, inbox);
          return inbox;
        },
      },
      inboxMember: {
        createMany: async ({ data }: { data: any[] }) => ({ count: data.length }),
      },
    };

    const prismaMock = {
      getClient: () => clientMock,
      runInTransaction: async (fn: (txCtx: { tx: unknown }) => Promise<any>) =>
        fn({ tx: clientMock }),
    } as unknown as PrismaService;

    const eventEmitterMock = {
      emitAsync: async (name: string, payload: any) => {
        emittedEvents.push({ name, payload });
        return true;
      },
      emit: (name: string, payload: any) => {
        emittedEvents.push({ name, payload });
      },
    };

    const tokenService = new ZaloOaTokenService(configService, prismaMock, credentialService);
    const adapter = new ZaloOaAdapter({
      getValidAccessToken: async () => 'unused',
      forceRefresh: async () => 'unused',
    } as any);

    service = new ZaloOaService(
      configService,
      prismaMock,
      redis as any,
      credentialService,
      tokenService,
      adapter,
      eventEmitterMock as any,
    );

    originalFetch = globalThis.fetch;
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('getAuthUrl()', () => {
    it('should build the OAuth authorize URL and persist CSRF state in Redis', async () => {
      const { authUrl } = await service.getAuthUrl(WORKSPACE_ID, {
        clientOrigin: 'https://app.example.com',
      });

      const url = new URL(authUrl);
      expect(url.origin + url.pathname).toBe('https://oauth.zaloapp.com/v4/oa/permission');
      expect(url.searchParams.get('app_id')).toBe(ZALO_APP_ID);
      expect(url.searchParams.get('redirect_uri')).toBe(
        'https://api.example.com/api/v1/integrations/zalo/callback',
      );

      // State stored with the workspace id
      const state = url.searchParams.get('state');
      expect(state).toContain(`${WORKSPACE_ID}:`);
      const stored = redis.store.get(`zalo_oauth_state:${state}`);
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored as string).workspaceId).toBe(WORKSPACE_ID);
    });
  });

  describe('handleCallback()', () => {
    async function seedState(statePayload: Record<string, unknown>): Promise<string> {
      const state = `${WORKSPACE_ID}:abc123`;
      redis.store.set(`zalo_oauth_state:${state}`, JSON.stringify(statePayload));
      return state;
    }

    function stubSuccessFetches() {
      fetchMock
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              access_token: 'at_cb',
              refresh_token: 'rt_cb',
              expires_in: 2592000,
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              oa_id: 'oa_123',
              name: 'Shop OA',
              avatar: 'https://zalo/oa.png',
            }),
            { status: 200 },
          ),
        );
    }

    it('should exchange the code, resolve the OA, and park a session in Redis', async () => {
      const state = await seedState({ workspaceId: WORKSPACE_ID });
      stubSuccessFetches();

      const result = await service.handleCallback('auth_code', state);

      expect(result.workspaceId).toBe(WORKSPACE_ID);
      expect(result.oaId).toBe('oa_123');
      expect(result.oaName).toBe('Shop OA');
      expect(result.isReauthorization).toBe(false);
      expect(result.sessionId).toBeTruthy();

      const session = JSON.parse(
        redis.store.get(`zalo_oauth_session:${result.sessionId}`) as string,
      );
      expect(session).toMatchObject({
        workspaceId: WORKSPACE_ID,
        accessToken: 'at_cb',
        refreshToken: 'rt_cb',
        oaId: 'oa_123',
        oaName: 'Shop OA',
      });

      // State consumed (single use)
      expect(redis.store.has(`zalo_oauth_state:${state}`)).toBe(false);
    });

    it('should reject an invalid or expired state', async () => {
      await expectReject(
        service.handleCallback('code', 'bogus_state'),
        err => err instanceof BadRequestException && err.response?.code === 'INVALID_OAUTH_STATE',
      );
    });

    it('should flag reauthorization when the state carries a channelId', async () => {
      const state = await seedState({ workspaceId: WORKSPACE_ID, channelId: 'chan_existing' });
      stubSuccessFetches();

      const result = await service.handleCallback('auth_code', state);
      expect(result.isReauthorization).toBe(true);
    });

    it('should fail when the OA info cannot be resolved', async () => {
      const state = await seedState({ workspaceId: WORKSPACE_ID });
      fetchMock
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ access_token: 'at_cb', refresh_token: 'rt_cb', expires_in: 100 }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(new Response(JSON.stringify({ error: -1 }), { status: 200 }));

      await expectReject(
        service.handleCallback('auth_code', state),
        err => err instanceof BadRequestException,
      );
    });
  });

  describe('connect() — new channel', () => {
    function seedSession(session: Record<string, unknown>): string {
      const sessionId = 'sess_1';
      redis.store.set(
        `zalo_oauth_session:${sessionId}`,
        JSON.stringify({
          workspaceId: WORKSPACE_ID,
          accessToken: 'at_s',
          refreshToken: 'rt_s',
          accessTokenExpiresAt: new Date(Date.now() + 2592000 * 1000).toISOString(),
          oaId: 'oa_123',
          oaName: 'Shop OA',
          ...session,
        }),
      );
      return sessionId;
    }

    it('should create Inbox + Channel in a transaction, emit channel.created, and encrypt credentials', async () => {
      const sessionId = seedSession({});
      const result = await service.connect(WORKSPACE_ID, {
        sessionId,
        oaSecretKey: 'my_oa_secret',
        memberUserIds: ['member_1'],
      });

      expect(result).toMatchObject({ oaId: 'oa_123', oaName: 'Shop OA' });
      expect(inboxesDb.size).toBe(1);
      const inbox = inboxesDb.values().next().value;
      expect(inbox).toMatchObject({ workspaceId: WORKSPACE_ID, name: 'Shop OA' });

      const channel = channelsDb.get(result.channelId);
      expect(channel.channelType).toBe(ChannelType.ZALO);
      expect(channel.providerAccountId).toBe('oa_123');
      expect(channel.isConnected).toBe(false);

      const decrypted = credentialService.decryptChannelCredentials(channel.credentials);
      expect(decrypted).toMatchObject({
        appId: ZALO_APP_ID,
        accessToken: 'at_s',
        refreshToken: 'rt_s',
        oaSecretKey: 'my_oa_secret',
        oaId: 'oa_123',
      });

      expect(emittedEvents).toHaveLength(1);
      expect(emittedEvents[0]).toMatchObject({
        name: 'channel.created',
        payload: { workspaceId: WORKSPACE_ID, channelType: ChannelType.ZALO },
      });
    });

    it('should require the OA Secret Key for a new connection', async () => {
      const sessionId = seedSession({});
      await expectReject(
        service.connect(WORKSPACE_ID, { sessionId }),
        err => err instanceof BadRequestException,
      );
    });

    it('should reject an OA that is already connected in the system', async () => {
      channelsDb.set('chan_other', {
        id: 'chan_other',
        workspaceId: 'ws_other',
        channelType: ChannelType.ZALO,
        providerAccountId: 'oa_123',
      });
      const sessionId = seedSession({});

      await expectReject(
        service.connect(WORKSPACE_ID, { sessionId, oaSecretKey: 'x'.repeat(16) }),
        err => err.response?.code === 'ZALO_OA_ALREADY_CONNECTED',
      );
    });

    it('should reject a session belonging to another workspace', async () => {
      const sessionId = seedSession({ workspaceId: 'ws_other' });
      await expectReject(
        service.connect(WORKSPACE_ID, { sessionId, oaSecretKey: 'x' }),
        err => err.response?.code === 'WORKSPACE_MISMATCH',
      );
    });

    it('should reject an expired session', async () => {
      await expectReject(
        service.connect(WORKSPACE_ID, { sessionId: 'gone', oaSecretKey: 'x' }),
        err => err.response?.code === 'SESSION_EXPIRED',
      );
    });
  });

  describe('connect() — reauthorize', () => {
    it('should refresh credentials, clear reauthorizationRequired, and emit channel.updated', async () => {
      channelsDb.set('chan_zalo_1', {
        id: 'chan_zalo_1',
        workspaceId: WORKSPACE_ID,
        inboxId: 'inbox_zalo_1',
        channelType: ChannelType.ZALO,
        providerAccountId: 'oa_123',
        credentials: {
          encrypted: credentialService.encrypt({
            appId: ZALO_APP_ID,
            accessToken: 'old_at',
            refreshToken: 'old_rt',
            oaSecretKey: 'existing_oa_secret',
            oaId: 'oa_123',
          }),
        },
        settings: { reauthorizationRequired: true, lastSyncError: 'REFRESH_TOKEN_EXPIRED: dead' },
        isConnected: false,
      });

      const sessionId = 'sess_reauth';
      redis.store.set(
        `zalo_oauth_session:${sessionId}`,
        JSON.stringify({
          workspaceId: WORKSPACE_ID,
          channelId: 'chan_zalo_1',
          accessToken: 'at_new',
          refreshToken: 'rt_new',
          accessTokenExpiresAt: new Date(Date.now() + 2592000 * 1000).toISOString(),
          oaId: 'oa_123',
          oaName: 'Shop OA',
        }),
      );

      const result = await service.connect(WORKSPACE_ID, { sessionId });

      expect(result.channelId).toBe('chan_zalo_1');
      const channel = channelsDb.get('chan_zalo_1');
      expect(channel.isConnected).toBe(true);
      expect(channel.settings.reauthorizationRequired).toBe(false);
      expect(channel.settings.lastSyncError).toBeNull();

      const decrypted = credentialService.decryptChannelCredentials(channel.credentials);
      expect(decrypted).toMatchObject({ accessToken: 'at_new', refreshToken: 'rt_new' });
      // Existing OA Secret Key preserved when not re-supplied
      expect(decrypted.oaSecretKey).toBe('existing_oa_secret');

      expect(emittedEvents).toHaveLength(1);
      expect(emittedEvents[0].name).toBe('channel.updated');
    });

    it('should use a newly supplied OA Secret Key when provided', async () => {
      channelsDb.set('chan_zalo_1', {
        id: 'chan_zalo_1',
        workspaceId: WORKSPACE_ID,
        inboxId: 'inbox_zalo_1',
        channelType: ChannelType.ZALO,
        providerAccountId: 'oa_123',
        credentials: {
          encrypted: credentialService.encrypt({ oaSecretKey: 'old_secret', oaId: 'oa_123' }),
        },
        settings: {},
        isConnected: false,
      });

      const sessionId = 'sess_reauth2';
      redis.store.set(
        `zalo_oauth_session:${sessionId}`,
        JSON.stringify({
          workspaceId: WORKSPACE_ID,
          channelId: 'chan_zalo_1',
          accessToken: 'at_new',
          refreshToken: 'rt_new',
          accessTokenExpiresAt: new Date().toISOString(),
          oaId: 'oa_123',
          oaName: 'Shop OA',
        }),
      );

      await service.connect(WORKSPACE_ID, { sessionId, oaSecretKey: 'rotated_secret' });

      const decrypted = credentialService.decryptChannelCredentials(
        channelsDb.get('chan_zalo_1').credentials,
      );
      expect(decrypted.oaSecretKey).toBe('rotated_secret');
    });

    it('should reject re-authorizing with a DIFFERENT OA (OA-id guard)', async () => {
      channelsDb.set('chan_zalo_1', {
        id: 'chan_zalo_1',
        workspaceId: WORKSPACE_ID,
        inboxId: 'inbox_zalo_1',
        channelType: ChannelType.ZALO,
        providerAccountId: 'oa_original',
        credentials: { encrypted: credentialService.encrypt({}) },
        settings: {},
        isConnected: false,
      });

      const sessionId = 'sess_mismatch';
      redis.store.set(
        `zalo_oauth_session:${sessionId}`,
        JSON.stringify({
          workspaceId: WORKSPACE_ID,
          channelId: 'chan_zalo_1',
          accessToken: 'at_x',
          refreshToken: 'rt_x',
          accessTokenExpiresAt: new Date().toISOString(),
          oaId: 'oa_some_other_oa',
          oaName: 'Other OA',
        }),
      );

      await expectReject(
        service.connect(WORKSPACE_ID, { sessionId }),
        err => err.response?.code === 'ZALO_OA_MISMATCH',
      );
    });

    it('should fail when the channel no longer exists', async () => {
      const sessionId = 'sess_missing';
      redis.store.set(
        `zalo_oauth_session:${sessionId}`,
        JSON.stringify({
          workspaceId: WORKSPACE_ID,
          channelId: 'chan_gone',
          accessToken: 'at_x',
          refreshToken: 'rt_x',
          accessTokenExpiresAt: new Date().toISOString(),
          oaId: 'oa_123',
          oaName: 'Shop OA',
        }),
      );

      await expectReject(
        service.connect(WORKSPACE_ID, { sessionId }),
        err => err instanceof NotFoundException,
      );
    });
  });

  describe('getSessionInfo()', () => {
    it('should return OA info for a valid session of the requesting workspace', async () => {
      redis.store.set(
        'zalo_oauth_session:sess_ok',
        JSON.stringify({
          workspaceId: WORKSPACE_ID,
          accessToken: 'at',
          refreshToken: 'rt',
          accessTokenExpiresAt: new Date().toISOString(),
          oaId: 'oa_123',
          oaName: 'Shop OA',
          oaAvatar: 'https://zalo/oa.png',
        }),
      );

      const info = await service.getSessionInfo(WORKSPACE_ID, 'sess_ok');
      expect(info).toEqual({ oaId: 'oa_123', oaName: 'Shop OA', oaAvatar: 'https://zalo/oa.png' });
    });

    it('should reject expired sessions', async () => {
      await expectReject(
        service.getSessionInfo(WORKSPACE_ID, 'missing'),
        err => err.response?.code === 'SESSION_EXPIRED',
      );
    });
  });

  describe('getWebhookUrl()', () => {
    it('should build the per-channel webhook URL', () => {
      expect(service.getWebhookUrl('chan_1')).toBe(
        'https://api.example.com/api/v1/channels/chan_1/webhook',
      );
    });
  });
});
