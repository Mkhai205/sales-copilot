import { ConfigService } from '@nestjs/config';
import { ChannelType } from '@sales-copilot/shared-contracts';
import { ZaloLifecycleService } from '../zalo.lifecycle';
import { ZaloOaAdapter } from '../zalo.adapter';
import { ChannelCredentialService } from '../../../../../infrastructure/crypto/channel-credential.service';
import { PrismaService } from '../../../../../infrastructure/database/prisma.service';

const WS_ID = 'ws_zalo_test';
const CHAN_ID = 'chan_zalo_1';
const INBOX_ID = 'inbox_zalo_1';

describe('ZaloLifecycleService (OA validation & metadata sync)', () => {
  let service: ZaloLifecycleService;
  let credentialService: ChannelCredentialService;
  let channelsDb: Map<string, any>;
  let inboxesDb: Map<string, any>;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    channelsDb = new Map();
    inboxesDb = new Map();

    const mockConfig = {
      get: (key: string) => {
        if (key === 'CHANNEL_ENCRYPTION_KEY') {
          return '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
        }
        if (key === 'WEBHOOK_BASE_URL') return 'https://example.com';
        return undefined;
      },
    } as unknown as ConfigService;
    credentialService = new ChannelCredentialService(mockConfig);

    const clientMock = {
      channel: {
        findFirst: async ({ where }: { where: any }) => {
          const c = channelsDb.get(where.id);
          if (!c) return null;
          if (where.workspaceId && c.workspaceId !== where.workspaceId) return null;
          const inbox = inboxesDb.get(c.inboxId);
          return { ...c, inbox: inbox || null };
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
      inbox: {
        update: async ({ where, data }: { where: any; data: any }) => {
          const id = where.workspaceId_id ? where.workspaceId_id.id : where.id;
          const inbox = inboxesDb.get(id);
          if (!inbox) throw new Error('Inbox not found');
          const updated = { ...inbox, ...data };
          inboxesDb.set(id, updated);
          return updated;
        },
      },
    };

    const prismaMock = {
      getClient: () => clientMock,
    } as unknown as PrismaService;

    const adapter = new ZaloOaAdapter({
      getValidAccessToken: async () => 'token',
      forceRefresh: async () => 'token',
    } as any);

    service = new ZaloLifecycleService(prismaMock, adapter, credentialService, mockConfig);
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function seedChannel(overrides: Record<string, unknown> = {}) {
    channelsDb.set(CHAN_ID, {
      id: CHAN_ID,
      workspaceId: WS_ID,
      inboxId: INBOX_ID,
      channelType: ChannelType.ZALO,
      providerAccountId: null,
      credentials: {
        encrypted: credentialService.encrypt({
          appId: 'zalo_app_id_1',
          accessToken: 'access_token_valid',
          refreshToken: 'refresh_token',
          accessTokenExpiresAt: new Date(Date.now() + 20 * 24 * 3600 * 1000).toISOString(),
          oaSecretKey: 'oa_secret',
          oaId: 'oa_123',
        }),
      },
      settings: {},
      isConnected: false,
      ...overrides,
    });
    inboxesDb.set(INBOX_ID, {
      id: INBOX_ID,
      workspaceId: WS_ID,
      name: 'Zalo Inbox',
      avatarUrl: null,
    });
  }

  function stubOaInfo(oa: Record<string, unknown>) {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(oa), { status: 200 }),
      ) as unknown as typeof fetch;
  }

  describe('handleChannelCreated()', () => {
    it('should ignore non-Zalo channels', async () => {
      seedChannel();
      globalThis.fetch = jest.fn() as unknown as typeof fetch;
      await service.handleChannelCreated({
        workspaceId: WS_ID,
        channelId: CHAN_ID,
        inboxId: INBOX_ID,
        channelType: ChannelType.TELEGRAM,
      });
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('should validate the OA, set isConnected, and sync OA metadata + webhook URL', async () => {
      seedChannel();
      stubOaInfo({ oa_id: 'oa_123', name: 'Shop OA', avatar: 'https://zalo/oa.png' });

      const ok = await service.validateAndSync(WS_ID, CHAN_ID);

      expect(ok).toBe(true);
      const channel = channelsDb.get(CHAN_ID);
      expect(channel.isConnected).toBe(true);
      expect(channel.providerAccountId).toBe('oa_123');
      expect(channel.settings).toMatchObject({
        oaId: 'oa_123',
        oaName: 'Shop OA',
        oaAvatar: 'https://zalo/oa.png',
        webhookUrl: `https://example.com/api/v1/channels/${CHAN_ID}/webhook`,
        lastSyncError: null,
      });
    });

    it('should mark a sync error when the token is invalid', async () => {
      seedChannel();
      globalThis.fetch = jest
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: -216, message: 'invalid token' }), { status: 200 }),
        ) as unknown as typeof fetch;

      const ok = await service.validateAndSync(WS_ID, CHAN_ID);

      expect(ok).toBe(false);
      const channel = channelsDb.get(CHAN_ID);
      expect(channel.isConnected).toBe(false);
      expect(channel.settings.lastSyncError).toContain('invalid token');
    });

    it('should mark a sync error when the channel has no credentials', async () => {
      seedChannel({
        credentials: { encrypted: credentialService.encrypt({ appId: 'x' }) },
      });

      const ok = await service.validateAndSync(WS_ID, CHAN_ID);

      expect(ok).toBe(false);
      expect(channelsDb.get(CHAN_ID).settings.lastSyncError).toBe('MISSING_CREDENTIALS');
    });
  });

  describe('OA-id guard (channel.updated)', () => {
    it('should reject swapping the channel to a different OA', async () => {
      seedChannel({ providerAccountId: 'oa_original' });
      stubOaInfo({ oa_id: 'oa_someone_else', name: 'Other OA' });

      const ok = await service.validateAndSync(WS_ID, CHAN_ID);

      expect(ok).toBe(false);
      const channel = channelsDb.get(CHAN_ID);
      expect(channel.isConnected).toBe(false);
      expect(channel.settings.lastSyncError).toContain('OA_ID_MISMATCH');
    });

    it('should skip validation when the channel is deliberately disconnected', async () => {
      seedChannel({ isConnected: false });
      stubOaInfo({ oa_id: 'oa_123', name: 'Shop OA' });

      await service.handleChannelUpdated({
        workspaceId: WS_ID,
        channelId: CHAN_ID,
        inboxId: INBOX_ID,
        channelType: ChannelType.ZALO,
      });

      // Validation skipped: fetch (getChannelInfo) never ran
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(channelsDb.get(CHAN_ID).isConnected).toBe(false);
    });
  });

  describe('handleChannelDeleted()', () => {
    it('should only log (webhook removal is manual in the OA Console)', async () => {
      seedChannel();
      stubOaInfo({ oa_id: 'oa_123', name: 'Shop OA' });

      await expect(
        service.handleChannelDeleted({
          workspaceId: WS_ID,
          channelId: CHAN_ID,
          inboxId: INBOX_ID,
          channelType: ChannelType.ZALO,
        }),
      ).resolves.toBeUndefined();
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });
});
