import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import * as crypto from 'crypto';
import type { Response } from 'express';
import { WorkspaceRole } from '@sales-copilot/shared-contracts';
import { Public } from '../../modules/auth';
import { CurrentWorkspace, Roles } from '../../modules/workspaces/decorators';
import { RolesGuard, WorkspaceGuard } from '../../modules/workspaces/guards';
import type { WorkspaceContext } from '../../modules/workspaces/types/workspace-context.type';
import { PrismaService } from '../../infrastructure/database';
import { ChannelCredentialService } from '../../modules/inboxes/channel-credential.service';
import { WebhooksService } from '../../modules/webhooks/webhooks.service';
import { FacebookService } from './facebook.service';
import { FacebookAdapter } from './facebook.adapter';
import {
  connectFacebookPageSchema,
  type ConnectFacebookPageDto,
  type FacebookCallbackQuery,
} from './facebook.dto';

/**
 * Facebook Messenger Integration Controller.
 *
 * Handles:
 * 1. OAuth 1-click flow: auth URL generation, callback handling, page discovery, connect/disconnect.
 * 2. Central Webhook: single endpoint for all Facebook Page webhook events (required by Meta).
 *
 * Reference: Chatwoot callbacks_controller.rb & ChatwootFbProvider (central webhook via facebook-messenger gem)
 */
@ApiTags('Integrations - Facebook')
@Controller('integrations/facebook')
export class FacebookController {
  private readonly logger = new Logger(FacebookController.name);

  constructor(
    private readonly facebookService: FacebookService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly credentialService: ChannelCredentialService,
    @Inject(forwardRef(() => WebhooksService))
    private readonly webhooksService: WebhooksService,
    private readonly adapter: FacebookAdapter,
  ) {}

  // ─── OAuth Endpoints ────────────────────────────────────────────────────────

  @Get('auth-url')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Generate Facebook OAuth authorization URL' })
  @ApiResponse({ status: 200, description: 'Returns the Facebook OAuth login URL' })
  async getAuthUrl(@CurrentWorkspace() context: WorkspaceContext): Promise<{ authUrl: string }> {
    return this.facebookService.getAuthUrl(context.workspaceId);
  }

  @Get('callback')
  @Public()
  @ApiOperation({ summary: 'Handle Facebook OAuth callback redirect' })
  @ApiResponse({ status: 302, description: 'Redirects to frontend with session data' })
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const result = await this.facebookService.handleCallback(code, state);

      // Redirect to frontend with session info
      const corsOrigins = this.configService.get<string[]>('CORS_ORIGIN');
      const frontendUrl =
        corsOrigins && corsOrigins.length > 0 ? corsOrigins[0] : 'http://localhost:3000';
      const redirectUrl = `${frontendUrl}/settings/inboxes/new/facebook?sessionId=${result.sessionId}&workspaceId=${result.workspaceId}`;

      res.redirect(redirectUrl);
    } catch (error) {
      const corsOrigins = this.configService.get<string[]>('CORS_ORIGIN');
      const frontendUrl =
        corsOrigins && corsOrigins.length > 0 ? corsOrigins[0] : 'http://localhost:3000';
      const errorMsg = encodeURIComponent(
        (error as Error).message || 'Facebook authorization failed',
      );
      res.redirect(`${frontendUrl}/settings/inboxes/new/facebook?error=${errorMsg}`);
    }
  }

  @Get('pages')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'List Facebook Pages available for connection' })
  @ApiResponse({ status: 200, description: 'List of Facebook Pages with connection status' })
  async discoverPages(
    @CurrentWorkspace() context: WorkspaceContext,
    @Query('sessionId') sessionId: string,
  ) {
    return this.facebookService.discoverPages(context.workspaceId, sessionId);
  }

  @Post('connect')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Connect a Facebook Page to create Inbox + Channel' })
  @ApiResponse({ status: 201, description: 'Facebook Page connected successfully' })
  async connectPage(
    @CurrentWorkspace() context: WorkspaceContext,
    @Body() body: any,
    @Query('sessionId') sessionId?: string,
  ): Promise<{ inboxId: string; channelId: string }> {
    const dto = connectFacebookPageSchema.parse(body) as ConnectFacebookPageDto;
    return this.facebookService.connectPage(context.workspaceId, dto, sessionId);
  }

  @Delete('disconnect/:channelId')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Disconnect a Facebook Page channel' })
  @ApiParam({ name: 'channelId', description: 'Channel UUID to disconnect' })
  @ApiResponse({ status: 200, description: 'Facebook Page disconnected' })
  async disconnectPage(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('channelId') channelId: string,
  ): Promise<{ success: boolean }> {
    return this.facebookService.disconnectPage(context.workspaceId, channelId);
  }

  @Post('reauthorize/:channelId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Re-authorize a Facebook Page channel with new OAuth token' })
  @ApiParam({ name: 'channelId', description: 'Channel UUID to re-authorize' })
  @ApiResponse({ status: 200, description: 'Channel re-authorized successfully' })
  async reauthorizePage(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('channelId') channelId: string,
    @Body('omniAuthToken') omniAuthToken: string,
  ): Promise<{ success: boolean }> {
    return this.facebookService.reauthorizePage(context.workspaceId, channelId, omniAuthToken);
  }

  // ─── Central Webhook Endpoint ───────────────────────────────────────────────
  // Facebook requires a SINGLE callback URL per Meta App.
  // All page events are delivered here and routed to the correct Channel by page_id.
  // Reference: Chatwoot mounts Facebook::Messenger::Server at '/bot' (config/routes.rb:661)

  @Get('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Facebook Central Webhook verification (hub.challenge handshake)' })
  async verifyCentralWebhook(
    @Query('hub.mode') hubMode: string,
    @Query('hub.verify_token') hubVerifyToken: string,
    @Query('hub.challenge') hubChallenge: string,
    @Res() res: Response,
  ): Promise<void> {
    const expectedToken = this.configService.get<string>('FB_VERIFY_TOKEN');

    if (hubMode === 'subscribe' && expectedToken && hubVerifyToken === expectedToken) {
      this.logger.log('Facebook Central Webhook verification succeeded');
      res.status(HttpStatus.OK).send(hubChallenge);
    } else {
      this.logger.warn(
        `Facebook Central Webhook verification failed (mode=${hubMode}, token_match=${hubVerifyToken === expectedToken})`,
      );
      res.status(HttpStatus.FORBIDDEN).send('Verification failed');
    }
  }

  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Facebook Central Webhook inbound event ingestion' })
  @ApiResponse({ status: 200, description: 'Webhook event received and processed' })
  async handleCentralWebhook(
    @Body() body: any,
    @Headers() headers: Record<string, any>,
    @Query() query: Record<string, any>,
  ): Promise<{ success: boolean }> {
    // 1. Verify HMAC signature using platform-level FB_APP_SECRET
    const appSecret = this.configService.get<string>('FB_APP_SECRET');
    if (appSecret) {
      const signatureHeader = headers['x-hub-signature-256'] || headers['X-Hub-Signature-256'];

      if (!signatureHeader) {
        this.logger.warn('Central Webhook: Missing X-Hub-Signature-256 header');
        return { success: false };
      }

      const headerValue = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
      const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
      const expectedHash = crypto.createHmac('sha256', appSecret).update(bodyString).digest('hex');

      const receivedHash = headerValue?.startsWith('sha256=') ? headerValue.slice(7) : headerValue;

      try {
        const isValid = crypto.timingSafeEqual(
          Buffer.from(expectedHash, 'hex'),
          Buffer.from(receivedHash || '', 'hex'),
        );

        if (!isValid) {
          this.logger.warn('Central Webhook: HMAC signature verification failed');
          return { success: false };
        }
      } catch {
        this.logger.warn('Central Webhook: HMAC comparison error');
        return { success: false };
      }
    }

    // 2. Extract page_id from each entry and route to correct Channel
    // Facebook webhook payload: { object: 'page', entry: [{ id: PAGE_ID, ... }] }
    if (body?.object !== 'page' || !Array.isArray(body?.entry)) {
      this.logger.debug('Central Webhook: Non-page event or empty entry, skipping');
      return { success: true };
    }

    const client = this.prisma.getClient();

    for (const entry of body.entry) {
      const pageId = String(entry.id);

      // Find channel by providerAccountId (page_id)
      // Reference: Chatwoot ChatwootFbProvider.access_token_for(page_id)
      const channel = await client.channel.findFirst({
        where: {
          channelType: 'FACEBOOK_MESSENGER',
          providerAccountId: pageId,
        },
      });

      if (!channel) {
        this.logger.warn(
          `Central Webhook: No channel found for Facebook Page ID '${pageId}', skipping entry`,
        );
        continue;
      }

      // Delegate to existing WebhooksService per-channel handler
      // Construct a single-entry payload for the channel
      const singleEntryPayload = {
        object: body.object,
        entry: [entry],
      };

      try {
        await this.webhooksService.handleInboundWebhook(
          channel.id,
          singleEntryPayload,
          headers,
          query,
        );
      } catch (err) {
        this.logger.error(
          `Central Webhook: Error processing entry for Page '${pageId}' (Channel: ${channel.id}): ${(err as Error).message}`,
        );
        // Continue processing other entries — don't fail the whole batch
      }
    }

    return { success: true };
  }
}
