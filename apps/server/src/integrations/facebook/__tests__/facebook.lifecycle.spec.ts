import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert';
import { ConfigService } from '@nestjs/config';
import { ChannelType } from '@sales-copilot/shared-contracts';
import { FacebookLifecycleService } from '../facebook.lifecycle';
import { FacebookAdapter } from '../facebook.adapter';
import { ChannelCredentialService } from '../../../modules/inboxes/channel-credential.service';
import { PrismaService } from '../../../infrastructure/database';

describe('FacebookLifecycleService (Page Webhook Subscription Management)', () => {
  let service: FacebookLifecycleService;
  let adapter: FacebookAdapter;
  let credentialService: ChannelCredentialService;
  let configService: ConfigService;
  let channelsDb: Map<string, any>;
  let inboxesDb: Map<string, any>;
  let originalFetch: typeof globalThis.fetch;

  const wsId = 'ws_fb_lifecycle_test';
  const chanId = 'chan_fb_1';
  const inboxId = 'inbox_fb_1';
  const pageAccessToken = 'EAABcdef1234567890abcdef1234567890';
  const mockPageId = '10987654321';

  beforeEach(() => {
    channelsDb = new Map();
    inboxesDb = new Map();
    originalFetch = globalThis.fetch;

    const mockConfig = {
      get: (key: string) => {
        if (key === 'CHANNEL_ENCRYPTION_KEY' || key === 'ENCRYPTION_KEY') {
          return '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
        }
        return undefined;
      },
    };
    configService = mockConfig as unknown as ConfigService;
    credentialService = new ChannelCredentialService(configService);

    const clientMock = {
      channel: {
        findFirst: async ({ where }: { where: { id: string; workspaceId?: string } }) => {
          const c = channelsDb.get(where.id);
          if (!c) return null;
          if (where.workspaceId && c.workspaceId !== where.workspaceId) return null;
          const inbox = inboxesDb.get(c.inboxId);
          return { ...c, inbox: inbox || null };
        },
        update: async ({ where, data }: { where: { id: string }; data: any }) => {
          const c = channelsDb.get(where.id);
          if (!c) throw new Error('Channel not found');
          const updated = { ...c, ...data };
          channelsDb.set(where.id, updated);
          return updated;
        },
      },
      inbox: {
        findFirst: async ({ where }: { where: { id: string } }) => {
          return inboxesDb.get(where.id) || null;
        },
        update: async ({ where, data }: { where: { id: string }; data: any }) => {
          const inbox = inboxesDb.get(where.id);
          if (!inbox) throw new Error('Inbox not found');
          const updated = { ...inbox, ...data };
          inboxesDb.set(where.id, updated);
          return updated;
        },
      },
    };

    const prismaMock = {
      getClient: () => clientMock,
    } as unknown as PrismaService;

    adapter = new FacebookAdapter();
    service = new FacebookLifecycleService(prismaMock, adapter, credentialService);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('setupPageSubscription() and handleChannelEvent()', () => {
    it('should successfully subscribe Facebook page, get page info, and update channel metadata on channel.created', async () => {
      // Setup initial channel with encrypted page access token
      const encryptedCreds = credentialService.encrypt({
        pageAccessToken,
        appSecret: 'test_app_secret',
      });

      channelsDb.set(chanId, {
        id: chanId,
        workspaceId: wsId,
        inboxId,
        channelType: ChannelType.FACEBOOK_MESSENGER,
        credentials: { encrypted: encryptedCreds },
        providerAccountId: null,
        isConnected: false,
        settings: {},
      });

      inboxesDb.set(inboxId, {
        id: inboxId,
        workspaceId: wsId,
        name: 'Facebook Support Inbox',
        avatarUrl: null,
      });

      // Mock Graph API calls (/me and /me/subscribed_apps)
      let subscribedAppsCalled = false;
      let getMeCalled = false;

      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = String(url);

        if (urlStr.includes('/me/subscribed_apps')) {
          subscribedAppsCalled = true;
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true }),
          } as unknown as Response;
        }

        if (urlStr.includes('/me?fields=id,name,picture.type(large)')) {
          getMeCalled = true;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: mockPageId,
              name: 'Alpha Official Facebook Page',
              picture: {
                data: {
                  url: 'https://cdn.facebook.com/pages/alpha_avatar.jpg',
                },
              },
            }),
          } as unknown as Response;
        }

        return {
          ok: false,
          status: 404,
          json: async () => ({ error: { message: 'Not found' } }),
        } as unknown as Response;
      }) as typeof globalThis.fetch;

      // Trigger event
      await service.handleChannelEvent({
        workspaceId: wsId,
        channelId: chanId,
        inboxId,
        channelType: ChannelType.FACEBOOK_MESSENGER,
      });

      assert.strictEqual(getMeCalled, true);
      assert.strictEqual(subscribedAppsCalled, true);

      // Verify updated channel in DB
      const updatedChannel = channelsDb.get(chanId);
      assert.strictEqual(updatedChannel.isConnected, true);
      assert.strictEqual(updatedChannel.providerAccountId, mockPageId);
      assert.strictEqual(updatedChannel.settings.pageName, 'Alpha Official Facebook Page');
      assert.strictEqual(updatedChannel.settings.pageId, mockPageId);
      assert.ok(updatedChannel.settings.subscribedAt);
      assert.strictEqual(updatedChannel.settings.lastSyncError, null);

      // Verify Inbox avatar updated
      const updatedInbox = inboxesDb.get(inboxId);
      assert.strictEqual(updatedInbox.avatarUrl, 'https://cdn.facebook.com/pages/alpha_avatar.jpg');
    });

    it('should ignore channel.created events for non-Facebook channels', async () => {
      let fetchCalled = false;
      globalThis.fetch = (async () => {
        fetchCalled = true;
        return {} as Response;
      }) as typeof globalThis.fetch;

      await service.handleChannelEvent({
        workspaceId: wsId,
        channelId: chanId,
        inboxId,
        channelType: ChannelType.TELEGRAM,
      });

      assert.strictEqual(fetchCalled, false);
    });

    it('should handle missing pageAccessToken gracefully', async () => {
      channelsDb.set(chanId, {
        id: chanId,
        workspaceId: wsId,
        inboxId,
        channelType: ChannelType.FACEBOOK_MESSENGER,
        credentials: {},
        isConnected: false,
        settings: {},
      });

      const success = await service.setupPageSubscription(wsId, chanId);
      assert.strictEqual(success, false);

      const channel = channelsDb.get(chanId);
      assert.strictEqual(channel.isConnected, false);
      assert.strictEqual(channel.settings.lastSyncError, 'MISSING_PAGE_ACCESS_TOKEN');
    });

    it('should handle Facebook Graph API errors during setup gracefully', async () => {
      const encryptedCreds = credentialService.encrypt({
        pageAccessToken: 'invalid_expired_token',
      });

      channelsDb.set(chanId, {
        id: chanId,
        workspaceId: wsId,
        inboxId,
        channelType: ChannelType.FACEBOOK_MESSENGER,
        credentials: { encrypted: encryptedCreds },
        isConnected: false,
        settings: {},
      });

      globalThis.fetch = (async () => ({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          error: {
            message: 'Error validating access token: Session has expired',
            code: 190,
          },
        }),
      })) as unknown as typeof globalThis.fetch;

      const success = await service.setupPageSubscription(wsId, chanId);
      assert.strictEqual(success, false);

      const channel = channelsDb.get(chanId);
      assert.strictEqual(channel.isConnected, false);
      assert.ok(
        channel.settings.lastSyncError.includes(
          'Error validating access token: Session has expired',
        ),
      );
    });

    it('should return false if channel does not exist in workspace', async () => {
      const success = await service.setupPageSubscription(wsId, 'non_existent_chan');
      assert.strictEqual(success, false);
    });

    it('should support plain credentials objects', async () => {
      channelsDb.set(chanId, {
        id: chanId,
        workspaceId: wsId,
        inboxId,
        channelType: ChannelType.FACEBOOK_MESSENGER,
        credentials: {
          pageAccessToken: 'plain_token_123',
        },
        isConnected: false,
        settings: {},
      });

      globalThis.fetch = (async (url: string | URL | Request) => {
        const urlStr = String(url);
        if (urlStr.includes('/me/subscribed_apps')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true }),
          } as unknown as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'page_plain_1',
            name: 'Plain Page',
          }),
        } as unknown as Response;
      }) as typeof globalThis.fetch;

      const success = await service.setupPageSubscription(wsId, chanId);
      assert.strictEqual(success, true);
    });
  });

  describe('removePageSubscription() and handleChannelDeleted()', () => {
    it('should unsubscribe page from webhooks via DELETE /me/subscribed_apps on channel.deleted', async () => {
      const encryptedCreds = credentialService.encrypt({
        pageAccessToken,
      });

      channelsDb.set(chanId, {
        id: chanId,
        workspaceId: wsId,
        inboxId,
        channelType: ChannelType.FACEBOOK_MESSENGER,
        credentials: { encrypted: encryptedCreds },
      });

      let deleteSubscribedAppsCalled = false;

      globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
        if (init?.method === 'DELETE') {
          deleteSubscribedAppsCalled = true;
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true }),
          } as unknown as Response;
        }
        return { ok: false } as Response;
      }) as typeof globalThis.fetch;

      await service.handleChannelDeleted({
        workspaceId: wsId,
        channelId: chanId,
        inboxId,
        channelType: ChannelType.FACEBOOK_MESSENGER,
      });

      assert.strictEqual(deleteSubscribedAppsCalled, true);
    });

    it('should ignore channel.deleted for non-Facebook channels', async () => {
      let deleteCalled = false;
      globalThis.fetch = (async () => {
        deleteCalled = true;
        return {} as Response;
      }) as typeof globalThis.fetch;

      await service.handleChannelDeleted({
        workspaceId: wsId,
        channelId: chanId,
        inboxId,
        channelType: ChannelType.TELEGRAM,
      });

      assert.strictEqual(deleteCalled, false);
    });

    it('should return false if channel does not exist when removing page subscription', async () => {
      const result = await service.removePageSubscription(wsId, 'non_existent_chan');
      assert.strictEqual(result, false);
    });
  });
});
