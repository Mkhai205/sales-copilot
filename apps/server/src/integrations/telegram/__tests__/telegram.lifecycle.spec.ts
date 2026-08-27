import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { ConfigService } from '@nestjs/config';
import { ChannelType } from '@sales-copilot/shared-contracts';
import { TelegramLifecycleService } from '../telegram.lifecycle';
import { TelegramAdapter } from '../telegram.adapter';
import { ChannelCredentialService } from '../../../modules/inboxes/channel-credential.service';
import { PrismaService } from '../../../infrastructure/database';

describe('TelegramLifecycleService (Automated Webhook Setup & Token Validation)', () => {
  let service: TelegramLifecycleService;
  let adapter: TelegramAdapter;
  let credentialService: ChannelCredentialService;
  let configService: ConfigService;
  let channelsDb: Map<string, any>;
  let inboxesDb: Map<string, any>;

  const wsId = 'ws_telegram_test';
  const chanId = 'chan_tg_1';
  const inboxId = 'inbox_tg_1';
  const botToken = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';

  beforeEach(() => {
    channelsDb = new Map();
    inboxesDb = new Map();

    const mockConfig = {
      get: (key: string) => {
        if (key === 'CHANNEL_ENCRYPTION_KEY' || key === 'ENCRYPTION_KEY') {
          return '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
        }
        if (key === 'WEBHOOK_BASE_URL' || key === 'APP_URL' || key === 'BASE_URL') {
          return 'https://app.salescopilot.io';
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

    adapter = new TelegramAdapter();
    service = new TelegramLifecycleService(prismaMock, adapter, credentialService, configService);
  });

  describe('setupWebhook() and handleChannelEvent()', () => {
    it('should successfully validate bot token, set webhook, and update channel metadata on channel.created', async () => {
      // Setup initial channel with encrypted bot token
      const encryptedCreds = credentialService.encrypt({
        botToken,
        webhookSecret: 'secret_token_123',
      });

      channelsDb.set(chanId, {
        id: chanId,
        workspaceId: wsId,
        inboxId,
        channelType: ChannelType.TELEGRAM,
        credentials: { encrypted: encryptedCreds },
        providerAccountId: null,
        isConnected: false,
        settings: {},
      });

      inboxesDb.set(inboxId, {
        id: inboxId,
        workspaceId: wsId,
        name: 'Telegram Support',
        avatarUrl: null,
      });

      // Mock Telegram adapter methods
      let getChannelInfoCalled = false;
      let deleteWebhookCalled = false;
      let setWebhookUrl = '';
      let setWebhookSecret = '';

      adapter.getChannelInfo = async () => {
        getChannelInfoCalled = true;
        return {
          providerAccountId: '99887766',
          name: 'Sales Copilot Bot',
          avatarUrl: 'https://api.telegram.org/file/bot123/bot_avatar.jpg',
          metadata: {
            id: 99887766,
            username: 'sales_copilot_bot',
          },
        };
      };

      adapter.deleteWebhook = async () => {
        deleteWebhookCalled = true;
        return { ok: true };
      };

      adapter.setWebhook = async (_token, url, secret) => {
        setWebhookUrl = url;
        setWebhookSecret = secret || '';
        return { ok: true, description: 'Webhook was set' };
      };

      // Trigger event
      await service.handleChannelEvent({
        workspaceId: wsId,
        channelId: chanId,
        inboxId,
        channelType: ChannelType.TELEGRAM,
      });

      assert.strictEqual(getChannelInfoCalled, true);
      assert.strictEqual(deleteWebhookCalled, true);
      assert.strictEqual(setWebhookUrl, `https://app.salescopilot.io/channels/${chanId}/webhook`);
      assert.strictEqual(setWebhookSecret, 'secret_token_123');

      // Verify channel updated in DB
      const updatedChannel = channelsDb.get(chanId);
      assert.strictEqual(updatedChannel.isConnected, true);
      assert.strictEqual(updatedChannel.providerAccountId, '99887766');
      assert.strictEqual(updatedChannel.settings.botUsername, 'sales_copilot_bot');
      assert.strictEqual(updatedChannel.settings.botName, 'Sales Copilot Bot');
      assert.strictEqual(
        updatedChannel.settings.webhookUrl,
        `https://app.salescopilot.io/channels/${chanId}/webhook`,
      );
      assert.strictEqual(updatedChannel.settings.lastSyncError, null);
      assert.ok(updatedChannel.settings.lastSyncAt);

      // Verify inbox avatar updated
      const updatedInbox = inboxesDb.get(inboxId);
      assert.strictEqual(
        updatedInbox.avatarUrl,
        'https://api.telegram.org/file/bot123/bot_avatar.jpg',
      );
    });

    it('should handle invalid bot token gracefully and mark isConnected = false', async () => {
      const encryptedCreds = credentialService.encrypt({
        botToken: 'invalid_token_999',
      });

      channelsDb.set(chanId, {
        id: chanId,
        workspaceId: wsId,
        inboxId,
        channelType: ChannelType.TELEGRAM,
        credentials: { encrypted: encryptedCreds },
        providerAccountId: null,
        isConnected: false,
        settings: {},
      });

      adapter.getChannelInfo = async () => {
        throw new Error('Telegram API getMe error: [401] Unauthorized: invalid token');
      };

      const result = await service.setupWebhook(wsId, chanId);
      assert.strictEqual(result, false);

      const updatedChannel = channelsDb.get(chanId);
      assert.strictEqual(updatedChannel.isConnected, false);
      assert.ok(
        updatedChannel.settings.lastSyncError.includes(
          'Telegram API getMe error: [401] Unauthorized',
        ),
      );
    });

    it('should handle missing bot token in credentials and mark isConnected = false', async () => {
      channelsDb.set(chanId, {
        id: chanId,
        workspaceId: wsId,
        inboxId,
        channelType: ChannelType.TELEGRAM,
        credentials: {},
        providerAccountId: null,
        isConnected: false,
        settings: {},
      });

      const result = await service.setupWebhook(wsId, chanId);
      assert.strictEqual(result, false);

      const updatedChannel = channelsDb.get(chanId);
      assert.strictEqual(updatedChannel.isConnected, false);
      assert.strictEqual(updatedChannel.settings.lastSyncError, 'MISSING_BOT_TOKEN');
    });

    it('should handle Telegram setWebhook failure gracefully', async () => {
      const encryptedCreds = credentialService.encrypt({ botToken });

      channelsDb.set(chanId, {
        id: chanId,
        workspaceId: wsId,
        inboxId,
        channelType: ChannelType.TELEGRAM,
        credentials: { encrypted: encryptedCreds },
        providerAccountId: null,
        isConnected: false,
        settings: {},
      });

      adapter.getChannelInfo = async () => ({
        providerAccountId: '123',
        name: 'Bot',
      });

      adapter.deleteWebhook = async () => ({ ok: true });
      adapter.setWebhook = async () => ({
        ok: false,
        description: 'Bad Request: HTTPS url must be provided for webhook',
      });

      const result = await service.setupWebhook(wsId, chanId);
      assert.strictEqual(result, false);

      const updatedChannel = channelsDb.get(chanId);
      assert.strictEqual(updatedChannel.isConnected, false);
      assert.strictEqual(
        updatedChannel.settings.lastSyncError,
        'Bad Request: HTTPS url must be provided for webhook',
      );
    });

    it('should ignore non-Telegram channel events', async () => {
      let setupCalled = false;
      adapter.getChannelInfo = async () => {
        setupCalled = true;
        return { name: 'Bot' };
      };

      await service.handleChannelEvent({
        workspaceId: wsId,
        channelId: chanId,
        inboxId,
        channelType: ChannelType.FACEBOOK_MESSENGER,
      });

      assert.strictEqual(setupCalled, false);
    });

    it('should return false if channel does not exist in workspace', async () => {
      const result = await service.setupWebhook(wsId, 'non_existent_chan');
      assert.strictEqual(result, false);
    });
  });

  describe('removeWebhook() and handleChannelDeleted()', () => {
    it('should call deleteWebhook on channel deletion', async () => {
      const encryptedCreds = credentialService.encrypt({ botToken });

      channelsDb.set(chanId, {
        id: chanId,
        workspaceId: wsId,
        inboxId,
        channelType: ChannelType.TELEGRAM,
        credentials: { encrypted: encryptedCreds },
      });

      let deleteWebhookCalled = false;
      adapter.deleteWebhook = async (token: string) => {
        assert.strictEqual(token, botToken);
        deleteWebhookCalled = true;
        return { ok: true };
      };

      await service.handleChannelDeleted({
        workspaceId: wsId,
        channelId: chanId,
        inboxId,
        channelType: ChannelType.TELEGRAM,
      });

      assert.strictEqual(deleteWebhookCalled, true);
    });

    it('should return false if channel is missing or has no token', async () => {
      const res1 = await service.removeWebhook(wsId, 'missing_chan');
      assert.strictEqual(res1, false);

      channelsDb.set(chanId, {
        id: chanId,
        workspaceId: wsId,
        channelType: ChannelType.TELEGRAM,
        credentials: {},
      });

      const res2 = await service.removeWebhook(wsId, chanId);
      assert.strictEqual(res2, false);
    });
  });
});
