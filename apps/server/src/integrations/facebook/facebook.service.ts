import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import { ChannelType } from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database';
import { RedisService } from '../../infrastructure/redis';
import { ChannelCredentialService } from '../../modules/inboxes/channel-credential.service';
import { FacebookAdapter } from './facebook.adapter';
import type {
  ConnectFacebookPageDto,
  ConnectFacebookPagesBatchDto,
  FacebookPageInfo,
} from './facebook.dto';

const FB_DIALOG_BASE = 'https://www.facebook.com';
const GRAPH_API_BASE = 'https://graph.facebook.com';
const GRAPH_API_VERSION = 'v26.0';
const OAUTH_STATE_TTL_SECONDS = 600; // 10 minutes
const OAUTH_STATE_PREFIX = 'fb_oauth_state:';
const USER_TOKEN_PREFIX = 'fb_user_token:';
const USER_TOKEN_TTL_SECONDS = 1800; // 30 minutes

/**
 * Handles Facebook OAuth provisioning, Page discovery, and Channel connection lifecycle.
 *
 * This is the provisioning/authentication layer that sits above FacebookAdapter.
 * FacebookAdapter handles messaging (send/receive); this service handles OAuth,
 * token exchange, page listing, and connect/disconnect operations.
 *
 * Reference: Chatwoot callbacks_controller.rb (register_facebook_page, facebook_pages, reauthorize_page)
 */
@Injectable()
export class FacebookService {
  private readonly logger = new Logger(FacebookService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly credentialService: ChannelCredentialService,
    private readonly adapter: FacebookAdapter,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private getAppId(): string {
    const appId = this.configService.get<string>('FB_APP_ID');
    if (!appId) {
      throw new InternalServerErrorException({
        code: 'FB_APP_NOT_CONFIGURED',
        message: 'Facebook App ID is not configured. Set FB_APP_ID in environment variables.',
      });
    }
    return appId;
  }

  private getAppSecret(): string {
    const appSecret = this.configService.get<string>('FB_APP_SECRET');
    if (!appSecret) {
      throw new InternalServerErrorException({
        code: 'FB_APP_NOT_CONFIGURED',
        message:
          'Facebook App Secret is not configured. Set FB_APP_SECRET in environment variables.',
      });
    }
    return appSecret;
  }

  private getRedirectUri(): string {
    const baseUrl = this.configService.get<string>('WEBHOOK_BASE_URL') || 'http://localhost:8000';
    return `${baseUrl.replace(/\/+$/, '')}/api/v1/integrations/facebook/callback`;
  }

  // ─── OAuth Flow ─────────────────────────────────────────────────────────────

  /**
   * Generates a Facebook OAuth authorization URL with CSRF state protection.
   *
   * The state token is stored in Redis (10 min TTL) and verified in the callback.
   */
  async getAuthUrl(
    workspaceId: string,
    clientOrigin?: string,
    returnUrl?: string,
  ): Promise<{ authUrl: string }> {
    const appId = this.getAppId();
    const redirectUri = this.getRedirectUri();

    // Generate and store CSRF state token with optional clientOrigin and returnUrl
    const state = `${workspaceId}:${crypto.randomBytes(16).toString('hex')}`;
    await this.redis.set(
      `${OAUTH_STATE_PREFIX}${state}`,
      JSON.stringify({ workspaceId, clientOrigin, returnUrl }),
      OAUTH_STATE_TTL_SECONDS,
    );

    const scopes = ['pages_show_list', 'pages_messaging', 'pages_manage_metadata'].join(',');

    const authUrl = new URL(`${FB_DIALOG_BASE}/${GRAPH_API_VERSION}/dialog/oauth`);
    authUrl.searchParams.set('client_id', appId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('response_type', 'code');

    return { authUrl: authUrl.toString() };
  }

  /**
   * Handles the OAuth callback from Meta: validates CSRF state, exchanges the authorization
   * code for a long-lived user access token, and stores it temporarily in Redis.
   *
   * Reference: Chatwoot long_lived_token() using Koala::Facebook::OAuth.exchange_access_token_info
   */
  async handleCallback(
    code: string,
    state: string,
  ): Promise<{
    workspaceId: string;
    sessionId: string;
    clientOrigin?: string;
    returnUrl?: string;
  }> {
    // 1. Validate CSRF state
    const storedStateData = await this.redis.get(`${OAUTH_STATE_PREFIX}${state}`);
    if (!storedStateData) {
      throw new BadRequestException({
        code: 'INVALID_OAUTH_STATE',
        message: 'OAuth state token is invalid or expired. Please restart the connection process.',
      });
    }
    await this.redis.del(`${OAUTH_STATE_PREFIX}${state}`);

    let storedWorkspaceId = storedStateData;
    let clientOrigin: string | undefined;
    let returnUrl: string | undefined;

    try {
      const parsed = JSON.parse(storedStateData);
      if (parsed && typeof parsed === 'object' && parsed.workspaceId) {
        storedWorkspaceId = parsed.workspaceId;
        clientOrigin = parsed.clientOrigin;
        returnUrl = parsed.returnUrl;
      }
    } catch {
      // backward compatibility if stored as plain string
    }

    // 2. Exchange authorization code for short-lived user token
    const appId = this.getAppId();
    const appSecret = this.getAppSecret();
    const redirectUri = this.getRedirectUri();

    const tokenUrl = new URL(`${GRAPH_API_BASE}/${GRAPH_API_VERSION}/oauth/access_token`);
    tokenUrl.searchParams.set('client_id', appId);
    tokenUrl.searchParams.set('client_secret', appSecret);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('code', code);

    const tokenResponse = await fetch(tokenUrl.toString());
    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
      error?: { message: string };
    };

    if (!tokenResponse.ok || !tokenData.access_token) {
      const errorMsg = tokenData.error?.message || 'Failed to exchange authorization code';
      this.logger.error(`Facebook OAuth token exchange failed: ${errorMsg}`);
      throw new BadRequestException({
        code: 'FB_TOKEN_EXCHANGE_FAILED',
        message: errorMsg,
      });
    }

    // 3. Exchange short-lived token for long-lived token
    const longLivedUrl = new URL(`${GRAPH_API_BASE}/${GRAPH_API_VERSION}/oauth/access_token`);
    longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longLivedUrl.searchParams.set('client_id', appId);
    longLivedUrl.searchParams.set('client_secret', appSecret);
    longLivedUrl.searchParams.set('fb_exchange_token', tokenData.access_token);

    const longLivedResponse = await fetch(longLivedUrl.toString());
    const longLivedData = (await longLivedResponse.json()) as {
      access_token?: string;
      error?: { message: string };
    };

    const userAccessToken = longLivedData.access_token || tokenData.access_token;

    // 4. Store user token temporarily in Redis for page discovery
    const sessionId = crypto.randomBytes(16).toString('hex');
    await this.redis.set(
      `${USER_TOKEN_PREFIX}${sessionId}`,
      JSON.stringify({ userAccessToken, workspaceId: storedWorkspaceId }),
      USER_TOKEN_TTL_SECONDS,
    );

    return { workspaceId: storedWorkspaceId, sessionId, clientOrigin, returnUrl };
  }

  /**
   * Discovers Facebook Pages the user has admin access to.
   * Marks pages that are already connected in the current workspace.
   *
   * Reference: Chatwoot callbacks_controller.rb#facebook_pages + mark_already_existing_facebook_pages
   */
  async discoverPages(workspaceId: string, sessionId: string): Promise<FacebookPageInfo[]> {
    // 1. Retrieve user token from Redis
    const sessionData = await this.redis.get(`${USER_TOKEN_PREFIX}${sessionId}`);
    if (!sessionData) {
      throw new BadRequestException({
        code: 'SESSION_EXPIRED',
        message: 'OAuth session has expired. Please restart the Facebook connection process.',
      });
    }

    const { userAccessToken } = JSON.parse(sessionData) as {
      userAccessToken: string;
      workspaceId: string;
    };

    // 2. Fetch all pages the user manages (with pagination)
    const pages: FacebookPageInfo[] = [];
    let nextUrl: string | null =
      `${GRAPH_API_BASE}/${GRAPH_API_VERSION}/me/accounts?fields=id,name,picture.type(large),category,access_token&access_token=${encodeURIComponent(userAccessToken)}`;

    const pageTokensMap: Record<string, { accessToken: string; name: string; avatarUrl?: string }> =
      {};

    while (nextUrl) {
      const response = await fetch(nextUrl);
      const data = (await response.json()) as {
        data?: Array<{
          id: string;
          name: string;
          picture?: { data?: { url?: string } };
          category?: string;
          access_token?: string;
        }>;
        paging?: { next?: string };
        error?: { message: string };
      };

      if (!response.ok || data.error) {
        throw new BadRequestException({
          code: 'FB_PAGES_FETCH_FAILED',
          message: data.error?.message || 'Failed to fetch Facebook Pages',
        });
      }

      if (data.data) {
        for (const page of data.data) {
          if (page.access_token) {
            pageTokensMap[page.id] = {
              accessToken: page.access_token,
              name: page.name,
              avatarUrl: page.picture?.data?.url,
            };
          }
          pages.push({
            pageId: page.id,
            pageName: page.name,
            avatarUrl: page.picture?.data?.url,
            category: page.category,
            isAlreadyConnected: false, // will be resolved below
          });
        }
      }

      nextUrl = data.paging?.next || null;
    }

    // Update Redis session with cached page tokens
    await this.redis.set(
      `${USER_TOKEN_PREFIX}${sessionId}`,
      JSON.stringify({
        userAccessToken,
        workspaceId,
        pages: pageTokensMap,
      }),
      USER_TOKEN_TTL_SECONDS,
    );

    // 3. Check which pages are already connected in this workspace
    const client = this.prisma.getClient();
    const existingChannels = await client.channel.findMany({
      where: {
        workspaceId,
        channelType: 'FACEBOOK_MESSENGER',
        providerAccountId: { in: pages.map(p => p.pageId) },
      },
      select: { providerAccountId: true },
    });

    const connectedPageIds = new Set(existingChannels.map(c => c.providerAccountId));
    for (const page of pages) {
      page.isAlreadyConnected = connectedPageIds.has(page.pageId);
    }

    return pages;
  }

  /**
   * Connects a selected Facebook Page: creates Inbox + Channel with encrypted credentials,
   * and triggers webhook subscription via channel.created event.
   *
   * Reference: Chatwoot callbacks_controller.rb#register_facebook_page
   */
  async connectPage(
    workspaceId: string,
    dto: ConnectFacebookPageDto,
    sessionId?: string,
  ): Promise<{ inboxId: string; channelId: string }> {
    const client = this.prisma.getClient();

    // 1. Resolve tokens from Redis session if not supplied in DTO
    let pageAccessToken = dto.pageAccessToken;
    let userAccessToken = dto.userAccessToken;

    if (sessionId) {
      const sessionData = await this.redis.get(`${USER_TOKEN_PREFIX}${sessionId}`);
      if (sessionData) {
        try {
          const parsed = JSON.parse(sessionData) as {
            userAccessToken?: string;
            pages?: Record<string, { accessToken: string; name: string }>;
          };
          if (!userAccessToken && parsed.userAccessToken) {
            userAccessToken = parsed.userAccessToken;
          }
          if (!pageAccessToken && parsed.pages?.[dto.pageId]?.accessToken) {
            pageAccessToken = parsed.pages[dto.pageId].accessToken;
          }
        } catch {
          // ignore parse error
        }
      }
    }

    if (!pageAccessToken || !userAccessToken) {
      throw new BadRequestException({
        code: 'MISSING_CREDENTIALS',
        message:
          'Both pageAccessToken and userAccessToken are required to connect a Facebook Page.',
      });
    }

    // 2. Check if this page is already connected in the workspace
    const existingChannel = await client.channel.findFirst({
      where: {
        workspaceId,
        channelType: 'FACEBOOK_MESSENGER',
        providerAccountId: dto.pageId,
      },
    });

    if (existingChannel) {
      throw new ConflictException({
        code: 'FACEBOOK_PAGE_ALREADY_CONNECTED',
        message: `Facebook Page '${dto.pageName}' is already connected in this workspace`,
        details: { pageId: dto.pageId },
      });
    }

    // 3. Encrypt credentials
    const credentials = {
      pageAccessToken,
      userAccessToken,
      appSecret: this.configService.get<string>('FB_APP_SECRET') || '',
    };
    const encryptedString = this.credentialService.encrypt(credentials);

    // 4. Create Inbox + Channel (+ InboxMembers) in a transaction
    const inboxName = dto.inboxName || dto.pageName;

    const result = await this.prisma.runInTransaction(async txCtx => {
      const tx = txCtx.tx;

      const inbox = await tx.inbox.create({
        data: {
          workspaceId,
          name: inboxName,
        },
      });

      const channel = await tx.channel.create({
        data: {
          workspaceId,
          inboxId: inbox.id,
          channelType: 'FACEBOOK_MESSENGER',
          providerAccountId: dto.pageId,
          credentials: { encrypted: encryptedString } as any,
          settings: {} as any,
          isConnected: false, // Will be set to true after webhook subscription succeeds
        },
      });

      if (dto.memberUserIds && dto.memberUserIds.length > 0) {
        await tx.inboxMember.createMany({
          data: dto.memberUserIds.map(userId => ({
            inboxId: inbox.id,
            userId,
          })),
          skipDuplicates: true,
        });
      }

      return { inboxId: inbox.id, channelId: channel.id };
    });

    // 4. Emit channel.created event → FacebookLifecycleService will auto-subscribe webhook
    this.eventEmitter.emit('channel.created', {
      workspaceId,
      inboxId: result.inboxId,
      channelId: result.channelId,
      channelType: ChannelType.FACEBOOK_MESSENGER,
    });

    // 5. Set inbox avatar from Page picture
    const avatarUrl = `https://graph.facebook.com/${dto.pageId}/picture?type=large`;
    await client.inbox.update({
      where: { id: result.inboxId },
      data: { avatarUrl },
    });

    // 6. Cleanup session
    if (sessionId) {
      await this.redis.del(`${USER_TOKEN_PREFIX}${sessionId}`);
    }

    this.logger.log(
      `Connected Facebook Page '${dto.pageName}' (${dto.pageId}) to workspace '${workspaceId}'`,
    );

    return result;
  }

  /**
   * Connects multiple selected Facebook Pages in batch:
   * Creates Inbox + Channel with encrypted credentials for each page,
   * assigns workspace members, and triggers webhook subscription.
   */
  async connectPagesBatch(
    workspaceId: string,
    dto: ConnectFacebookPagesBatchDto,
  ): Promise<{
    inboxes: Array<{ inboxId: string; channelId: string; pageId: string; pageName: string }>;
  }> {
    const client = this.prisma.getClient();

    // 1. Retrieve user tokens and cached page tokens from Redis
    const sessionData = await this.redis.get(`${USER_TOKEN_PREFIX}${dto.sessionId}`);
    if (!sessionData) {
      throw new BadRequestException({
        code: 'SESSION_EXPIRED',
        message: 'OAuth session has expired. Please restart the Facebook connection process.',
      });
    }

    const parsed = JSON.parse(sessionData) as {
      userAccessToken?: string;
      pages?: Record<string, { accessToken: string; name: string; avatarUrl?: string }>;
    };

    const userAccessToken = parsed.userAccessToken;
    const pagesMap = parsed.pages || {};

    if (!userAccessToken) {
      throw new BadRequestException({
        code: 'MISSING_CREDENTIALS',
        message: 'User access token not found in OAuth session.',
      });
    }

    // 2. Resolve member user IDs
    let memberUserIds = dto.memberUserIds;
    if ((!memberUserIds || memberUserIds.length === 0) && dto.assignAllMembers !== false) {
      const workspaceMembers = await client.workspaceMember.findMany({
        where: { workspaceId },
        select: { userId: true },
      });
      memberUserIds = workspaceMembers.map(m => m.userId);
    }

    const appSecret = this.configService.get<string>('FB_APP_SECRET') || '';
    const createdList: Array<{
      inboxId: string;
      channelId: string;
      pageId: string;
      pageName: string;
    }> = [];

    // 3. Connect each selected page
    for (const pageId of dto.pageIds) {
      const pageInfo = pagesMap[pageId];
      if (!pageInfo || !pageInfo.accessToken) {
        this.logger.warn(`Skipping Facebook page ${pageId}: No access token found in session.`);
        continue;
      }

      // Check if page is already connected in this workspace
      const existing = await client.channel.findFirst({
        where: {
          workspaceId,
          channelType: 'FACEBOOK_MESSENGER',
          providerAccountId: pageId,
        },
      });

      if (existing) {
        this.logger.warn(
          `Facebook Page '${pageInfo.name}' (${pageId}) is already connected. Skipping.`,
        );
        continue;
      }

      const credentials = {
        pageAccessToken: pageInfo.accessToken,
        userAccessToken,
        appSecret,
      };
      const encryptedString = this.credentialService.encrypt(credentials);
      const avatarUrl =
        pageInfo.avatarUrl || `https://graph.facebook.com/${pageId}/picture?type=large`;

      const result = await this.prisma.runInTransaction(async txCtx => {
        const tx = txCtx.tx;

        const inbox = await tx.inbox.create({
          data: {
            workspaceId,
            name: pageInfo.name,
            avatarUrl,
          },
        });

        const channel = await tx.channel.create({
          data: {
            workspaceId,
            inboxId: inbox.id,
            channelType: 'FACEBOOK_MESSENGER',
            providerAccountId: pageId,
            credentials: { encrypted: encryptedString } as any,
            settings: {} as any,
            isConnected: false,
          },
        });

        if (memberUserIds && memberUserIds.length > 0) {
          await tx.inboxMember.createMany({
            data: memberUserIds.map(userId => ({
              inboxId: inbox.id,
              userId,
            })),
            skipDuplicates: true,
          });
        }

        return { inboxId: inbox.id, channelId: channel.id };
      });

      // Emit channel.created event -> FacebookLifecycleService will auto-subscribe webhook
      this.eventEmitter.emit('channel.created', {
        workspaceId,
        inboxId: result.inboxId,
        channelId: result.channelId,
        channelType: ChannelType.FACEBOOK_MESSENGER,
      });

      createdList.push({
        inboxId: result.inboxId,
        channelId: result.channelId,
        pageId,
        pageName: pageInfo.name,
      });

      this.logger.log(
        `Connected Facebook Page '${pageInfo.name}' (${pageId}) in batch to workspace '${workspaceId}'`,
      );
    }

    // 4. Cleanup Redis session
    await this.redis.del(`${USER_TOKEN_PREFIX}${dto.sessionId}`);

    return { inboxes: createdList };
  }

  /**
   * Disconnects a Facebook Page channel: unsubscribes webhook, deletes Channel and Inbox.
   */
  async disconnectPage(workspaceId: string, channelId: string): Promise<{ success: boolean }> {
    const client = this.prisma.getClient();

    const channel = await client.channel.findFirst({
      where: { id: channelId, workspaceId, channelType: 'FACEBOOK_MESSENGER' },
      include: { inbox: true },
    });

    if (!channel) {
      throw new NotFoundException({
        code: 'CHANNEL_NOT_FOUND',
        message: `Facebook channel '${channelId}' not found in this workspace`,
      });
    }

    // Emit channel.deleted → FacebookLifecycleService will unsubscribe webhook
    this.eventEmitter.emit('channel.deleted', {
      workspaceId,
      inboxId: channel.inboxId,
      channelId: channel.id,
      channelType: ChannelType.FACEBOOK_MESSENGER,
    });

    // Delete channel and inbox
    await this.prisma.runInTransaction(async txCtx => {
      const tx = txCtx.tx;
      await tx.channel.delete({ where: { id: channelId } });
      await tx.inbox.delete({ where: { id: channel.inboxId } });
    });

    this.logger.log(`Disconnected Facebook channel '${channelId}' from workspace '${workspaceId}'`);

    return { success: true };
  }

  /**
   * Re-authorizes a Facebook Page channel with a new OAuth token.
   * Exchanges the token, finds the matching page, and updates credentials.
   *
   * Reference: Chatwoot callbacks_controller.rb#reauthorize_page
   */
  async reauthorizePage(
    workspaceId: string,
    channelId: string,
    omniAuthToken: string,
  ): Promise<{ success: boolean }> {
    const client = this.prisma.getClient();

    const channel = await client.channel.findFirst({
      where: { id: channelId, workspaceId, channelType: 'FACEBOOK_MESSENGER' },
    });

    if (!channel) {
      throw new NotFoundException({
        code: 'CHANNEL_NOT_FOUND',
        message: `Facebook channel '${channelId}' not found in this workspace`,
      });
    }

    // Exchange token for long-lived token
    const appId = this.getAppId();
    const appSecret = this.getAppSecret();

    const longLivedUrl = new URL(`${GRAPH_API_BASE}/${GRAPH_API_VERSION}/oauth/access_token`);
    longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longLivedUrl.searchParams.set('client_id', appId);
    longLivedUrl.searchParams.set('client_secret', appSecret);
    longLivedUrl.searchParams.set('fb_exchange_token', omniAuthToken);

    const response = await fetch(longLivedUrl.toString());
    const data = (await response.json()) as {
      access_token?: string;
      error?: { message: string };
    };

    const userAccessToken = data.access_token || omniAuthToken;

    // Find the page access token for the connected page
    const pagesUrl = `${GRAPH_API_BASE}/${GRAPH_API_VERSION}/me/accounts?access_token=${encodeURIComponent(userAccessToken)}`;
    const pagesResponse = await fetch(pagesUrl);
    const pagesData = (await pagesResponse.json()) as {
      data?: Array<{ id: string; access_token?: string }>;
    };

    const matchingPage = pagesData.data?.find(p => p.id === channel.providerAccountId);
    if (!matchingPage || !matchingPage.access_token) {
      throw new BadRequestException({
        code: 'FB_PAGE_NOT_FOUND',
        message:
          'The connected Facebook Page was not found in your account. Ensure you have admin access to the page.',
      });
    }

    // Update encrypted credentials
    const newCredentials = {
      pageAccessToken: matchingPage.access_token,
      userAccessToken,
      appSecret,
    };
    const encryptedString = this.credentialService.encrypt(newCredentials);

    await client.channel.update({
      where: { id: channelId },
      data: {
        credentials: { encrypted: encryptedString } as any,
        isConnected: true,
        settings: {
          ...((channel.settings as Record<string, unknown>) || {}),
          reauthorizationRequired: false,
          lastReauthorizedAt: new Date().toISOString(),
        },
      },
    });

    // Clear auth error counter in Redis
    await this.redis.del(`channel:${channelId}:auth_errors`);
    await this.redis.del(`channel:${channelId}:reauth_required`);

    // Re-subscribe webhook
    this.eventEmitter.emit('channel.updated', {
      workspaceId,
      inboxId: channel.inboxId,
      channelId: channel.id,
      channelType: ChannelType.FACEBOOK_MESSENGER,
    });

    this.logger.log(`Re-authorized Facebook channel '${channelId}'`);

    return { success: true };
  }
}
