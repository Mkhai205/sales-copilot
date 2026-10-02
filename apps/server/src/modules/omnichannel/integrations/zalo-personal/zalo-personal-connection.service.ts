import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import {
  ChannelType,
  DeliveryStatus,
  MessageContentType,
  MessageType,
  SenderType,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { ChannelCredentialService } from '../../../../infrastructure/crypto/channel-credential.service';
import { WebhooksService } from '../channel-webhooks/webhooks.service';
import { MessagesService } from '../../messages/messages.service';
import {
  ZALO_PERSONAL_CONNECT_SESSION_TTL_MS,
  ZALO_PERSONAL_ENVELOPE_KIND,
  ZALO_PERSONAL_RECONNECT_BACKOFF_MS,
} from './zalo-personal.constants';
import { ZaloPersonalClientProvider } from './zalo-personal-client.provider';
import { buildIngestEnvelope, ZaloListenerMessage } from './zalo-personal.adapter';
import type { ZaloPersonalEnvelope } from './zalo-personal.types';
import { ZaloLoginQREventPayload } from './zalo-personal.types';

type ZaloApi = {
  listener: {
    on: (event: string, handler: (...args: any[]) => void) => unknown;
    start: () => Promise<unknown>;
    stop: () => Promise<unknown>;
  };
  getOwnId: () => Promise<string> | string;
  sendMessage: (
    message: string,
    threadId: string,
    type?: number,
  ) => Promise<{ message: { msgId?: string } | null; attachment: unknown[] }>;
  getUserInfo: (ids: string[]) => Promise<{
    changed_profiles?: Record<string, Record<string, unknown>>;
  }>;
  getStickersDetail: (stickerIds: number[]) => Promise<Array<{ stickerUrl?: string } | undefined>>;
};

type PendingConnectSession = {
  id: string;
  workspaceId: string;
  channelId?: string; // set when the session is a re-authorize of an existing channel
  status: 'pending' | 'qr_ready' | 'scanned' | 'connected' | 'failed' | 'expired';
  zalo: unknown;
  qrImage?: string;
  profileName?: string;
  profileAvatar?: string;
  ownId?: string;
  credentials?: { imei: string; cookie: unknown[]; userAgent: string };
  api?: ZaloApi;
  error?: string;
  expiresAt: number;
};

interface ActiveConnection {
  api: ZaloApi;
  ownId: string;
  backoffIndex: number;
  reconnectTimer?: ReturnType<typeof setTimeout>;
}

/**
 * Owns the live zca-js sessions for every connected ZALO_PERSONAL channel:
 * QR connect sessions, listener lifecycle, reconnect supervision, and the
 * self-message ingestion path (owner replies sent from their phone app).
 *
 * Inbound customer messages are pushed into the STANDARD ingestion pipeline via
 * WebhooksService.handleInboundWebhook with skipSignatureVerification (there is no
 * inbound webhook for personal accounts — the listener is the transport).
 */
@Injectable()
export class ZaloPersonalConnectionService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ZaloPersonalConnectionService.name);
  private readonly connections = new Map<string, ActiveConnection>();
  private readonly pendingConnects = new Map<string, PendingConnectSession>();
  private selfIngesting = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly credentialService: ChannelCredentialService,
    private readonly clientProvider: ZaloPersonalClientProvider,
    private readonly webhooksService: WebhooksService,
    private readonly messagesService: MessagesService,
  ) {}

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  async onApplicationBootstrap(): Promise<void> {
    await this.restoreConnections();
  }

  async onModuleDestroy(): Promise<void> {
    for (const [channelId, entry] of this.connections) {
      if (entry.reconnectTimer) clearTimeout(entry.reconnectTimer);
      try {
        await entry.api.listener.stop();
      } catch {
        /* ignore */
      }
      this.connections.delete(channelId);
    }
    for (const session of this.pendingConnects.values()) {
      this.disposePendingSession(session);
    }
    this.pendingConnects.clear();
  }

  /** Re-logins every connected ZALO_PERSONAL channel from persisted credentials. */
  private async restoreConnections(): Promise<void> {
    const client = this.prisma.getClient();
    const channels = await client.channel.findMany({
      where: { channelType: ChannelType.ZALO_PERSONAL, isConnected: true },
    });

    for (const channel of channels) {
      try {
        await this.connectFromCredentials(channel.id);
        this.logger.log(`Restored Zalo personal connection for channel '${channel.id}'`);
      } catch (err) {
        this.logger.error(
          `Failed to restore Zalo personal connection for channel '${channel.id}': ${(err as Error).message}`,
        );
        await this.markReauthorizationRequired(channel.id, (err as Error).message);
      }
    }
  }

  // ─── QR connect sessions ───────────────────────────────────────────────────

  /**
   * Starts a QR login session. The web UI polls `getConnectSessionStatus` for the
   * QR image (zca-js provides it as `data.image` on QRCodeGenerated) and states.
   */
  async createConnectSession(
    workspaceId: string,
    channelId?: string,
  ): Promise<{ sessionId: string; expiresInMs: number }> {
    if (channelId) {
      const channel = await this.prisma.getClient().channel.findFirst({
        where: { id: channelId, workspaceId, channelType: ChannelType.ZALO_PERSONAL },
      });
      if (!channel) {
        throw new NotFoundException({
          code: 'CHANNEL_NOT_FOUND',
          message: `Zalo personal channel '${channelId}' not found in this workspace`,
        });
      }
    }

    const sessionId = randomUUID();
    const session: PendingConnectSession = {
      id: sessionId,
      workspaceId,
      channelId,
      status: 'pending',
      expiresAt: Date.now() + ZALO_PERSONAL_CONNECT_SESSION_TTL_MS,
      zalo: this.clientProvider.create(),
    };
    this.pendingConnects.set(sessionId, session);

    setTimeout(() => {
      const current = this.pendingConnects.get(sessionId);
      if (current === session && current.status !== 'connected') {
        current.status = 'expired';
        this.disposePendingSession(session);
      }
    }, ZALO_PERSONAL_CONNECT_SESSION_TTL_MS).unref?.();

    void (async () => {
      try {
        const api = (await (
          session.zalo as {
            loginQR: (opts: object, cb?: (event: never) => unknown) => Promise<unknown>;
          }
        ).loginQR({ language: 'vi' }, (event: ZaloLoginQREventPayload) =>
          this.handleLoginQREvent(session, event),
        )) as unknown as ZaloApi;

        session.api = api;
        session.ownId = String((await api.getOwnId()) ?? '') || session.ownId;
        if (!session.profileName && session.ownId) {
          const profile = await this.fetchProfile(api, session.ownId);
          session.profileName = profile?.name || session.profileName;
        }
        session.status = 'connected';
      } catch (err) {
        if (session.status !== 'connected') {
          session.status = 'failed';
          session.error = (err as Error).message;
        }
      }
    })();

    return { sessionId, expiresInMs: ZALO_PERSONAL_CONNECT_SESSION_TTL_MS };
  }

  getConnectSessionStatus(
    workspaceId: string,
    sessionId: string,
  ): {
    status: PendingConnectSession['status'];
    qrImage?: string;
    profileAvatar?: string;
    profileName?: string;
    ownId?: string;
    error?: string;
  } {
    const session = this.requireSession(workspaceId, sessionId);
    return {
      status: session.status,
      qrImage: session.qrImage,
      profileAvatar: session.profileAvatar,
      profileName: session.profileName,
      ownId: session.ownId,
      error: session.error,
    };
  }

  /**
   * Materializes the Inbox + Channel from a connected QR session.
   * When the session carries a channelId it completes a re-authorization instead.
   */
  async connect(
    workspaceId: string,
    dto: {
      sessionId: string;
      name?: string;
      avatarUrl?: string;
      memberUserIds?: string[];
      assignAllMembers?: boolean;
    },
    connectedByUserId?: string,
  ): Promise<{ inboxId: string; channelId: string; ownId: string; zaloName: string }> {
    const session = this.requireSession(workspaceId, dto.sessionId);
    if (session.status !== 'connected' || !session.credentials || !session.api) {
      throw new BadRequestException({
        code: 'ZALO_PERSONAL_SESSION_NOT_CONNECTED',
        message: 'Phiên quét QR chưa hoàn tất hoặc đã hết hạn. Vui lòng quét lại mã QR.',
      });
    }

    const ownId = session.ownId || (await this.resolveOwnId(session));
    if (!ownId) {
      throw new BadRequestException({
        code: 'ZALO_PERSONAL_OWN_ID_MISSING',
        message: 'Không xác định được tài khoản Zalo đã đăng nhập. Vui lòng quét lại mã QR.',
      });
    }

    // Re-authorize path: refresh credentials of an existing channel.
    if (session.channelId) {
      return this.completeReauthorize(session, ownId, connectedByUserId);
    }

    // New connection path.
    const client = this.prisma.getClient();
    const existing = await client.channel.findFirst({
      where: { channelType: ChannelType.ZALO_PERSONAL, providerAccountId: ownId },
    });
    if (existing) {
      this.disposePendingSession(session);
      this.pendingConnects.delete(session.id);
      throw new BadRequestException({
        code: 'ZALO_PERSONAL_ALREADY_CONNECTED',
        message: `Tài khoản Zalo này đã được kết nối trong hệ thống (một tài khoản chỉ duy trì một phiên web).`,
      });
    }

    let memberUserIds = dto.memberUserIds;
    if ((!memberUserIds || memberUserIds.length === 0) && dto.assignAllMembers !== false) {
      const workspaceMembers = await client.workspaceMember.findMany({
        where: { workspaceId },
        select: { userId: true },
      });
      memberUserIds = workspaceMembers.map(member => member.userId);
    }

    const zaloName = dto.name?.trim() || session.profileName || 'Zalo Cá nhân';
    const avatarUrl = dto.avatarUrl?.trim() || session.profileAvatar;
    const credentials = session.credentials;
    const encrypted = this.credentialService.encrypt({
      imei: credentials.imei,
      cookie: credentials.cookie,
      userAgent: credentials.userAgent,
      ownUserId: ownId,
    });

    const result = await this.prisma.runInTransaction(async txCtx => {
      const tx = txCtx.tx;
      const inbox = await tx.inbox.create({
        data: {
          workspaceId,
          name: zaloName,
          avatarUrl,
        },
      });
      const channel = await tx.channel.create({
        data: {
          workspaceId,
          inboxId: inbox.id,
          channelType: ChannelType.ZALO_PERSONAL,
          providerAccountId: ownId,
          credentials: { encrypted } as any,
          settings: { zaloName, connectedByUserId } as any,
          isConnected: true,
        },
      });
      if (memberUserIds && memberUserIds.length > 0) {
        await tx.inboxMember.createMany({
          data: memberUserIds.map(userId => ({ inboxId: inbox.id, userId })),
          skipDuplicates: true,
        });
      }
      return { inboxId: inbox.id, channelId: channel.id };
    });

    // The live session moves onto the channel immediately.
    this.registerConnection(result.channelId, session.api as ZaloApi, ownId);
    this.disposePendingSession(session);
    this.pendingConnects.delete(session.id);

    this.logger.log(
      `Connected Zalo personal account '${ownId}' (${zaloName}) to workspace '${workspaceId}'`,
    );

    return { inboxId: result.inboxId, channelId: result.channelId, ownId, zaloName };
  }

  /**
   * Persists freshly scanned credentials onto an existing channel (re-authorization)
   * and restarts the listener. The account guard rejects accounts other than the
   * originally connected one.
   */
  private async completeReauthorize(
    session: PendingConnectSession,
    ownId: string,
    connectedByUserId?: string,
  ): Promise<{ inboxId: string; channelId: string; ownId: string; zaloName: string }> {
    const client = this.prisma.getClient();
    const channel = await client.channel.findFirst({
      where: {
        id: session.channelId,
        workspaceId: session.workspaceId,
        channelType: ChannelType.ZALO_PERSONAL,
      },
    });
    if (!channel) {
      this.pendingConnects.delete(session.id);
      throw new NotFoundException({
        code: 'CHANNEL_NOT_FOUND',
        message: `Zalo personal channel '${session.channelId}' not found in this workspace`,
      });
    }
    if (channel.providerAccountId && channel.providerAccountId !== ownId) {
      this.disposePendingSession(session);
      this.pendingConnects.delete(session.id);
      throw new BadRequestException({
        code: 'ZALO_PERSONAL_MISMATCH',
        message: `Tài khoản Zalo vừa quét (${ownId}) khác với tài khoản của kênh này (${channel.providerAccountId}). Vui lòng đăng nhập đúng tài khoản.`,
      });
    }

    const zaloName = session.profileName || 'Zalo Cá nhân';
    if (!session.credentials) {
      throw new BadRequestException({
        code: 'ZALO_PERSONAL_SESSION_NOT_CONNECTED',
        message: 'Phiên quét QR chưa hoàn tất hoặc đã hết hạn. Vui lòng quét lại mã QR.',
      });
    }
    const credentials = session.credentials;
    const encrypted = this.credentialService.encrypt({
      imei: credentials.imei,
      cookie: credentials.cookie,
      userAgent: credentials.userAgent,
      ownUserId: ownId,
    });

    const settings = (channel.settings as Record<string, unknown>) || {};
    await client.channel.update({
      where: { workspaceId_id: { workspaceId: session.workspaceId, id: channel.id } },
      data: {
        credentials: { encrypted } as any,
        isConnected: true,
        settings: {
          ...settings,
          zaloName,
          ...(connectedByUserId ? { connectedByUserId } : {}),
          reauthorizationRequired: false,
          lastSyncError: null,
          lastSyncAt: new Date().toISOString(),
        } as any,
      },
    });

    this.registerConnection(channel.id, session.api as ZaloApi, ownId);
    this.disposePendingSession(session);
    this.pendingConnects.delete(session.id);

    this.logger.log(`Re-authorized Zalo personal channel '${channel.id}'`);

    return { inboxId: channel.inboxId, channelId: channel.id, ownId, zaloName };
  }

  /** Returns the live zca-js API for a channel (throws when not connected). */
  async getApiForChannel(channelId: string): Promise<ZaloApi> {
    const entry = this.connections.get(channelId);
    if (!entry) {
      throw new Error(
        'ZALO_PERSONAL_NOT_CONNECTED: kênh Zalo cá nhân chưa kết nối hoặc phiên đã chết. Vui lòng quét lại mã QR.',
      );
    }
    return entry.api;
  }

  // ─── Listener ingestion ────────────────────────────────────────────────────

  /**
   * Ingests an inbound envelope (also used by e2e tests): routes self messages
   * into the outgoing-mirror path and everything else through the standard pipeline.
   */
  async ingestEnvelope(channelId: string, envelope: unknown): Promise<void> {
    const parsed = envelope as ZaloPersonalEnvelope | null;
    if (parsed?.kind === ZALO_PERSONAL_ENVELOPE_KIND && parsed.message?.isSelf) {
      await this.ingestSelfMessage(channelId, parsed);
      return;
    }
    await this.webhooksService.handleInboundWebhook(channelId, envelope, {}, undefined, {
      skipSignatureVerification: true,
    });
  }

  private async handleListenerMessage(channelId: string, msg: ZaloListenerMessage): Promise<void> {
    const envelope = buildIngestEnvelope(msg);
    if (!envelope) {
      this.logger.debug('Ignoring Zalo personal message (group thread or missing ids)');
      return;
    }

    if (envelope.message.isSelf) {
      await this.ingestSelfMessage(channelId, envelope);
      return;
    }

    await this.resolveStickerAttachment(channelId, envelope);

    await this.webhooksService.handleInboundWebhook(channelId, envelope, {}, undefined, {
      skipSignatureVerification: true,
    });
  }

  /**
   * Sticker messages carry only a sticker id — resolve it to a displayable image
   * URL through the Zalo sticker API. When resolution fails the message still
   * ingests as '[Sticker]' text instead of being dropped entirely.
   */
  private async resolveStickerAttachment(
    channelId: string,
    envelope: ZaloPersonalEnvelope,
  ): Promise<void> {
    if (envelope.message.msgType !== 'chat.sticker') return;
    if (envelope.message.text || envelope.message.attachments.length > 0) return;

    const { stickerId } = envelope.message;
    if (stickerId) {
      try {
        const api = await this.getApiForChannel(channelId);
        const [detail] = await api.getStickersDetail([stickerId]);
        if (detail?.stickerUrl) {
          envelope.message.attachments.push({ type: 'sticker', url: detail.stickerUrl });
          return;
        }
        this.logger.warn(`Zalo sticker '${stickerId}' resolved without an URL`);
      } catch (err) {
        this.logger.warn(
          `Failed to resolve Zalo sticker '${stickerId}' on channel '${channelId}': ${(err as Error).message}`,
        );
      }
    }
    envelope.message.text = '[Sticker]';
  }

  /**
   * Mirrors messages the account owner sends from their phone app into the inbox
   * as outgoing messages. Server-sent replies are skipped by externalId (loop guard).
   * Text only — phone-side media requires MinIO upload, deferred.
   */
  private async ingestSelfMessage(
    channelId: string,
    envelope: ZaloPersonalEnvelope,
  ): Promise<void> {
    if (envelope.message.attachments.length > 0) {
      this.logger.debug('Skipping self message with media (text-only self ingest)');
      return;
    }
    // Re-entrancy guard: the listener may deliver the same self message more than once.
    const guardKey = `${channelId}:${envelope.message.msgId}`;
    if (this.selfIngesting.has(guardKey)) return;
    this.selfIngesting.add(guardKey);

    try {
      const client = this.prisma.getClient();
      const channel = await client.channel.findUnique({ where: { id: channelId } });
      if (!channel) return;

      // Loop guard: a message id we sent from the server is already persisted.
      const serverSent = await client.message.findFirst({
        where: {
          externalId: envelope.message.msgId,
          conversation: { workspaceId: channel.workspaceId, inboxId: channel.inboxId },
        },
        select: { id: true },
      });
      if (serverSent) return;

      const conversation = await client.conversation.findFirst({
        where: {
          workspaceId: channel.workspaceId,
          inboxId: channel.inboxId,
          channelIdentity: { externalContactId: envelope.message.threadId },
        },
        select: { id: true, workspaceId: true },
      });
      if (!conversation) {
        this.logger.debug('Skipping self message: no conversation exists for this counterpart yet');
        return;
      }

      // Attribute the mirrored phone reply to the workspace member who
      // connected this channel (MessagesService requires a USER senderId).
      const connectedByUserId = (channel.settings as Record<string, unknown>)?.connectedByUserId as
        string | undefined;
      if (!connectedByUserId) {
        this.logger.debug('Skipping self message: channel has no connectedByUserId recorded');
        return;
      }

      const created = await this.messagesService.create(conversation.workspaceId, conversation.id, {
        content: envelope.message.text || undefined,
        senderType: SenderType.USER,
        senderId: connectedByUserId,
        messageType: MessageType.OUTGOING,
        contentType: MessageContentType.TEXT,
        externalId: envelope.message.msgId,
        metadata: { selfMessage: true, suppressOutbound: true },
      });
      // CreateMessageDto has no deliveryStatus field; mark the mirrored phone
      // reply as sent so it does not sit in a pending state in the inbox UI.
      await client.message.update({
        where: { id: (created as unknown as { id: string }).id },
        data: { deliveryStatus: DeliveryStatus.SENT },
      });
    } catch (err) {
      this.logger.error(`Failed to ingest self message: ${(err as Error).message}`);
    } finally {
      this.selfIngesting.delete(guardKey);
    }
  }

  // ─── Connection registry & reconnect supervision ───────────────────────────

  private async connectFromCredentials(channelId: string): Promise<void> {
    const channel = await this.prisma.getClient().channel.findUnique({
      where: { id: channelId },
    });
    if (!channel || channel.channelType !== ChannelType.ZALO_PERSONAL) {
      throw new Error('Channel is not a Zalo personal channel');
    }

    const decrypted = this.credentialService.decryptChannelCredentials(channel.credentials);
    const imei = decrypted.imei;
    const cookie = decrypted.cookie;
    const userAgent = decrypted.userAgent;
    if (!imei || !cookie || !userAgent) {
      throw new Error('MISSING_CREDENTIALS: channel has no persisted Zalo session');
    }

    const zalo = this.clientProvider.create();
    const api = (await zalo.login({
      imei: imei as string,
      cookie: cookie as any[],
      userAgent: userAgent as string,
    })) as unknown as ZaloApi;

    const ownId =
      String((await api.getOwnId()) ?? decrypted.ownUserId ?? '') ||
      String(decrypted.ownUserId ?? '');
    this.registerConnection(channelId, api, ownId);
  }

  private registerConnection(channelId: string, api: ZaloApi, ownId: string): void {
    const existing = this.connections.get(channelId);
    if (existing?.reconnectTimer) clearTimeout(existing.reconnectTimer);

    api.listener.on('message', (msg: ZaloListenerMessage) => {
      void this.handleListenerMessage(channelId, msg);
    });
    api.listener.on('disconnected', (...args: unknown[]) => {
      this.logger.warn(
        `Zalo personal listener disconnected for channel '${channelId}': ${args.join(' ')}`,
      );
      this.scheduleReconnect(channelId);
    });
    api.listener.on('connected', () => {
      const entry = this.connections.get(channelId);
      if (entry) entry.backoffIndex = 0;
    });
    void api.listener.start();

    this.connections.set(channelId, { api, ownId, backoffIndex: 0 });

    const client = this.prisma.getClient();
    void client.channel
      .updateMany({
        where: { id: channelId, isConnected: false },
        data: { isConnected: true },
      })
      .catch(() => undefined);
  }

  private scheduleReconnect(channelId: string): void {
    const entry = this.connections.get(channelId);
    if (!entry || entry.reconnectTimer) return; // a reconnect is already scheduled

    const delay =
      ZALO_PERSONAL_RECONNECT_BACKOFF_MS[
        Math.min(entry.backoffIndex, ZALO_PERSONAL_RECONNECT_BACKOFF_MS.length - 1)
      ];
    entry.backoffIndex += 1;
    const timer = setTimeout(() => {
      if (entry.reconnectTimer === timer) entry.reconnectTimer = undefined;
      void this.attemptReconnect(channelId);
    }, delay);
    timer.unref?.();
    entry.reconnectTimer = timer;
  }

  private async attemptReconnect(channelId: string): Promise<void> {
    const entry = this.connections.get(channelId);
    if (!entry) return;

    const client = this.prisma.getClient();
    const channel = await client.channel.findUnique({ where: { id: channelId } });
    if (!channel || channel.channelType !== ChannelType.ZALO_PERSONAL || !channel.isConnected) {
      this.connections.delete(channelId);
      return;
    }

    try {
      await this.connectFromCredentials(channelId);
      this.logger.log(`Reconnected Zalo personal listener for channel '${channelId}'`);
    } catch (err) {
      this.logger.warn(
        `Zalo personal re-login failed for channel '${channelId}': ${(err as Error).message}`,
      );
      if (!entry.backoffIndex || entry.backoffIndex >= ZALO_PERSONAL_RECONNECT_BACKOFF_MS.length) {
        this.connections.delete(channelId);
        await this.markReauthorizationRequired(channelId, (err as Error).message);
        return;
      }
      this.scheduleReconnect(channelId);
    }
  }

  private async markReauthorizationRequired(channelId: string, detail: string): Promise<void> {
    try {
      const client = this.prisma.getClient();
      const channel = await client.channel.findFirst({ where: { id: channelId } });
      if (!channel) return;
      const settings = (channel.settings as Record<string, unknown>) || {};
      await client.channel.update({
        where: { workspaceId_id: { workspaceId: channel.workspaceId, id: channelId } },
        data: {
          isConnected: false,
          settings: {
            ...settings,
            reauthorizationRequired: true,
            lastSyncError: `SESSION_EXPIRED: ${detail}`,
            lastSyncAt: new Date().toISOString(),
          } as any,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to mark channel '${channelId}' reauthorization-required: ${(err as Error).message}`,
      );
    }
  }

  // ─── Channel lifecycle events ──────────────────────────────────────────────

  @OnEvent('channel.deleted')
  async handleChannelDeleted(payload: { channelId: string; channelType: string }): Promise<void> {
    if (payload.channelType !== ChannelType.ZALO_PERSONAL) return;
    const entry = this.connections.get(payload.channelId);
    if (!entry) return;
    if (entry.reconnectTimer) clearTimeout(entry.reconnectTimer);
    try {
      await entry.api.listener.stop();
    } catch {
      /* ignore */
    }
    this.connections.delete(payload.channelId);
    this.logger.log(`Stopped Zalo personal listener for deleted channel '${payload.channelId}'`);
  }

  @OnEvent('channel.updated')
  async handleChannelUpdated(payload: { channelId: string; channelType: string }): Promise<void> {
    if (payload.channelType !== ChannelType.ZALO_PERSONAL) return;
    const entry = this.connections.get(payload.channelId);
    if (!entry) return;

    const channel = await this.prisma.getClient().channel.findUnique({
      where: { id: payload.channelId },
      select: { isConnected: true },
    });
    if (channel && channel.isConnected === false) {
      // Deliberate disconnect — stop listening (validation would otherwise reconnect).
      if (entry.reconnectTimer) clearTimeout(entry.reconnectTimer);
      try {
        await entry.api.listener.stop();
      } catch {
        /* ignore */
      }
      this.connections.delete(payload.channelId);
      this.logger.log(
        `Stopped Zalo personal listener for disconnected channel '${payload.channelId}'`,
      );
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private requireSession(workspaceId: string, sessionId: string): PendingConnectSession {
    const session = this.pendingConnects.get(sessionId);
    if (!session || session.workspaceId !== workspaceId) {
      throw new BadRequestException({
        code: 'ZALO_PERSONAL_SESSION_NOT_FOUND',
        message: 'Phiên quét mã QR không tồn tại hoặc đã hết hạn. Vui lòng tạo phiên mới.',
      });
    }
    if (Date.now() > session.expiresAt) {
      session.status = 'expired';
      throw new BadRequestException({
        code: 'ZALO_PERSONAL_SESSION_EXPIRED',
        message: 'Phiên quét mã QR đã hết hạn. Vui lòng tạo phiên mới.',
      });
    }
    return session;
  }

  private handleLoginQREvent(session: PendingConnectSession, event: ZaloLoginQREventPayload): void {
    switch (event.type) {
      case 0: {
        // QRCodeGenerated — data.image is a base64 string from zca-js (without data URI prefix)
        session.status = 'qr_ready';
        const raw = (event as unknown as { data: { image: string } }).data?.image;
        session.qrImage = raw
          ? raw.startsWith('data:')
            ? raw
            : `data:image/png;base64,${raw}`
          : undefined;
        break;
      }
      case 1: // QRCodeExpired — auto retry keeps the session alive until TTL
        (event as unknown as { actions?: { retry?: () => unknown } }).actions?.retry?.();
        break;
      case 2: // QRCodeScanned
        session.status = 'scanned';
        session.profileName =
          (event as unknown as { data: { display_name: string } }).data?.display_name ??
          session.profileName;
        session.profileAvatar =
          (event as unknown as { data: { avatar: string } }).data?.avatar ?? session.profileAvatar;
        break;
      case 3: // QRCodeDeclined
        session.status = 'failed';
        session.error = 'DECLINED: bạn đã từ chối cấp quyền trên điện thoại';
        break;
      case 4: // GotLoginInfo
        session.credentials = (
          event as unknown as {
            data: { imei: string; cookie: unknown[]; userAgent: string };
          }
        ).data;
        break;
      default:
        break;
    }
  }

  private async resolveOwnId(session: PendingConnectSession): Promise<string | undefined> {
    if (session.ownId) return session.ownId;
    if (!session.api) return undefined;
    try {
      return String((await session.api.getOwnId()) ?? '') || undefined;
    } catch {
      return undefined;
    }
  }

  private async fetchProfile(
    api: ZaloApi,
    userId: string,
  ): Promise<{ name?: string; avatarUrl?: string } | null> {
    try {
      const response = await api.getUserInfo([userId]);
      const profile = response?.changed_profiles?.[userId];
      if (!profile || typeof profile !== 'object') return null;
      return {
        name:
          (typeof profile.displayName === 'string' && profile.displayName) ||
          (typeof profile.name === 'string' && profile.name) ||
          undefined,
        avatarUrl: typeof profile.avatar === 'string' ? profile.avatar : undefined,
      };
    } catch {
      return null;
    }
  }

  private disposePendingSession(session: PendingConnectSession): void {
    session.api = undefined;
    session.credentials = undefined;
  }
}
