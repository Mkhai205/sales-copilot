import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { FacebookController } from '../facebook.controller';
import { FacebookService } from '../facebook.service';
import { FacebookAdapter } from '../facebook.adapter';
import { ChannelCredentialService } from '../../../../omnichannel/inboxes/channel-credential.service';
import { PrismaService } from '../../../../../infrastructure/database';
import { WebhooksService } from '../../../../automation/webhooks/webhooks.service';

describe('FacebookController (REST & Central Webhook Endpoints)', () => {
  let controller: FacebookController;
  let facebookService: FacebookService;
  let webhooksService: WebhooksService;
  let configService: ConfigService;
  let credentialService: ChannelCredentialService;
  let prismaMock: any;
  let channelsDb: Map<string, any>;
  let forwardedWebhooks: Array<{ channelId: string; payload: any; headers: any }>;
  let channelEventsDb: Map<string, any>;
  let commentGuardJobs: Array<{ name: string; data: any; options: any }>;
  let commentGuardQueueMock: any;

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
    channelEventsDb = new Map();
    forwardedWebhooks = [];
    commentGuardJobs = [];

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
      channelEvent: {
        findUnique: async ({ where }: { where: any }) => {
          const key = `${where.channelId_externalEventId?.channelId}_${where.channelId_externalEventId?.externalEventId}`;
          return channelEventsDb.get(key) || null;
        },
        create: async ({ data }: { data: any }) => {
          const key = `${data.channelId}_${data.externalEventId}`;
          const evt = { id: `evt_${Date.now()}`, ...data };
          channelEventsDb.set(key, evt);
          return evt;
        },
      },
    };

    prismaMock = {
      getClient: () => clientMock,
    } as unknown as PrismaService;

    facebookService = {
      getAuthUrl: async (workspaceId: string) => ({
        authUrl: `https://www.facebook.com/v26.0/dialog/oauth?client_id=123&state=${workspaceId}:abc`,
      }),
      handleCallback: async (code: string, state: string) => ({
        workspaceId: state.split(':')[0],
        sessionId: 'session_abc',
      }),
      discoverPages: async (_workspaceId: string, _sessionId: string) => [
        {
          pageId: mockPageId,
          pageName: 'Test Page',
          avatarUrl: 'https://example.com/p.png',
          isAlreadyConnected: false,
        },
      ],
      connectPage: async (_workspaceId: string, _dto: any, _sessionId?: string) => ({
        inboxId: 'inbox_123',
        channelId: 'chan_123',
      }),
      connectPagesBatch: async (_workspaceId: string, _dto: any) => ({
        inboxes: [
          {
            inboxId: 'inbox_123',
            channelId: 'chan_123',
            pageId: mockPageId,
            pageName: 'Test Page',
          },
        ],
      }),
      disconnectPage: async (_workspaceId: string, _channelId: string) => ({
        success: true,
      }),
      reauthorizePage: async (_workspaceId: string, _channelId: string, _token: string) => ({
        success: true,
      }),
    } as unknown as FacebookService;

    webhooksService = {
      handleInboundWebhook: async (channelId: string, payload: any, headers: any, _query: any) => {
        forwardedWebhooks.push({ channelId, payload, headers });
        return { success: true, eventId: 'event_123' };
      },
    } as unknown as WebhooksService;

    commentGuardQueueMock = {
      add: async (name: string, data: any, options: any) => {
        commentGuardJobs.push({ name, data, options });
        return { id: `job_${data.commentId}` };
      },
    };

    const adapter = new FacebookAdapter();

    controller = new FacebookController(
      facebookService,
      configService,
      prismaMock,
      credentialService,
      webhooksService,
      adapter,
      commentGuardQueueMock,
    );
  });

  describe('OAuth Endpoints', () => {
    it('getAuthUrl() should return Facebook OAuth login URL', async () => {
      const result = await controller.getAuthUrl(mockContext);
      assert.ok(result.authUrl);
      assert.ok(result.authUrl.includes('facebook.com'));
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

    it('connectPagesBatch() should validate DTO and call service', async () => {
      const result = await controller.connectPagesBatch(mockContext, {
        pageIds: [mockPageId],
        sessionId: 'session_abc',
        assignAllMembers: true,
      });
      assert.strictEqual(result.inboxes.length, 1);
      assert.strictEqual(result.inboxes[0].pageId, mockPageId);
    });

    it('disconnectPage() should call service to disconnect channel', async () => {
      const result = await controller.disconnectPage(mockContext, chanId);
      assert.strictEqual(result.success, true);
    });

    it('handleCallback() should return HTML sending postMessage on success', async () => {
      let sentStatus = 0;
      let sentHtml = '';
      let setHeaderKey = '';
      let setHeaderVal = '';

      const resMock = {
        setHeader: (k: string, v: string) => {
          setHeaderKey = k;
          setHeaderVal = v;
        },
        status: (s: number) => {
          sentStatus = s;
          return {
            send: (html: string) => {
              sentHtml = html;
            },
          };
        },
      } as any;

      await controller.handleCallback('code_123', `${wsId}:csrf_token`, resMock);

      assert.strictEqual(sentStatus, 200);
      assert.strictEqual(setHeaderKey, 'Content-Type');
      assert.strictEqual(setHeaderVal, 'text/html');
      assert.ok(sentHtml.includes('FACEBOOK_OAUTH_SUCCESS'));
      assert.ok(sentHtml.includes('session_abc'));
    });

    it('handleCallback() should return HTML sending postMessage on failure', async () => {
      let sentStatus = 0;
      let sentHtml = '';

      const resMock = {
        setHeader: () => {},
        status: (s: number) => {
          sentStatus = s;
          return {
            send: (html: string) => {
              sentHtml = html;
            },
          };
        },
      } as any;

      // Mock failure in handleCallback
      const origHandleCallback = facebookService.handleCallback;
      facebookService.handleCallback = async () => {
        throw new Error('Invalid code');
      };

      try {
        await controller.handleCallback('bad_code', `${wsId}:csrf_token`, resMock);
        assert.strictEqual(sentStatus, 200);
        assert.ok(sentHtml.includes('FACEBOOK_OAUTH_ERROR'));
        assert.ok(sentHtml.includes('Invalid code'));
      } finally {
        facebookService.handleCallback = origHandleCallback;
      }
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

    it('should process feed comment and enqueue to commentGuardQueue when commentGuard is enabled', async () => {
      channelsDb.set(chanId, {
        id: chanId,
        workspaceId: wsId,
        channelType: 'FACEBOOK_MESSENGER',
        providerAccountId: mockPageId,
        settings: {
          commentGuard: {
            enabled: true,
            publicReplyEnabled: true,
          },
        },
      });

      const body = {
        object: 'page',
        entry: [
          {
            id: mockPageId,
            time: 1700000000000,
            changes: [
              {
                field: 'feed',
                value: {
                  item: 'comment',
                  verb: 'add',
                  comment_id: 'comment_fb_123',
                  post_id: 'post_fb_999',
                  from: { id: 'customer_psid_1', name: 'Nguyen Van Test' },
                  message: 'Shop oi tu van em ao size L 0912345678',
                  created_time: 1700000000,
                },
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

      // Verify job enqueued to commentGuardQueue
      assert.strictEqual(commentGuardJobs.length, 1);
      assert.strictEqual(commentGuardJobs[0].name, 'process-comment-guard');
      assert.strictEqual(commentGuardJobs[0].data.commentId, 'comment_fb_123');
      assert.strictEqual(commentGuardJobs[0].data.senderId, 'customer_psid_1');
      assert.strictEqual(
        commentGuardJobs[0].data.message,
        'Shop oi tu van em ao size L 0912345678',
      );
      assert.strictEqual(commentGuardJobs[0].options.jobId, 'comment_comment_fb_123');
    });

    it('should filter out comments authored by the Page itself', async () => {
      channelsDb.set(chanId, {
        id: chanId,
        workspaceId: wsId,
        channelType: 'FACEBOOK_MESSENGER',
        providerAccountId: mockPageId,
        settings: {
          commentGuard: {
            enabled: true,
          },
        },
      });

      const body = {
        object: 'page',
        entry: [
          {
            id: mockPageId,
            changes: [
              {
                field: 'feed',
                value: {
                  item: 'comment',
                  verb: 'add',
                  comment_id: 'page_comment_1',
                  from: { id: mockPageId, name: 'Page Name' }, // Same as page ID
                  message: 'Lien he hotline 0912345678',
                },
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

      const result = await controller.handleCentralWebhook(
        body,
        { 'x-hub-signature-256': signature },
        {},
      );
      assert.strictEqual(result.success, true);
      assert.strictEqual(commentGuardJobs.length, 0);
    });

    it('should skip feed comment when Comment Guard is disabled on channel', async () => {
      channelsDb.set(chanId, {
        id: chanId,
        workspaceId: wsId,
        channelType: 'FACEBOOK_MESSENGER',
        providerAccountId: mockPageId,
        settings: {
          commentGuard: {
            enabled: false,
          },
        },
      });

      const body = {
        object: 'page',
        entry: [
          {
            id: mockPageId,
            changes: [
              {
                field: 'feed',
                value: {
                  item: 'comment',
                  verb: 'add',
                  comment_id: 'comment_skip',
                  from: { id: 'cust_2' },
                  message: '0912345678',
                },
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

      const result = await controller.handleCentralWebhook(
        body,
        { 'x-hub-signature-256': signature },
        {},
      );
      assert.strictEqual(result.success, true);
      assert.strictEqual(commentGuardJobs.length, 0);
    });

    it('should deduplicate when duplicate comment ID webhook is received', async () => {
      channelsDb.set(chanId, {
        id: chanId,
        workspaceId: wsId,
        channelType: 'FACEBOOK_MESSENGER',
        providerAccountId: mockPageId,
        settings: {
          commentGuard: {
            enabled: true,
          },
        },
      });

      const body = {
        object: 'page',
        entry: [
          {
            id: mockPageId,
            changes: [
              {
                field: 'feed',
                value: {
                  item: 'comment',
                  verb: 'add',
                  comment_id: 'comment_dedup_1',
                  from: { id: 'cust_3' },
                  message: '0912345678',
                },
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

      // First webhook: should enqueue
      await controller.handleCentralWebhook(body, { 'x-hub-signature-256': signature }, {});
      assert.strictEqual(commentGuardJobs.length, 1);

      // Second webhook with same comment_id: should deduplicate and NOT enqueue second job
      await controller.handleCentralWebhook(body, { 'x-hub-signature-256': signature }, {});
      assert.strictEqual(commentGuardJobs.length, 1);
    });

    it('should correctly enqueue edited comment even if add comment with same comment_id was already received', async () => {
      channelsDb.set(chanId, {
        id: chanId,
        workspaceId: wsId,
        channelType: 'FACEBOOK_MESSENGER',
        providerAccountId: mockPageId,
        settings: {
          commentGuard: {
            enabled: true,
          },
        },
      });

      const addBody = {
        object: 'page',
        entry: [
          {
            id: mockPageId,
            changes: [
              {
                field: 'feed',
                value: {
                  item: 'comment',
                  verb: 'add',
                  comment_id: 'comment_edit_test_1',
                  from: { id: 'cust_4' },
                  message: 'San pham con hang khong?',
                },
              },
            ],
          },
        ],
      };

      const addSignature = `sha256=${crypto
        .createHmac('sha256', mockAppSecret)
        .update(JSON.stringify(addBody))
        .digest('hex')}`;

      // 1. Initial comment added without phone
      await controller.handleCentralWebhook(addBody, { 'x-hub-signature-256': addSignature }, {});
      assert.strictEqual(commentGuardJobs.length, 1);
      assert.strictEqual(commentGuardJobs[0].data.verb, 'add');

      // 2. Customer edits the comment to add phone number
      const editBody = {
        object: 'page',
        entry: [
          {
            id: mockPageId,
            changes: [
              {
                field: 'feed',
                value: {
                  item: 'comment',
                  verb: 'edited',
                  comment_id: 'comment_edit_test_1',
                  from: { id: 'cust_4' },
                  message: 'San pham con hang khong? 0912345678',
                  created_time: 1726000000,
                },
              },
            ],
          },
        ],
      };

      const editSignature = `sha256=${crypto
        .createHmac('sha256', mockAppSecret)
        .update(JSON.stringify(editBody))
        .digest('hex')}`;

      await controller.handleCentralWebhook(editBody, { 'x-hub-signature-256': editSignature }, {});
      assert.strictEqual(commentGuardJobs.length, 2);
      assert.strictEqual(commentGuardJobs[1].data.verb, 'edited');
      assert.strictEqual(commentGuardJobs[1].data.message, 'San pham con hang khong? 0912345678');

      // 3. Duplicate retry of the edited event should be deduplicated
      await controller.handleCentralWebhook(editBody, { 'x-hub-signature-256': editSignature }, {});
      assert.strictEqual(commentGuardJobs.length, 2);
    });
  });
});
