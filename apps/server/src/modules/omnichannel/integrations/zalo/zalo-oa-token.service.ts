import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChannelCredentialService } from '../../../../infrastructure/crypto/channel-credential.service';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import {
  ZALO_DEFAULT_TOKEN_LIFETIME_S,
  ZALO_OAUTH_TOKEN_URL,
  ZALO_SECRET_KEY_HEADER,
  ZALO_TOKEN_REFRESH_MARGIN_MS,
} from './zalo.constants';
import type { ZaloTokenResponse } from './zalo.types';
import type { ChannelContext } from '../channel-adapter.types';

/**
 * Definitive OAuth rejection (revoked/expired refresh token) — the channel must be
 * re-authorized manually. Distinguished from retryable failures (network, 5xx).
 */
class TokenRefreshAuthError extends Error {
  constructor(readonly detail: string) {
    super(`Zalo OAuth refresh rejected: ${detail}`);
  }
}

/**
 * Manages the Zalo OA OAuth token lifecycle:
 * - exchanges an authorization code for the initial token pair (OAuth callback), and
 * - keeps per-channel access tokens valid, automatically refreshing and persisting
 *   the ROTATED token pair into the channel's encrypted credentials.
 *
 * Zalo refresh tokens are single-use and rotate on every refresh, so persistence is
 * mandatory — losing the rotated refresh token permanently breaks the channel.
 */
@Injectable()
export class ZaloOaTokenService {
  private readonly logger = new Logger(ZaloOaTokenService.name);

  /** Single-flight per channel so concurrent sends share one refresh + rotation. */
  private readonly inFlightRefreshes = new Map<string, Promise<string>>();

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly credentialService: ChannelCredentialService,
  ) {}

  // ─── Platform app config ───────────────────────────────────────────────────

  getAppId(): string {
    const appId = this.configService.get<string>('ZALO_APP_ID');
    if (!appId) {
      throw new InternalServerErrorException({
        code: 'ZALO_APP_NOT_CONFIGURED',
        message: 'Zalo App ID is not configured. Set ZALO_APP_ID in environment variables.',
      });
    }
    return appId;
  }

  getAppSecret(): string {
    const appSecret = this.configService.get<string>('ZALO_APP_SECRET');
    if (!appSecret) {
      throw new InternalServerErrorException({
        code: 'ZALO_APP_NOT_CONFIGURED',
        message: 'Zalo App Secret is not configured. Set ZALO_APP_SECRET in environment variables.',
      });
    }
    return appSecret;
  }

  isPlatformConfigured(): boolean {
    return Boolean(
      this.configService.get<string>('ZALO_APP_ID') &&
      this.configService.get<string>('ZALO_APP_SECRET'),
    );
  }

  // ─── Token exchange ────────────────────────────────────────────────────────

  /**
   * Exchanges an OAuth authorization code for the initial access/refresh token pair.
   * The app secret is sent in the `secret_key` header (per Zalo OAuth v4 docs);
   * PKCE `code_verifier` is not used since no code_challenge is set at authorize time.
   */
  async exchangeCode(code: string): Promise<ZaloTokenResponse> {
    const response = await fetch(ZALO_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: this.buildTokenHeaders(),
      body: new URLSearchParams({
        app_id: this.getAppId(),
        grant_type: 'authorization_code',
        code,
      }).toString(),
    });

    const data = (await response.json().catch(() => ({}))) as ZaloTokenResponse;

    if (!response.ok || !data.access_token) {
      const detail = data.message || response.statusText || 'unknown error';
      this.logger.error(`Zalo OAuth code exchange failed: ${detail}`);
      throw new InternalServerErrorException({
        code: 'ZALO_TOKEN_EXCHANGE_FAILED',
        message: `Zalo token exchange failed: ${detail}`,
      });
    }

    return data;
  }

  /**
   * Returns a valid OA access token for the channel, refreshing and persisting the
   * rotated pair when the cached one is expired or within the refresh margin.
   */
  async getValidAccessToken(channel: ChannelContext): Promise<string> {
    const cachedToken = this.getCachedValidToken(channel.credentials);
    if (cachedToken) {
      return cachedToken;
    }

    const inFlight = this.inFlightRefreshes.get(channel.channelId);
    if (inFlight) {
      return inFlight;
    }

    const refreshPromise = this.refreshAndRotate(channel).finally(() =>
      this.inFlightRefreshes.delete(channel.channelId),
    );
    this.inFlightRefreshes.set(channel.channelId, refreshPromise);
    return refreshPromise;
  }

  /**
   * Forces a refresh + rotation, bypassing the cached token (e.g. after the provider
   * rejected a token that still looked unexpired).
   */
  async forceRefresh(channel: ChannelContext): Promise<string> {
    const inFlight = this.inFlightRefreshes.get(channel.channelId);
    if (inFlight) {
      return inFlight;
    }
    const refreshPromise = this.refreshAndRotate(channel).finally(() =>
      this.inFlightRefreshes.delete(channel.channelId),
    );
    this.inFlightRefreshes.set(channel.channelId, refreshPromise);
    return refreshPromise;
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private getCachedValidToken(credentials: Record<string, unknown>): string | null {
    const { accessToken, accessTokenExpiresAt } = credentials;
    if (
      typeof accessToken !== 'string' ||
      !accessToken ||
      typeof accessTokenExpiresAt !== 'string'
    ) {
      return null;
    }
    const expiryMs = Date.parse(accessTokenExpiresAt);
    if (Number.isNaN(expiryMs)) {
      return null;
    }
    // Refresh eagerly inside the margin so tokens never go stale mid-send.
    if (expiryMs - Date.now() <= ZALO_TOKEN_REFRESH_MARGIN_MS) {
      return null;
    }
    return accessToken;
  }

  /**
   * Token endpoint auth: app secret travels in the `secret_key` header (Zalo OAuth v4 docs).
   */
  private buildTokenHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/x-www-form-urlencoded',
      [ZALO_SECRET_KEY_HEADER]: this.getAppSecret(),
    };
  }

  private async refreshAndRotate(channel: ChannelContext): Promise<string> {
    const credentials = channel.credentials;
    const refreshToken = credentials.refreshToken;

    if (typeof refreshToken !== 'string' || !refreshToken) {
      // Credentials may have been rotated by another worker since this context was built.
      const fresh = await this.loadChannelCredentials(channel);
      const freshToken = fresh.refreshToken;
      if (typeof freshToken === 'string' && freshToken) {
        try {
          return await this.exchangeRefreshToken(channel, fresh, freshToken);
        } catch (err) {
          throw this.wrapRefreshFailure(channel.channelId, err);
        }
      }
      throw this.deadRefreshTokenError(channel.channelId, 'MISSING_REFRESH_TOKEN');
    }

    try {
      return await this.exchangeRefreshToken(channel, credentials, refreshToken);
    } catch (firstErr) {
      // Refresh tokens are single-use: another worker may have already consumed ours
      // after this channel context was loaded. Re-read once and retry with the
      // freshest pair before declaring the channel dead.
      const fresh = await this.loadChannelCredentials(channel);
      const freshToken = fresh.refreshToken;
      if (typeof freshToken === 'string' && freshToken && freshToken !== refreshToken) {
        try {
          return await this.exchangeRefreshToken(channel, fresh, freshToken);
        } catch (err) {
          throw this.wrapRefreshFailure(channel.channelId, err);
        }
      }
      throw this.wrapRefreshFailure(channel.channelId, firstErr);
    }
  }

  private wrapRefreshFailure(channelId: string, err: unknown): Error {
    if (err instanceof TokenRefreshAuthError) {
      return this.deadRefreshTokenError(channelId, err.detail);
    }
    return err instanceof Error ? err : new Error(String(err));
  }

  private async exchangeRefreshToken(
    channel: ChannelContext,
    credentials: Record<string, unknown>,
    refreshToken: string,
  ): Promise<string> {
    let response: Response;
    let data: ZaloTokenResponse;
    try {
      response = await fetch(ZALO_OAUTH_TOKEN_URL, {
        method: 'POST',
        headers: this.buildTokenHeaders(),
        body: new URLSearchParams({
          app_id: this.getAppId(),
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }).toString(),
      });
      data = (await response.json().catch(() => ({}))) as ZaloTokenResponse;
    } catch (err) {
      throw new Error(`ZALO_TOKEN_REFRESH_RETRYABLE: ${(err as Error).message}`, {
        cause: err,
      });
    }

    if (response.ok && data.access_token) {
      await this.persistRotatedCredentials(channel, data);
      return data.access_token;
    }

    const detail = data.message || `HTTP ${response.status}`;
    if (data.error !== undefined || response.status === 400 || response.status === 401) {
      throw new TokenRefreshAuthError(detail);
    }
    throw new Error(`ZALO_TOKEN_REFRESH_RETRYABLE: ${detail}`);
  }

  /**
   * Persists the rotated token pair into the channel's encrypted credentials,
   * merging over the latest DB row to avoid clobbering concurrent changes.
   */
  private async persistRotatedCredentials(
    channel: ChannelContext,
    tokens: ZaloTokenResponse,
  ): Promise<void> {
    const client = this.prisma.getClient();
    const row = await client.channel.findFirst({
      where: { id: channel.channelId, workspaceId: channel.workspaceId },
    });
    if (!row) {
      // Channel deleted concurrently — nothing to persist.
      return;
    }

    const current = this.credentialService.decryptChannelCredentials(row.credentials);
    const merged = {
      ...current,
      appId: current.appId ?? this.getAppId(),
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      accessTokenExpiresAt: new Date(
        Date.now() +
          (tokens.expires_in ?? tokens.expire_in ?? ZALO_DEFAULT_TOKEN_LIFETIME_S) * 1000,
      ).toISOString(),
    };
    const encrypted = this.credentialService.encrypt(merged);

    await client.channel.update({
      where: { workspaceId_id: { workspaceId: channel.workspaceId, id: channel.channelId } },
      data: { credentials: { encrypted } as any },
    });

    this.logger.log(
      `Rotated Zalo OA access token for channel '${channel.channelId}' (expires in ${tokens.expires_in}s)`,
    );
  }

  /**
   * Marks the channel as needing manual re-authorization and throws a descriptive error.
   */
  private deadRefreshTokenError(channelId: string, detail: string): InternalServerErrorException {
    this.logger.error(
      `Zalo refresh token for channel '${channelId}' is dead (${detail}). Re-authorization required.`,
    );
    this.markReauthorizationRequired(channelId, detail);
    return new InternalServerErrorException({
      code: 'ZALO_TOKEN_REFRESH_FAILED',
      message: `Zalo OA token refresh failed (${detail}). Vui lòng ủy quyền lại kênh Zalo (Reauthorize).`,
    });
  }

  private async markReauthorizationRequired(channelId: string, detail: string): Promise<void> {
    try {
      const client = this.prisma.getClient();
      const row = await client.channel.findFirst({ where: { id: channelId } });
      if (!row) return;

      const settings = (row.settings as Record<string, unknown>) || {};
      await client.channel.update({
        where: { workspaceId_id: { workspaceId: row.workspaceId, id: channelId } },
        data: {
          isConnected: false,
          settings: {
            ...settings,
            reauthorizationRequired: true,
            lastSyncError: `REFRESH_TOKEN_EXPIRED: ${detail}`,
            lastSyncAt: new Date().toISOString(),
          } as any,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to mark channel '${channelId}' as reauthorization-required: ${(err as Error).message}`,
      );
    }
  }

  private async loadChannelCredentials(
    channel: Pick<ChannelContext, 'channelId' | 'workspaceId'>,
  ): Promise<Record<string, unknown>> {
    const client = this.prisma.getClient();
    const row = await client.channel.findFirst({
      where: { id: channel.channelId, workspaceId: channel.workspaceId },
    });
    return row ? this.credentialService.decryptChannelCredentials(row.credentials) : {};
  }
}
