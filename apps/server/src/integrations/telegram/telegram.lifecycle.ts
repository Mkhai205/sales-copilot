import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { ChannelType } from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database';
import { ChannelCredentialService } from '../../modules/inboxes/channel-credential.service';
import { TelegramAdapter } from './telegram.adapter';
import { ChannelLifecycleEventPayload } from '../channel-adapter.types';

@Injectable()
export class TelegramLifecycleService {
  private readonly logger = new Logger(TelegramLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adapter: TelegramAdapter,
    private readonly credentialService: ChannelCredentialService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Decrypt stored channel credentials.
   */
  private decryptCredentials(rawCredentials: unknown): Record<string, unknown> {
    if (!rawCredentials) return {};
    if (typeof rawCredentials === 'object' && rawCredentials !== null) {
      const credsObj = rawCredentials as Record<string, any>;
      if (credsObj.encrypted && typeof credsObj.encrypted === 'string') {
        try {
          return this.credentialService.decrypt(credsObj.encrypted);
        } catch {
          this.logger.warn('Failed to decrypt channel credentials');
          return {};
        }
      }
      return credsObj;
    } else if (typeof rawCredentials === 'string' && rawCredentials.includes(':')) {
      try {
        return this.credentialService.decrypt(rawCredentials);
      } catch {
        this.logger.warn('Failed to decrypt channel credentials string');
        return {};
      }
    }
    return {};
  }

  /**
   * Constructs the public webhook URL for a channel.
   */
  private getWebhookUrl(channelId: string): string {
    const rawBaseUrl =
      this.configService.get<string>('WEBHOOK_BASE_URL') ||
      this.configService.get<string>('APP_URL') ||
      this.configService.get<string>('BASE_URL') ||
      'http://localhost:8000';

    const baseUrl = rawBaseUrl.replace(/\/+$/, '');
    return `${baseUrl}/channels/${channelId}/webhook`;
  }

  /**
   * Handles channel.created and channel.updated domain events.
   */
  @OnEvent('channel.created')
  @OnEvent('channel.updated')
  async handleChannelEvent(payload: ChannelLifecycleEventPayload): Promise<void> {
    if (payload.channelType !== ChannelType.TELEGRAM) {
      return;
    }

    this.logger.log(
      `Processing Telegram channel setup for channel '${payload.channelId}' in workspace '${payload.workspaceId}'`,
    );

    await this.setupWebhook(payload.workspaceId, payload.channelId);
  }

  /**
   * Handles channel.deleted domain event.
   */
  @OnEvent('channel.deleted')
  async handleChannelDeleted(payload: ChannelLifecycleEventPayload): Promise<void> {
    if (payload.channelType !== ChannelType.TELEGRAM) {
      return;
    }

    this.logger.log(
      `Processing Telegram webhook cleanup for deleted channel '${payload.channelId}' in workspace '${payload.workspaceId}'`,
    );

    await this.removeWebhook(payload.workspaceId, payload.channelId);
  }

  /**
   * Validates bot token, queries bot info, deletes old webhook, registers new webhook,
   * and updates channel metadata in the database.
   */
  async setupWebhook(workspaceId: string, channelId: string): Promise<boolean> {
    const client = this.prisma.getClient();

    const channel = await client.channel.findFirst({
      where: { id: channelId, workspaceId },
      include: { inbox: true },
    });

    if (!channel) {
      this.logger.warn(`Channel '${channelId}' not found in workspace '${workspaceId}'`);
      return false;
    }

    if (channel.channelType !== ChannelType.TELEGRAM) {
      return false;
    }

    const decrypted = this.decryptCredentials(channel.credentials);
    const botToken = String(
      decrypted.botToken || decrypted.bot_token || decrypted.token || decrypted.accessToken || '',
    );

    const channelSettings = (channel.settings as Record<string, unknown>) || {};

    if (!botToken) {
      this.logger.warn(`No bot token found in credentials for Telegram channel '${channelId}'`);
      await client.channel.update({
        where: { id: channelId },
        data: {
          isConnected: false,
          settings: {
            ...channelSettings,
            lastSyncError: 'MISSING_BOT_TOKEN',
            lastSyncAt: new Date().toISOString(),
          },
        },
      });
      return false;
    }

    try {
      // 1. Validate bot token & get bot info via getChannelInfo
      const channelContext = {
        channelId,
        inboxId: channel.inboxId,
        workspaceId,
        channelType: ChannelType.TELEGRAM,
        credentials: decrypted,
        settings: channelSettings,
        providerAccountId: channel.providerAccountId,
      };

      const botInfo = await this.adapter.getChannelInfo(channelContext);

      // 2. Compute public webhook URL and secret token
      const webhookUrl = this.getWebhookUrl(channelId);
      const secretToken =
        decrypted.webhookSecret || decrypted.secret_token || decrypted.secretToken
          ? String(decrypted.webhookSecret || decrypted.secret_token || decrypted.secretToken)
          : undefined;

      // 3. Delete existing webhook and set new webhook
      await this.adapter.deleteWebhook(botToken);
      const setWebhookResult = await this.adapter.setWebhook(botToken, webhookUrl, secretToken);

      const isConnected = Boolean(setWebhookResult.ok);

      // 4. Update channel with bot metadata and status
      const updatedSettings = {
        ...channelSettings,
        botUsername: botInfo.metadata?.username,
        botName: botInfo.name,
        webhookUrl,
        webhookSetAt: new Date().toISOString(),
        lastSyncAt: new Date().toISOString(),
        lastSyncError: setWebhookResult.ok
          ? null
          : setWebhookResult.description || 'SET_WEBHOOK_FAILED',
      };

      await client.channel.update({
        where: { id: channelId },
        data: {
          providerAccountId: botInfo.providerAccountId || String(botInfo.metadata?.id || ''),
          isConnected,
          settings: updatedSettings as any,
        },
      });

      // Optionally update Inbox avatar if empty and bot has avatar
      if (botInfo.avatarUrl && channel.inbox && !channel.inbox.avatarUrl) {
        await client.inbox.update({
          where: { id: channel.inboxId },
          data: { avatarUrl: botInfo.avatarUrl },
        });
      }

      this.logger.log(
        `Telegram channel '${channelId}' successfully configured (Bot: @${botInfo.metadata?.username || botInfo.name}, isConnected: ${isConnected})`,
      );

      return isConnected;
    } catch (err) {
      const errorMessage = (err as Error).message || 'Telegram setup failed';
      this.logger.error(
        `Failed to configure Telegram channel '${channelId}': ${errorMessage}`,
        (err as Error).stack,
      );

      await client.channel.update({
        where: { id: channelId },
        data: {
          isConnected: false,
          settings: {
            ...channelSettings,
            lastSyncError: errorMessage,
            lastSyncAt: new Date().toISOString(),
          },
        },
      });

      return false;
    }
  }

  /**
   * Deletes the Telegram webhook when channel is removed or disconnected.
   */
  async removeWebhook(workspaceId: string, channelId: string): Promise<boolean> {
    const client = this.prisma.getClient();

    const channel = await client.channel.findFirst({
      where: { id: channelId, workspaceId },
    });

    if (!channel) return false;

    const decrypted = this.decryptCredentials(channel.credentials);
    const botToken = String(
      decrypted.botToken || decrypted.bot_token || decrypted.token || decrypted.accessToken || '',
    );

    if (!botToken) return false;

    try {
      const result = await this.adapter.deleteWebhook(botToken);
      return Boolean(result.ok);
    } catch (err) {
      this.logger.warn(
        `Failed to delete Telegram webhook for channel '${channelId}': ${(err as Error).message}`,
      );
      return false;
    }
  }
}
