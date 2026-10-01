import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import { ChannelType } from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import { ChannelCredentialService } from '../../../../infrastructure/crypto/channel-credential.service';
import {
  ZALO_DEFAULT_TOKEN_LIFETIME_S,
  ZALO_OAUTH_AUTHORIZE_URL,
  ZALO_OAUTH_SESSION_PREFIX,
  ZALO_OAUTH_SESSION_TTL_SECONDS,
  ZALO_OAUTH_STATE_PREFIX,
  ZALO_OAUTH_STATE_TTL_SECONDS,
} from './zalo.constants';
import { ZaloOaTokenService } from './zalo-oa-token.service';
import { ZaloOaAdapter } from './zalo.adapter';
import type { ConnectZaloOaDto } from './zalo-oa.dto';

interface ZaloOAuthStatePayload {
  workspaceId: string;
  clientOrigin?: string;
  returnUrl?: string;
  /** Set when the authorization is a re-authorize of an existing channel. */
  channelId?: string;
}

interface ZaloOAuthSessionPayload extends ZaloOAuthStatePayload {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  oaId: string;
  oaName: string;
  oaAvatar?: string;
}

/**
 * Handles Zalo OA OAuth provisioning: authorization URL generation, callback token
 * exchange, and the connect/reauthorize step that materializes Inbox + Channel.
 *
 * ZaloOaAdapter handles messaging (send/receive); this service sits above it.
 */
@Injectable()
export class ZaloOaService {
  private readonly logger = new Logger(ZaloOaService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly credentialService: ChannelCredentialService,
    private readonly tokenService: ZaloOaTokenService,
    private readonly adapter: ZaloOaAdapter,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Public per-channel webhook URL the owner must register in the OA Console
   * (Zalo has no API to register callbacks, unlike Telegram).
   */
  getWebhookUrl(channelId: string): string {
    const baseUrl = this.configService.get<string>('WEBHOOK_BASE_URL');
    return `${baseUrl}/api/v1/channels/${channelId}/webhook`;
  }

  /**
   * The redirect URI the OAuth authorize request carries — the operator must register
   * this exact value in the Zalo App console, otherwise Zalo rejects with -14003.
   */
  getConnectConfig(): { redirectUri: string } {
    return { redirectUri: this.getRedirectUri() };
  }

  private getRedirectUri(): string {
    const baseUrl = this.configService.get<string>('WEBHOOK_BASE_URL');
    return `${baseUrl}/api/v1/integrations/zalo/callback`;
  }

  // ─── OAuth flow ────────────────────────────────────────────────────────────

  /**
   * Generates the Zalo OA authorization URL with CSRF state protection (Redis, 10 min TTL).
   */
  async getAuthUrl(
    workspaceId: string,
    options: { clientOrigin?: string; returnUrl?: string; channelId?: string } = {},
  ): Promise<{ authUrl: string }> {
    const state = `${workspaceId}:${crypto.randomBytes(16).toString('hex')}`;
    await this.redis.set(
      `${ZALO_OAUTH_STATE_PREFIX}${state}`,
      JSON.stringify({ ...options, workspaceId }),
      ZALO_OAUTH_STATE_TTL_SECONDS,
    );

    const authUrl = new URL(ZALO_OAUTH_AUTHORIZE_URL);
    authUrl.searchParams.set('app_id', this.tokenService.getAppId());
    authUrl.searchParams.set('redirect_uri', this.getRedirectUri());
    authUrl.searchParams.set('state', state);

    return { authUrl: authUrl.toString() };
  }

  /**
   * Handles the OAuth callback: validates state, exchanges the code for tokens,
   * resolves the authorized OA, and parks everything in a short-lived Redis session
   * so tokens never transit the browser.
   */
  async handleCallback(
    code: string,
    state: string,
  ): Promise<{
    workspaceId: string;
    sessionId: string;
    oaId: string;
    oaName: string;
    isReauthorization: boolean;
    clientOrigin?: string;
    returnUrl?: string;
  }> {
    // 1. Validate CSRF state
    const storedState = await this.redis.get(`${ZALO_OAUTH_STATE_PREFIX}${state}`);
    if (!storedState) {
      throw new BadRequestException({
        code: 'INVALID_OAUTH_STATE',
        message: 'OAuth state token is invalid or expired. Please restart the connection process.',
      });
    }
    await this.redis.del(`${ZALO_OAUTH_STATE_PREFIX}${state}`);

    const statePayload = this.parseJson<ZaloOAuthStatePayload>(storedState);
    if (!statePayload?.workspaceId) {
      throw new BadRequestException({
        code: 'INVALID_OAUTH_STATE',
        message: 'OAuth state payload is corrupted. Please restart the connection process.',
      });
    }

    // 2. Exchange the authorization code for the token pair
    const tokens = await this.tokenService.exchangeCode(code);

    // 3. Resolve the authorized OA
    let oaInfo;
    try {
      oaInfo = await this.adapter.getOaInfo(tokens.access_token);
    } catch (err) {
      throw new BadRequestException({
        code: 'ZALO_OA_INFO_FAILED',
        message: `Không xác định được Official Account được ủy quyền: ${(err as Error).message}`,
      });
    }
    if (!oaInfo.providerAccountId) {
      throw new BadRequestException({
        code: 'ZALO_OA_INFO_FAILED',
        message: 'Không xác định được Official Account được ủy quyền. Vui lòng thử lại.',
      });
    }

    // 4. Park tokens in a Redis session (30 min TTL)
    const sessionId = crypto.randomBytes(16).toString('hex');
    const session: ZaloOAuthSessionPayload = {
      ...statePayload,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      accessTokenExpiresAt: new Date(
        Date.now() +
          (tokens.expires_in ?? tokens.expire_in ?? ZALO_DEFAULT_TOKEN_LIFETIME_S) * 1000,
      ).toISOString(),
      oaId: oaInfo.providerAccountId,
      oaName: oaInfo.name,
      oaAvatar: oaInfo.avatarUrl,
    };
    await this.redis.set(
      `${ZALO_OAUTH_SESSION_PREFIX}${sessionId}`,
      JSON.stringify(session),
      ZALO_OAUTH_SESSION_TTL_SECONDS,
    );

    return {
      workspaceId: statePayload.workspaceId,
      sessionId,
      oaId: session.oaId,
      oaName: session.oaName,
      isReauthorization: Boolean(statePayload.channelId),
      clientOrigin: statePayload.clientOrigin,
      returnUrl: statePayload.returnUrl,
    };
  }

  /**
   * Materializes the Inbox + Channel from an OAuth session (new connection),
   * or refreshes an existing channel's credentials (re-authorization).
   */
  async connect(
    workspaceId: string,
    dto: ConnectZaloOaDto,
  ): Promise<{ inboxId: string; channelId: string; oaId: string; oaName: string }> {
    const sessionRaw = await this.redis.get(`${ZALO_OAUTH_SESSION_PREFIX}${dto.sessionId}`);
    if (!sessionRaw) {
      throw new BadRequestException({
        code: 'SESSION_EXPIRED',
        message: 'Phiên ủy quyền Zalo đã hết hạn. Vui lòng kết nối lại.',
      });
    }
    await this.redis.del(`${ZALO_OAUTH_SESSION_PREFIX}${dto.sessionId}`);

    const session = this.parseJson<ZaloOAuthSessionPayload>(sessionRaw);
    if (!session || session.workspaceId !== workspaceId) {
      throw new BadRequestException({
        code: 'WORKSPACE_MISMATCH',
        message: 'Phiên ủy quyền Zalo không hợp lệ hoặc không thuộc workspace hiện tại.',
      });
    }

    if (session.channelId) {
      return this.reauthorizeChannel(session, dto);
    }
    return this.connectNewChannel(session, dto);
  }

  /**
   * Returns the authorized OA info for an OAuth session (used by the connect UI),
   * validating that the session belongs to the requesting workspace.
   */
  async getSessionInfo(
    workspaceId: string,
    sessionId: string,
  ): Promise<{ oaId: string; oaName: string; oaAvatar?: string }> {
    const sessionRaw = await this.redis.get(`${ZALO_OAUTH_SESSION_PREFIX}${sessionId}`);
    if (!sessionRaw) {
      throw new BadRequestException({
        code: 'SESSION_EXPIRED',
        message: 'Phiên ủy quyền Zalo đã hết hạn. Vui lòng kết nối lại.',
      });
    }
    const session = this.parseJson<ZaloOAuthSessionPayload>(sessionRaw);
    if (!session || session.workspaceId !== workspaceId) {
      throw new BadRequestException({
        code: 'WORKSPACE_MISMATCH',
        message: 'Phiên ủy quyền Zalo không thuộc workspace hiện tại.',
      });
    }
    return { oaId: session.oaId, oaName: session.oaName, oaAvatar: session.oaAvatar };
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private async connectNewChannel(
    session: ZaloOAuthSessionPayload,
    dto: ConnectZaloOaDto,
  ): Promise<{ inboxId: string; channelId: string; oaId: string; oaName: string }> {
    const client = this.prisma.getClient();

    if (!dto.oaSecretKey) {
      throw new BadRequestException({
        code: 'OA_SECRET_KEY_REQUIRED',
        message: 'OA Secret Key là bắt buộc để xác thực webhook từ Zalo.',
      });
    }

    // Cross-tenant collision: one OA can only feed one channel in the whole system
    // (same invariant as Facebook pages, TASK-3A-10).
    const existing = await client.channel.findFirst({
      where: { channelType: ChannelType.ZALO, providerAccountId: session.oaId },
    });
    if (existing) {
      throw new BadRequestException({
        code: 'ZALO_OA_ALREADY_CONNECTED',
        message: `Official Account "${session.oaName}" đã được kết nối trong hệ thống.`,
      });
    }

    const credentials = {
      appId: this.tokenService.getAppId(),
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      accessTokenExpiresAt: session.accessTokenExpiresAt,
      oaSecretKey: dto.oaSecretKey,
      oaId: session.oaId,
    };
    const encrypted = this.credentialService.encrypt(credentials);

    let memberUserIds = dto.memberUserIds;
    if ((!memberUserIds || memberUserIds.length === 0) && dto.assignAllMembers !== false) {
      const workspaceMembers = await client.workspaceMember.findMany({
        where: { workspaceId: session.workspaceId },
        select: { userId: true },
      });
      memberUserIds = workspaceMembers.map(m => m.userId);
    }

    const result = await this.prisma.runInTransaction(async txCtx => {
      const tx = txCtx.tx;

      const inbox = await tx.inbox.create({
        data: {
          workspaceId: session.workspaceId,
          name: session.oaName,
          avatarUrl: session.oaAvatar,
        },
      });

      const channel = await tx.channel.create({
        data: {
          workspaceId: session.workspaceId,
          inboxId: inbox.id,
          channelType: ChannelType.ZALO,
          providerAccountId: session.oaId,
          credentials: { encrypted } as any,
          settings: {} as any,
          isConnected: false,
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

    // channel.created → ZaloLifecycleService validates the OA and syncs metadata.
    await this.emitLifecycleEvent('channel.created', session.workspaceId, result);

    this.logger.log(
      `Connected Zalo OA '${session.oaName}' (${session.oaId}) to workspace '${session.workspaceId}'`,
    );

    return { ...result, oaId: session.oaId, oaName: session.oaName };
  }

  private async reauthorizeChannel(
    session: ZaloOAuthSessionPayload,
    dto: ConnectZaloOaDto,
  ): Promise<{ inboxId: string; channelId: string; oaId: string; oaName: string }> {
    const client = this.prisma.getClient();

    const channel = await client.channel.findFirst({
      where: {
        id: session.channelId,
        workspaceId: session.workspaceId,
        channelType: ChannelType.ZALO,
      },
    });
    if (!channel) {
      throw new NotFoundException({
        code: 'CHANNEL_NOT_FOUND',
        message: `Zalo channel '${session.channelId}' not found in this workspace`,
      });
    }

    // OA-id guard: the re-authorization must grant the SAME OA as originally connected.
    if (channel.providerAccountId && channel.providerAccountId !== session.oaId) {
      throw new BadRequestException({
        code: 'ZALO_OA_MISMATCH',
        message: `OA được ủy quyền (${session.oaId}) khác với OA đang kết nối (${channel.providerAccountId}). Vui lòng ủy quyền đúng Official Account.`,
      });
    }

    const current = this.credentialService.decryptChannelCredentials(channel.credentials);
    const merged = {
      ...current,
      appId: this.tokenService.getAppId(),
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      accessTokenExpiresAt: session.accessTokenExpiresAt,
      oaSecretKey: dto.oaSecretKey || current.oaSecretKey,
      oaId: session.oaId,
    };
    const encrypted = this.credentialService.encrypt(merged);

    const settings = (channel.settings as Record<string, unknown>) || {};
    await client.channel.update({
      where: { workspaceId_id: { workspaceId: session.workspaceId, id: channel.id } },
      data: {
        credentials: { encrypted } as any,
        isConnected: true,
        settings: {
          ...settings,
          reauthorizationRequired: false,
          lastSyncError: null,
          lastReauthorizedAt: new Date().toISOString(),
        } as any,
      },
    });

    await this.emitLifecycleEvent('channel.updated', session.workspaceId, {
      inboxId: channel.inboxId,
      channelId: channel.id,
    });

    this.logger.log(`Re-authorized Zalo channel '${channel.id}'`);

    return {
      inboxId: channel.inboxId,
      channelId: channel.id,
      oaId: session.oaId,
      oaName: session.oaName,
    };
  }

  private async emitLifecycleEvent(
    eventName: 'channel.created' | 'channel.updated',
    workspaceId: string,
    ids: { inboxId: string; channelId: string },
  ): Promise<void> {
    const payload = {
      workspaceId,
      inboxId: ids.inboxId,
      channelId: ids.channelId,
      channelType: ChannelType.ZALO,
    };
    if (this.eventEmitter.emitAsync) {
      await this.eventEmitter.emitAsync(eventName, payload);
    } else {
      this.eventEmitter.emit(eventName, payload);
    }
  }

  private parseJson<T>(raw: string): T | null {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
}
