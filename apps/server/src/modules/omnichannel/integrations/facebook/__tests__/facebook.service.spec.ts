import { assertDefined, expectReject } from '../../../../../../test/test-assertions';
import { ConfigService } from '@nestjs/config';
import { ChannelType } from '@sales-copilot/shared-contracts';
import { FacebookService } from '../facebook.service';
import { FacebookAdapter } from '../facebook.adapter';
import { ChannelCredentialService } from '../../../../omnichannel/inboxes/channel-credential.service';
import { PrismaService } from '../../../../../infrastructure/database';
import { RedisService } from '../../../../../infrastructure/redis';

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
        update: async ({ where, data }: { where: any; data: any }) => {
          const id = where.workspaceId_id ? where.workspaceId_id.id : where.id;
          const c = channelsDb.get(id);
          if (!c) throw new Error('Channel not found');
          const updated = { ...c, ...data, updatedAt: new Date() };
          channelsDb.set(id, updated);
          return updated;
        },
        delete: async ({ where }: { where: any }) => {
          const id = where.workspaceId_id ? where.workspaceId_id.id : where.id;
          const c = channelsDb.get(id);
          channelsDb.delete(id);
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
        update: async ({ where, data }: { where: any; data: any }) => {
          const id = where.workspaceId_id ? where.workspaceId_id.id : where.id;
          const inbox = inboxesDb.get(id);
          if (!inbox) throw new Error('Inbox not found');
          const updated = { ...inbox, ...data, updatedAt: new Date() };
          inboxesDb.set(id, updated);
          return updated;
        },
        delete: async ({ where }: { where: any }) => {
          const id = where.workspaceId_id ? where.workspaceId_id.id : where.id;
          const inbox = inboxesDb.get(id);
          inboxesDb.delete(id);
          return inbox;
        },
      },
      inboxMember: {
        createMany: async ({ data }: { data: any[] }) => {
          return { count: data.length };
        },
      },
      workspaceMember: {
        findMany: async ({ where: _where }: { where: any }) => {
          return [{ userId: 'user_agent_1' }, { userId: 'user_agent_2' }];
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
      assertDefined(result.authUrl);

      const parsedUrl = new URL(result.authUrl);
      expect(parsedUrl.hostname).toBe('www.facebook.com');
      expect(parsedUrl.pathname).toBe('/v26.0/dialog/oauth');
      expect(parsedUrl.searchParams.get('client_id')).toBe(mockAppId);
      expect(parsedUrl.searchParams.get('redirect_uri')).toBe(
        'https://api-sales-copilot.example.com/api/v1/integrations/facebook/callback',
      );
      expect(parsedUrl.searchParams.get('state')?.startsWith(`${wsId}:`)).toBeTruthy();
      expect(parsedUrl.searchParams.get('scope')).toBe(
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

      expect(result.workspaceId).toBe(wsId);
      assertDefined(result.sessionId);

      // Verify token is stored in Redis
      const sessionData = redisStore.get(`fb_user_token:${result.sessionId}`);
      assertDefined(sessionData);
      const parsed = JSON.parse(sessionData);
      expect(parsed.userAccessToken).toBe('EAAB_LONG_LIVED_USER_TOKEN');
      expect(parsed.workspaceId).toBe(wsId);
    });

    it('should throw BadRequestException if state is invalid or expired', async () => {
      await expectReject(
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

      expect(pages.length).toBe(2);
      expect(pages[0].pageId).toBe('page_1');
      expect(pages[0].isAlreadyConnected).toBe(false);
      expect(pages[1].pageId).toBe('page_2');
      expect(pages[1].isAlreadyConnected).toBe(true);

      // Verify page tokens were cached in Redis session
      const updatedSession = redisStore.get(`fb_user_token:${sessionId}`);
      assertDefined(updatedSession);
      const parsed = JSON.parse(updatedSession);
      expect(parsed.pages['page_1'].accessToken).toBe('EAAB_PAGE_1_TOKEN');
      expect(parsed.pages['page_2'].accessToken).toBe('EAAB_PAGE_2_TOKEN');
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

      assertDefined(result.inboxId);
      assertDefined(result.channelId);

      // Verify channel in DB
      const channel = channelsDb.get(result.channelId);
      assertDefined(channel);
      expect(channel.workspaceId).toBe(wsId);
      expect(channel.providerAccountId).toBe('page_new_123');
      expect(channel.channelType).toBe('FACEBOOK_MESSENGER');

      // Verify credentials decrypted
      const decrypted = credentialService.decrypt(channel.credentials.encrypted);
      expect(decrypted.pageAccessToken).toBe('EAAB_PAGE_ACCESS_TOKEN');

      // Verify channel.created event was emitted
      const emitted = emittedEvents.find(e => e.event === 'channel.created');
      assertDefined(emitted);
      expect(emitted.payload.channelId).toBe(result.channelId);
      expect(emitted.payload.channelType).toBe(ChannelType.FACEBOOK_MESSENGER);
    });

    it('should auto-resolve pageAccessToken and userAccessToken from Redis session when omitted in DTO', async () => {
      const sessionId = 'session_auto_tokens';
      redisStore.set(
        `fb_user_token:${sessionId}`,
        JSON.stringify({
          userAccessToken: 'EAAB_SESSION_USER_TOKEN',
          workspaceId: wsId,
          pages: {
            page_from_session: {
              accessToken: 'EAAB_SESSION_PAGE_TOKEN',
              name: 'Session Fanpage',
            },
          },
        }),
      );

      const result = await service.connectPage(
        wsId,
        {
          pageId: 'page_from_session',
          pageName: 'Session Fanpage',
          memberUserIds: ['user_agent_1', 'user_agent_2'],
        },
        sessionId,
      );

      assertDefined(result.inboxId);
      assertDefined(result.channelId);

      const channel = channelsDb.get(result.channelId);
      assertDefined(channel);
      const decrypted = credentialService.decrypt(channel.credentials.encrypted);
      expect(decrypted.pageAccessToken).toBe('EAAB_SESSION_PAGE_TOKEN');
      expect(decrypted.userAccessToken).toBe('EAAB_SESSION_USER_TOKEN');
    });

    it('should throw ConflictException if page is already connected in workspace', async () => {
      channelsDb.set('existing_chan', {
        id: 'existing_chan',
        workspaceId: wsId,
        channelType: 'FACEBOOK_MESSENGER',
        providerAccountId: 'page_already_connected',
      });

      await expectReject(
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

    it('should reject connection when page is already connected in a different workspace (cross-tenant collision - TASK-3A-10)', async () => {
      channelsDb.set('other_chan', {
        id: 'other_chan',
        workspaceId: 'other_workspace_123',
        channelType: 'FACEBOOK_MESSENGER',
        providerAccountId: 'page_connected_elsewhere',
      });

      await expectReject(
        () =>
          service.connectPage(wsId, {
            pageId: 'page_connected_elsewhere',
            pageName: 'Other Shop Page',
            pageAccessToken: 'token',
            userAccessToken: 'user_token',
          }),
        /đã được kết nối với một workspace khác/,
      );
    });
  });

  describe('connectPagesBatch()', () => {
    it('should connect multiple pages in batch and auto-assign workspace members', async () => {
      const sessionId = 'session_batch_test';
      redisStore.set(
        `fb_user_token:${sessionId}`,
        JSON.stringify({
          userAccessToken: 'EAAB_BATCH_USER_TOKEN',
          workspaceId: wsId,
          pages: {
            page_batch_1: {
              accessToken: 'EAAB_TOKEN_1',
              name: 'Batch Fanpage 1',
              avatarUrl: 'https://example.com/p1.png',
            },
            page_batch_2: {
              accessToken: 'EAAB_TOKEN_2',
              name: 'Batch Fanpage 2',
              avatarUrl: 'https://example.com/p2.png',
            },
          },
        }),
      );

      const result = await service.connectPagesBatch(wsId, {
        pageIds: ['page_batch_1', 'page_batch_2'],
        sessionId,
        assignAllMembers: true,
      });

      expect(result.inboxes.length).toBe(2);
      expect(result.inboxes[0].pageId).toBe('page_batch_1');
      expect(result.inboxes[0].pageName).toBe('Batch Fanpage 1');
      expect(result.inboxes[1].pageId).toBe('page_batch_2');
      expect(result.inboxes[1].pageName).toBe('Batch Fanpage 2');

      // Check DB records
      expect(channelsDb.get(result.inboxes[0].channelId)).toBeTruthy();
      expect(channelsDb.get(result.inboxes[1].channelId)).toBeTruthy();
      expect(inboxesDb.get(result.inboxes[0].inboxId)).toBeTruthy();
      expect(inboxesDb.get(result.inboxes[1].inboxId)).toBeTruthy();

      // Check session cleaned up
      expect(redisStore.has(`fb_user_token:${sessionId}`)).toBe(false);
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
      expect(result.success).toBe(true);
      expect(channelsDb.has(chanId)).toBe(false);
      expect(inboxesDb.has(inboxId)).toBe(false);

      const emitted = emittedEvents.find(e => e.event === 'channel.deleted');
      assertDefined(emitted);
      expect(emitted.payload.channelId).toBe(chanId);
    });
  });
});
