import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ChannelType } from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database';
import { RedisService } from '../../infrastructure/redis';
import { ChannelCredentialService } from '../../modules/inboxes/channel-credential.service';
import { FacebookAdapter } from './facebook.adapter';
import { ChannelContext, ChannelLifecycleEventPayload } from '../channel-adapter.types';

/**
 * Authorization error threshold before marking channel for reauthorization.
 * Reference: Chatwoot reauthorizable.rb AUTHORIZATION_ERROR_THRESHOLD = 2
 */
const AUTHORIZATION_ERROR_THRESHOLD = 2;

/**
 * Facebook Page Webhook Subscription Lifecycle Service.
 *
 * Manages automatic Facebook App webhook subscriptions when FACEBOOK_MESSENGER channels
 * are created, updated, or deleted.
 */
@Injectable()
export class FacebookLifecycleService {
  private readonly logger = new Logger(FacebookLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adapter: FacebookAdapter,
    private readonly credentialService: ChannelCredentialService,
    private readonly redis: RedisService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Decrypts stored channel credentials.
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
   * Handles channel.created and channel.updated domain events.
   */
  @OnEvent('channel.created')
  @OnEvent('channel.updated')
  async handleChannelEvent(payload: ChannelLifecycleEventPayload): Promise<void> {
    if (payload.channelType !== ChannelType.FACEBOOK_MESSENGER) {
      return;
    }

    this.logger.log(
      `Processing Facebook Page subscription setup for channel '${payload.channelId}' in workspace '${payload.workspaceId}'`,
    );

    await this.setupPageSubscription(payload.workspaceId, payload.channelId);
  }

  /**
   * Handles channel.deleted domain event.
   */
  @OnEvent('channel.deleted')
  async handleChannelDeleted(payload: ChannelLifecycleEventPayload): Promise<void> {
    if (payload.channelType !== ChannelType.FACEBOOK_MESSENGER) {
      return;
    }

    this.logger.log(
      `Processing Facebook Page webhook unsubscribe for deleted channel '${payload.channelId}' in workspace '${payload.workspaceId}'`,
    );

    await this.removePageSubscription(payload.workspaceId, payload.channelId);
  }

  /**
   * Validates Page Access Token, queries Page info, subscribes Facebook page to webhooks,
   * and updates channel metadata in the database.
   */
  async setupPageSubscription(workspaceId: string, channelId: string): Promise<boolean> {
    const client = this.prisma.getClient();

    const channel = await client.channel.findFirst({
      where: { id: channelId, workspaceId },
      include: { inbox: true },
    });

    if (!channel) {
      this.logger.warn(`Channel '${channelId}' not found in workspace '${workspaceId}'`);
      return false;
    }

    if (channel.channelType !== ChannelType.FACEBOOK_MESSENGER) {
      return false;
    }

    const decrypted = this.decryptCredentials(channel.credentials);
    const pageAccessToken = String(
      decrypted.pageAccessToken ||
        decrypted.page_access_token ||
        decrypted.accessToken ||
        decrypted.token ||
        '',
    );

    const channelSettings = (channel.settings as Record<string, unknown>) || {};

    if (!pageAccessToken) {
      this.logger.warn(
        `No Page Access Token found in credentials for Facebook channel '${channelId}'`,
      );
      await client.channel.update({
        where: { id: channelId },
        data: {
          isConnected: false,
          settings: {
            ...channelSettings,
            lastSyncError: 'MISSING_PAGE_ACCESS_TOKEN',
            lastSyncAt: new Date().toISOString(),
          },
        },
      });
      return false;
    }

    try {
      // 1. Validate Page Access Token & fetch Page Info via getChannelInfo
      const channelContext: ChannelContext = {
        channelId,
        inboxId: channel.inboxId,
        workspaceId,
        channelType: ChannelType.FACEBOOK_MESSENGER,
        credentials: decrypted,
        settings: channelSettings,
        providerAccountId: channel.providerAccountId,
      };

      const pageInfo = await this.adapter.getChannelInfo(channelContext);

      // 2. Subscribe page to Webhooks via /me/subscribed_apps
      const subscribeResult = await this.adapter.subscribeApps(pageAccessToken);

      const isConnected = Boolean(subscribeResult.success);

      // 3. Update channel with Page metadata and subscription status
      const updatedSettings = {
        ...channelSettings,
        pageId: pageInfo.providerAccountId || String(pageInfo.metadata?.pageId || ''),
        pageName: pageInfo.name,
        subscribedAt: isConnected ? new Date().toISOString() : undefined,
        lastSyncAt: new Date().toISOString(),
        lastSyncError: subscribeResult.success
          ? null
          : subscribeResult.description || 'SUBSCRIBE_APPS_FAILED',
      };

      await client.channel.update({
        where: { id: channelId },
        data: {
          providerAccountId: pageInfo.providerAccountId || channel.providerAccountId,
          isConnected,
          settings: updatedSettings as any,
        },
      });

      // 4. Optionally update Inbox avatar if empty and Page has avatar
      if (pageInfo.avatarUrl && channel.inbox && !channel.inbox.avatarUrl) {
        await client.inbox.update({
          where: { id: channel.inboxId },
          data: { avatarUrl: pageInfo.avatarUrl },
        });
      }

      this.logger.log(
        `Facebook channel '${channelId}' successfully configured (Page: '${pageInfo.name}', isConnected: ${isConnected})`,
      );

      return isConnected;
    } catch (err) {
      const errorMessage = (err as Error).message || 'Facebook Page setup failed';
      this.logger.error(
        `Failed to configure Facebook channel '${channelId}': ${errorMessage}`,
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
   * Unsubscribes the Facebook Page from webhooks when the channel is deleted or disconnected.
   */
  async removePageSubscription(workspaceId: string, channelId: string): Promise<boolean> {
    const client = this.prisma.getClient();

    const channel = await client.channel.findFirst({
      where: { id: channelId, workspaceId },
    });

    if (!channel) return false;

    const decrypted = this.decryptCredentials(channel.credentials);
    const pageAccessToken = String(
      decrypted.pageAccessToken ||
        decrypted.page_access_token ||
        decrypted.accessToken ||
        decrypted.token ||
        '',
    );

    if (!pageAccessToken) return false;

    try {
      const result = await this.adapter.unsubscribeApps(pageAccessToken);
      return Boolean(result.success);
    } catch (err) {
      this.logger.warn(
        `Failed to unsubscribe Facebook Page for channel '${channelId}': ${(err as Error).message}`,
      );
      return false;
    }
  }

  // ─── Token Reauthorization ─────────────────────────────────────────────────
  // Reference: Chatwoot reauthorizable.rb#authorization_error! + prompt_reauthorization!

  /**
   * Handles Facebook API authorization errors (token expired/revoked).
   * Increments error counter in Redis; if threshold is reached, marks channel for reauthorization.
   *
   * Triggered by OutboundMessageListener or ingestion processor when FacebookAdapter
   * encounters: "Error validating access token" or "The session has been invalidated".
   */
  @OnEvent('facebook.authorization_error')
  async handleAuthorizationError(payload: {
    channelId: string;
    workspaceId: string;
    errorMessage: string;
  }): Promise<void> {
    const { channelId, workspaceId, errorMessage } = payload;
    const errorCountKey = `channel:${channelId}:auth_errors`;
    const reauthKey = `channel:${channelId}:reauth_required`;

    // Increment error counter (auto-expires after 24h to avoid stale counts)
    const errorCount = await this.redis.incr(errorCountKey);
    if (errorCount === 1) {
      // Set TTL only on first error
      const client = this.redis.getClient();
      if (client) {
        await client.expire(errorCountKey, 86400); // 24 hours
      }
    }

    this.logger.warn(
      `Facebook auth error #${errorCount} for channel '${channelId}': ${errorMessage}`,
    );

    if (errorCount < AUTHORIZATION_ERROR_THRESHOLD) {
      return;
    }

    // Threshold breached — mark channel for reauthorization
    const alreadyMarked = await this.redis.get(reauthKey);
    if (alreadyMarked) {
      return;
    }

    await this.redis.set(reauthKey, 'true');

    const client = this.prisma.getClient();
    const channel = await client.channel.findFirst({
      where: { id: channelId, workspaceId },
    });

    if (!channel) return;

    const channelSettings = (channel.settings as Record<string, unknown>) || {};

    await client.channel.update({
      where: { id: channelId },
      data: {
        isConnected: false,
        settings: {
          ...channelSettings,
          reauthorizationRequired: true,
          reauthorizationRequestedAt: new Date().toISOString(),
          lastAuthError: errorMessage,
        },
      },
    });

    this.eventEmitter.emit('channel.reauthorization_required', {
      workspaceId,
      channelId,
      channelType: ChannelType.FACEBOOK_MESSENGER,
    });

    this.logger.warn(
      `Facebook channel '${channelId}' marked for reauthorization after ${errorCount} auth errors`,
    );
  }
}
