import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { ChannelType } from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { ChannelCredentialService } from '../../../../infrastructure/crypto/channel-credential.service';
import { ZaloOaAdapter } from './zalo.adapter';
import { ChannelLifecycleEventPayload, ChannelContext } from '../channel-adapter.types';

/**
 * Reacts to Zalo channel lifecycle events:
 * - created/updated → validates the OA via `GET /oa`, guards against swapping the
 *   channel to a different OA, and syncs OA metadata + the webhook URL to register
 *   manually in the OA Console (Zalo has no set-webhook API).
 * - deleted → log only; the owner removes the callback URL in the OA Console.
 */
@Injectable()
export class ZaloLifecycleService {
  private readonly logger = new Logger(ZaloLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adapter: ZaloOaAdapter,
    private readonly credentialService: ChannelCredentialService,
    private readonly configService: ConfigService,
  ) {}

  @OnEvent('channel.created')
  async handleChannelCreated(payload: ChannelLifecycleEventPayload): Promise<void> {
    if (payload.channelType !== ChannelType.ZALO) {
      return;
    }
    this.logger.log(
      `Processing Zalo channel setup on channel.created for channel '${payload.channelId}' in workspace '${payload.workspaceId}'`,
    );
    await this.validateAndSync(payload.workspaceId, payload.channelId);
  }

  @OnEvent('channel.updated')
  async handleChannelUpdated(payload: ChannelLifecycleEventPayload): Promise<void> {
    if (payload.channelType !== ChannelType.ZALO) {
      return;
    }
    this.logger.log(
      `Processing Zalo channel update on channel.updated for channel '${payload.channelId}' in workspace '${payload.workspaceId}'`,
    );

    const client = this.prisma.getClient();
    const channel = await client.channel.findFirst({
      where: { id: payload.channelId, workspaceId: payload.workspaceId },
    });

    if (channel && channel.isConnected === false) {
      // Deliberate disconnect — keep it disconnected (validation would reconnect it).
      this.logger.log(
        `Zalo channel '${payload.channelId}' is marked disconnected; skipping validation`,
      );
      return;
    }

    await this.validateAndSync(payload.workspaceId, payload.channelId);
  }

  @OnEvent('channel.deleted')
  async handleChannelDeleted(payload: ChannelLifecycleEventPayload): Promise<void> {
    if (payload.channelType !== ChannelType.ZALO) {
      return;
    }
    this.logger.log(
      `Zalo channel '${payload.channelId}' deleted. Owner should remove the callback URL from the OA Console.`,
    );
  }

  /**
   * Validates the OA through the adapter (token refresh handled by ZaloOaTokenService),
   * enforces the OA-id guard, and syncs OA metadata into channel settings.
   */
  async validateAndSync(workspaceId: string, channelId: string): Promise<boolean> {
    const client = this.prisma.getClient();

    const channel = await client.channel.findFirst({
      where: { id: channelId, workspaceId },
      include: { inbox: true },
    });

    if (!channel || channel.channelType !== ChannelType.ZALO) {
      this.logger.warn(`Zalo channel '${channelId}' not found in workspace '${workspaceId}'`);
      return false;
    }

    const decrypted = this.credentialService.decryptChannelCredentials(channel.credentials);
    const channelSettings = (channel.settings as Record<string, unknown>) || {};

    if (!decrypted.accessToken) {
      await this.markSyncError(workspaceId, channelId, channelSettings, 'MISSING_CREDENTIALS');
      return false;
    }

    try {
      const channelContext: ChannelContext = {
        channelId,
        inboxId: channel.inboxId,
        workspaceId,
        channelType: ChannelType.ZALO,
        credentials: decrypted,
        settings: channelSettings,
        providerAccountId: channel.providerAccountId,
      };

      const oaInfo = await this.adapter.getChannelInfo(channelContext);

      // Security Guard: prevent swapping this channel to a different Official Account.
      const existingOaId =
        channel.providerAccountId || (channelSettings.oaId as string | undefined);
      const incomingOaId = oaInfo.providerAccountId;
      if (existingOaId && incomingOaId && existingOaId !== incomingOaId) {
        const mismatchError = `OA_ID_MISMATCH: OA được ủy quyền (${incomingOaId}) khác với OA ban đầu (${existingOaId}). Vui lòng ủy quyền đúng Official Account hoặc tạo Inbox mới.`;
        this.logger.warn(
          `Security Guard: Prevented OA mismatch for channel '${channelId}'. Existing: ${existingOaId}, New: ${incomingOaId}`,
        );
        await this.markSyncError(workspaceId, channelId, channelSettings, mismatchError);
        return false;
      }

      const webhookUrl = this.getWebhookUrl(channelId);
      await client.channel.update({
        where: { workspaceId_id: { workspaceId, id: channelId } },
        data: {
          providerAccountId: incomingOaId || channel.providerAccountId,
          isConnected: true,
          settings: {
            ...channelSettings,
            oaId: incomingOaId || existingOaId,
            oaName: oaInfo.name,
            oaAvatar: oaInfo.avatarUrl,
            webhookUrl,
            lastSyncAt: new Date().toISOString(),
            lastSyncError: null,
          } as any,
        },
      });

      if (oaInfo.avatarUrl && channel.inbox && !channel.inbox.avatarUrl) {
        await client.inbox.update({
          where: { workspaceId_id: { workspaceId, id: channel.inboxId } },
          data: { avatarUrl: oaInfo.avatarUrl },
        });
      }

      this.logger.log(
        `Zalo channel '${channelId}' validated (OA: ${oaInfo.name}, isConnected: true)`,
      );
      return true;
    } catch (err) {
      const errorMessage = (err as Error).message || 'Zalo OA validation failed';
      this.logger.error(
        `Failed to validate Zalo channel '${channelId}': ${errorMessage}`,
        (err as Error).stack,
      );
      await this.markSyncError(workspaceId, channelId, channelSettings, errorMessage);
      return false;
    }
  }

  private getWebhookUrl(channelId: string): string {
    const baseUrl = this.configService.get<string>('WEBHOOK_BASE_URL');
    return `${baseUrl}/api/v1/channels/${channelId}/webhook`;
  }

  private async markSyncError(
    workspaceId: string,
    channelId: string,
    channelSettings: Record<string, unknown>,
    error: string,
  ): Promise<void> {
    try {
      const client = this.prisma.getClient();
      await client.channel.update({
        where: { workspaceId_id: { workspaceId, id: channelId } },
        data: {
          isConnected: false,
          settings: {
            ...channelSettings,
            lastSyncError: error,
            lastSyncAt: new Date().toISOString(),
          } as any,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to record Zalo sync error for channel '${channelId}': ${(err as Error).message}`,
      );
    }
  }
}
