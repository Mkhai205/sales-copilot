import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert';
import { ConfigService } from '@nestjs/config';
import { ChannelType } from '@sales-copilot/shared-contracts';
import { FacebookService } from '../facebook.service';
import { FacebookAdapter } from '../facebook.adapter';
import { ChannelCredentialService } from '../../../modules/inboxes/channel-credential.service';
import { PrismaService } from '../../../infrastructure/database';
import { RedisService } from '../../../infrastructure/redis';

describe('FacebookService (OAuth Provisioning & Page Connection)', () => {
  let service: FacebookService;
  let adapter: FacebookAdapter;
  let credentialService: ChannelCredentialService;
  let configService: ConfigService;
  let redisMock: any;
  let redisStore: Map<string, string>;
  let channelsDb: Map<string, any>;
  let inboxesDb: Map<string, any>;
  let emittedEvents: Array<{ event: string; payload: any }>;
  let originalFetch: typeof globalThis.fetch;

  const wsId = 'ws_fb_oauth_test';
  const chanId = 'chan_fb_oauth_1';
  const inboxId = 'inbox_fb_oauth_1';
  const mockAppId = '123456789012345';
  const mockAppSecret = 'abcdef0123456789abcdef0123456789';
  const mockVerifyToken = 'my_secret_verify_token';

  beforeEach(() => {
    channelsDb = new Map();
    inboxesDb = new Map();
    redisStore = new Map();
    emittedEvents = [];
    originalFetch = globalThis.fetch;

    const mockConfig = {
      get: (key: string) => {
        if (key === 'CHANNEL_ENCRYPTION_KEY' || key === 'ENCRYPTION_KEY') {
          return '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
        }
        if (key === 'FB_APP_ID') return mockAppId;
        if (key === 'FB_APP_SECRET') return mockAppSecret;
        if (key === 'FB_VERIFY_TOKEN') return mockVerifyToken;
        if (key === 'WEBHOOK_BASE_URL') return 'https://api-sales-copilot.example.com';
        return undefined;
      },
    };
    configService = mockConfig as unknown as ConfigService;
    credentialService = new ChannelCredentialService(configService);

    redisMock = {
      get: async (key: string) => redisStore.get(key) || null,
      set: async (key: string, val: string) => {
        redisStore.set(key, val);
      },
      del: async (key: string) => {
        redisStore.delete(key);
      },
    } as unknown as RedisService;

    const clientMock = {
      channel: {
        findFirst: async ({ where }: { where: any }) => {
          for (const c of channelsDb.values()) {
            if (where.id && c.id !== where.id) continue;
            if (where.workspaceId && c.workspaceId !== where.workspaceId) continue;
            if (where.channelType && c.channelType !== where.channelType) continue;
            if (where.providerAccountId && c.providerAccountId !== where.providerAccountId)
              continue;
            const inbox = inboxesDb.get(c.inboxId);
            return { ...c, inbox: inbox || null };
          }
          return null;
        },
        findMany: async ({ where }: { where: any }) => {
          const results: any[] = [];
          for (const c of channelsDb.values()) {
            if (where.workspaceId && c.workspaceId !== where.workspaceId) continue;
            if (where.channelType && c.channelType !== where.channelType) continue;
            if (
              where.providerAccountId?.in &&
              !where.providerAccountId.in.includes(c.providerAccountId)
            )
              continue;
            results.push(c);
          }
          return results;
        },
        create: async ({ data }: { data: any }) => {
          const id = data.id || `chan_${Date.now()}`;
          const created = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
          channelsDb.set(id, created);
          return created;
        },
        update: async ({ where, data }: { where: { id: string }; data: any }) => {
          const c = channelsDb.get(where.id);
          if (!c) throw new Error('Channel not found');
          const updated = { ...c, ...data, updatedAt: new Date() };
          channelsDb.set(where.id, updated);
          return updated;
        },
        delete: async ({ where }: { where: { id: string } }) => {
          const c = channelsDb.get(where.id);
          channelsDb.delete(where.id);
          return c;
        },
      },
      inbox: {
        create: async ({ data }: { data: any }) => {
          const id = data.id || `inbox_${Date.now()}`;
          const created = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
          inboxesDb.set(id, created);
          return created;
        },
        update: async ({ where, data }: { where: { id: string }; data: any }) => {
          const inbox = inboxesDb.get(where.id);
          if (!inbox) throw new Error('Inbox not found');
          const updated = { ...inbox, ...data, updatedAt: new Date() };
          inboxesDb.set(where.id, updated);
          return updated;
        },
        delete: async ({ where }: { where: { id: string } }) => {
          const inbox = inboxesDb.get(where.id);
          inboxesDb.delete(where.id);
          return inbox;
        },
      },
    };

    const prismaMock = {
      getClient: () => clientMock,
      runInTransaction: async (cb: any) => cb({ tx: clientMock }),
    } as unknown as PrismaService;

    const eventEmitterMock = {
      emit: (event: string, payload: any) => {
        emittedEvents.push({ event, payload });
      },
    } as any;

    adapter = new FacebookAdapter();
    service = new FacebookService(
      configService,
      prismaMock,
      redisMock,
      credentialService,
      adapter,
      eventEmitterMock,
    );
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('getAuthUrl()', () => {
    it('should generate a valid Facebook OAuth URL containing client_id, redirect_uri, and CSRF state', async () => {
      const result = await service.getAuthUrl(wsId);
      assert.ok(result.authUrl);

      const parsedUrl = new URL(result.authUrl);
      assert.strictEqual(parsedUrl.hostname, 'graph.facebook.com');
      assert.strictEqual(parsedUrl.searchParams.get('client_id'), mockAppId);
      assert.strictEqual(
        parsedUrl.searchParams.get('redirect_uri'),
        'https://api-sales-copilot.example.com/api/v1/integrations/facebook/callback',
      );
      assert.ok(parsedUrl.searchParams.get('state')?.startsWith(`${wsId}:`));
      assert.strictEqual(
        parsedUrl.searchParams.get('scope'),
        'pages_show_list,pages_messaging,pages_manage_metadata',
      );
    });
  });

  describe('handleCallback()', () => {
    it('should exchange code for user access token and return sessionId', async () => {
      const state = `${wsId}:test_nonce_1234`;
      redisStore.set(`fb_oauth_state:${state}`, wsId);

      globalThis.fetch = (async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('grant_type=fb_exchange_token')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ access_token: 'EAAB_LONG_LIVED_USER_TOKEN' }),
          } as unknown as Response;
        }
        if (urlStr.includes('/oauth/access_token')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ access_token: 'EAAB_SHORT_LIVED_USER_TOKEN' }),
          } as unknown as Response;
        }
        return { ok: false } as Response;
      }) as typeof globalThis.fetch;

      const result = await service.handleCallback('valid_auth_code_123', state);

      assert.strictEqual(result.workspaceId, wsId);
      assert.ok(result.sessionId);

      // Verify token is stored in Redis
      const sessionData = redisStore.get(`fb_user_token:${result.sessionId}`);
      assert.ok(sessionData);
      const parsed = JSON.parse(sessionData);
      assert.strictEqual(parsed.userAccessToken, 'EAAB_LONG_LIVED_USER_TOKEN');
      assert.strictEqual(parsed.workspaceId, wsId);
    });

    it('should throw BadRequestException if state is invalid or expired', async () => {
      await assert.rejects(
        () => service.handleCallback('code_123', 'invalid_state'),
        /OAuth state token is invalid or expired/,
      );
    });
  });

  describe('discoverPages()', () => {
    it('should fetch user pages and mark already connected pages in workspace', async () => {
      const sessionId = 'session_test_123';
      redisStore.set(
        `fb_user_token:${sessionId}`,
        JSON.stringify({
          userAccessToken: 'EAAB_USER_TOKEN',
          workspaceId: wsId,
        }),
      );

      // Pre-connect page_2 in channelsDb
      channelsDb.set(chanId, {
        id: chanId,
        workspaceId: wsId,
        channelType: 'FACEBOOK_MESSENGER',
        providerAccountId: 'page_2',
      });

      globalThis.fetch = (async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('/me/accounts')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [
                {
                  id: 'page_1',
                  name: 'Sales Copilot Page 1',
                  picture: { data: { url: 'https://example.com/p1.png' } },
                  category: 'Software Company',
                  access_token: 'EAAB_PAGE_1_TOKEN',
                },
                {
                  id: 'page_2',
                  name: 'Sales Copilot Page 2',
                  picture: { data: { url: 'https://example.com/p2.png' } },
                  category: 'Retail',
                  access_token: 'EAAB_PAGE_2_TOKEN',
                },
              ],
            }),
          } as unknown as Response;
        }
        return { ok: false } as Response;
      }) as typeof globalThis.fetch;

      const pages = await service.discoverPages(wsId, sessionId);

      assert.strictEqual(pages.length, 2);
      assert.strictEqual(pages[0].pageId, 'page_1');
      assert.strictEqual(pages[0].isAlreadyConnected, false);
      assert.strictEqual(pages[1].pageId, 'page_2');
      assert.strictEqual(pages[1].isAlreadyConnected, true);
    });
  });

  describe('connectPage()', () => {
    it('should create inbox, create channel with encrypted credentials, and emit channel.created event', async () => {
      const sessionId = 'session_connect_test';
      redisStore.set(
        `fb_user_token:${sessionId}`,
        JSON.stringify({ userAccessToken: 'EAAB_USER_TOKEN', workspaceId: wsId }),
      );

      const result = await service.connectPage(
        wsId,
        {
          pageId: 'page_new_123',
          pageName: 'New Shop Fanpage',
          pageAccessToken: 'EAAB_PAGE_ACCESS_TOKEN',
          userAccessToken: 'EAAB_USER_ACCESS_TOKEN',
        },
        sessionId,
      );

      assert.ok(result.inboxId);
      assert.ok(result.channelId);

      // Verify channel in DB
      const channel = channelsDb.get(result.channelId);
      assert.ok(channel);
      assert.strictEqual(channel.workspaceId, wsId);
      assert.strictEqual(channel.providerAccountId, 'page_new_123');
      assert.strictEqual(channel.channelType, 'FACEBOOK_MESSENGER');

      // Verify credentials decrypted
      const decrypted = credentialService.decrypt(channel.credentials.encrypted);
      assert.strictEqual(decrypted.pageAccessToken, 'EAAB_PAGE_ACCESS_TOKEN');

      // Verify channel.created event was emitted
      const emitted = emittedEvents.find(e => e.event === 'channel.created');
      assert.ok(emitted);
      assert.strictEqual(emitted.payload.channelId, result.channelId);
      assert.strictEqual(emitted.payload.channelType, ChannelType.FACEBOOK_MESSENGER);
    });

    it('should throw ConflictException if page is already connected in workspace', async () => {
      channelsDb.set('existing_chan', {
        id: 'existing_chan',
        workspaceId: wsId,
        channelType: 'FACEBOOK_MESSENGER',
        providerAccountId: 'page_already_connected',
      });

      await assert.rejects(
        () =>
          service.connectPage(wsId, {
            pageId: 'page_already_connected',
            pageName: 'Shop Page',
            pageAccessToken: 'token',
            userAccessToken: 'user_token',
          }),
        /already connected in this workspace/,
      );
    });
  });

  describe('disconnectPage()', () => {
    it('should delete channel and inbox and emit channel.deleted event', async () => {
      channelsDb.set(chanId, {
        id: chanId,
        workspaceId: wsId,
        inboxId,
        channelType: 'FACEBOOK_MESSENGER',
      });
      inboxesDb.set(inboxId, { id: inboxId, workspaceId: wsId });

      const result = await service.disconnectPage(wsId, chanId);
      assert.strictEqual(result.success, true);
      assert.strictEqual(channelsDb.has(chanId), false);
      assert.strictEqual(inboxesDb.has(inboxId), false);

      const emitted = emittedEvents.find(e => e.event === 'channel.deleted');
      assert.ok(emitted);
      assert.strictEqual(emitted.payload.channelId, chanId);
    });
  });
});
