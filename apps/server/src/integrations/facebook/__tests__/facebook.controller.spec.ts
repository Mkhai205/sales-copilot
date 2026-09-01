import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { FacebookController } from '../facebook.controller';
import { FacebookService } from '../facebook.service';
import { FacebookAdapter } from '../facebook.adapter';
import { ChannelCredentialService } from '../../../modules/inboxes/channel-credential.service';
import { PrismaService } from '../../../infrastructure/database';
import { WebhooksService } from '../../../modules/webhooks/webhooks.service';

describe('FacebookController (REST & Central Webhook Endpoints)', () => {
  let controller: FacebookController;
  let facebookService: FacebookService;
  let webhooksService: WebhooksService;
  let configService: ConfigService;
  let credentialService: ChannelCredentialService;
  let prismaMock: any;
  let channelsDb: Map<string, any>;
  let forwardedWebhooks: Array<{ channelId: string; payload: any; headers: any }>;

  const wsId = 'ws_fb_ctrl_test';
  const chanId = 'chan_fb_ctrl_1';
  const mockAppSecret = 'platform_app_secret_12345';
  const mockVerifyToken = 'platform_verify_token_123';
  const mockPageId = '1234567890';

  const mockContext = {
    workspaceId: wsId,
    userId: 'user_123',
    role: 'ADMIN',
  } as any;

  beforeEach(() => {
    channelsDb = new Map();
    forwardedWebhooks = [];

    const mockConfig = {
      get: (key: string) => {
        if (key === 'CHANNEL_ENCRYPTION_KEY' || key === 'ENCRYPTION_KEY') {
          return '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
        }
        if (key === 'FB_APP_SECRET') return mockAppSecret;
        if (key === 'FB_VERIFY_TOKEN') return mockVerifyToken;
        if (key === 'CORS_ORIGIN') return ['http://localhost:3000'];
        return undefined;
      },
    };
    configService = mockConfig as unknown as ConfigService;
    credentialService = new ChannelCredentialService(configService);

    const clientMock = {
      channel: {
        findFirst: async ({ where }: { where: any }) => {
          for (const c of channelsDb.values()) {
            if (where.channelType && c.channelType !== where.channelType) continue;
            if (where.providerAccountId && c.providerAccountId !== where.providerAccountId)
              continue;
            return c;
          }
          return null;
        },
      },
    };

    prismaMock = {
      getClient: () => clientMock,
    } as unknown as PrismaService;

    facebookService = {
      getAuthUrl: async (workspaceId: string) => ({
        authUrl: `https://graph.facebook.com/v19.0/dialog/oauth?client_id=123&state=${workspaceId}:abc`,
      }),
      handleCallback: async (code: string, state: string) => ({
        workspaceId: state.split(':')[0],
        sessionId: 'session_abc',
      }),
      discoverPages: async (workspaceId: string, sessionId: string) => [
        {
          pageId: mockPageId,
          pageName: 'Test Page',
          avatarUrl: 'https://example.com/p.png',
          isAlreadyConnected: false,
        },
      ],
      connectPage: async (workspaceId: string, dto: any, sessionId?: string) => ({
        inboxId: 'inbox_123',
        channelId: 'chan_123',
      }),
      disconnectPage: async (workspaceId: string, channelId: string) => ({
        success: true,
      }),
      reauthorizePage: async (workspaceId: string, channelId: string, token: string) => ({
        success: true,
      }),
    } as unknown as FacebookService;

    webhooksService = {
      handleInboundWebhook: async (channelId: string, payload: any, headers: any, query: any) => {
        forwardedWebhooks.push({ channelId, payload, headers });
        return { success: true, eventId: 'event_123' };
      },
    } as unknown as WebhooksService;

    const adapter = new FacebookAdapter();

    controller = new FacebookController(
      facebookService,
      configService,
      prismaMock,
      credentialService,
      webhooksService,
      adapter,
    );
  });

  describe('OAuth Endpoints', () => {
    it('getAuthUrl() should return Facebook OAuth login URL', async () => {
      const result = await controller.getAuthUrl(mockContext);
      assert.ok(result.authUrl);
      assert.ok(result.authUrl.includes('graph.facebook.com'));
    });

    it('discoverPages() should return pages for valid session', async () => {
      const pages = await controller.discoverPages(mockContext, 'session_abc');
      assert.strictEqual(pages.length, 1);
      assert.strictEqual(pages[0].pageId, mockPageId);
    });

    it('connectPage() should validate DTO and call service', async () => {
      const result = await controller.connectPage(
        mockContext,
        {
          pageId: mockPageId,
          pageName: 'Test Page',
          pageAccessToken: 'EAAB_PAGE_TOKEN',
          userAccessToken: 'EAAB_USER_TOKEN',
        },
        'session_abc',
      );
      assert.strictEqual(result.channelId, 'chan_123');
    });

    it('disconnectPage() should call service to disconnect channel', async () => {
      const result = await controller.disconnectPage(mockContext, chanId);
      assert.strictEqual(result.success, true);
    });
  });

  describe('Central Webhook Verification (GET)', () => {
    it('should verify hub.challenge when token matches FB_VERIFY_TOKEN', async () => {
      let sentStatus = 0;
      let sentBody = '';

      const resMock = {
        status: (s: number) => {
          sentStatus = s;
          return {
            send: (b: string) => {
              sentBody = b;
            },
          };
        },
      } as any;

      await controller.verifyCentralWebhook(
        'subscribe',
        mockVerifyToken,
        'my_challenge_code_123',
        resMock,
      );

      assert.strictEqual(sentStatus, 200);
      assert.strictEqual(sentBody, 'my_challenge_code_123');
    });

    it('should reject verification when token does not match', async () => {
      let sentStatus = 0;

      const resMock = {
        status: (s: number) => {
          sentStatus = s;
          return {
            send: () => {},
          };
        },
      } as any;

      await controller.verifyCentralWebhook(
        'subscribe',
        'wrong_token',
        'my_challenge_code_123',
        resMock,
      );

      assert.strictEqual(sentStatus, 403);
    });
  });

  describe('Central Webhook Ingestion (POST)', () => {
    it('should verify HMAC signature using FB_APP_SECRET, resolve channel by page_id, and forward to WebhooksService', async () => {
      // Register channel in channelsDb
      channelsDb.set(chanId, {
        id: chanId,
        workspaceId: wsId,
        channelType: 'FACEBOOK_MESSENGER',
        providerAccountId: mockPageId,
      });

      const body = {
        object: 'page',
        entry: [
          {
            id: mockPageId,
            time: 1700000000000,
            messaging: [
              {
                sender: { id: 'user_psid_999' },
                recipient: { id: mockPageId },
                timestamp: 1700000000000,
                message: { mid: 'm_mid_123', text: 'Xin chào Sales Copilot' },
              },
            ],
          },
        ],
      };

      const bodyString = JSON.stringify(body);
      const signature = `sha256=${crypto
        .createHmac('sha256', mockAppSecret)
        .update(bodyString)
        .digest('hex')}`;

      const headers = {
        'x-hub-signature-256': signature,
      };

      const result = await controller.handleCentralWebhook(body, headers, {});
      assert.strictEqual(result.success, true);

      // Verify forwarded to WebhooksService with correct channel ID
      assert.strictEqual(forwardedWebhooks.length, 1);
      assert.strictEqual(forwardedWebhooks[0].channelId, chanId);
      assert.strictEqual(forwardedWebhooks[0].payload.entry[0].id, mockPageId);
    });

    it('should reject webhook when HMAC signature is invalid', async () => {
      const body = { object: 'page', entry: [{ id: mockPageId }] };
      const headers = { 'x-hub-signature-256': 'sha256=invalid_hash' };

      const result = await controller.handleCentralWebhook(body, headers, {});
      assert.strictEqual(result.success, false);
      assert.strictEqual(forwardedWebhooks.length, 0);
    });
  });
});
