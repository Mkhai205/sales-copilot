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
  Req,
  Res,
  UseGuards,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import * as crypto from 'crypto';
import type { Request, Response } from 'express';
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
  connectFacebookPagesBatchSchema,
  type ConnectFacebookPageDto,
  type ConnectFacebookPagesBatchDto,
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

  /**
   * Safely determines the frontend application URL for OAuth redirects.
   * Prevents redirects to Facebook/Meta domains or unverified origins.
   */
  private resolveFrontendUrl(candidateOrigin?: string, req?: Request): string {
    const corsOrigins = this.configService.get<string[]>('CORS_ORIGIN') || [];
    const validOrigins = corsOrigins.filter(
      o =>
        o &&
        o !== 'null' &&
        !o.includes('web:') &&
        !o.toLowerCase().includes('facebook.com') &&
        !o.toLowerCase().includes('meta.com'),
    );

    // 1. Explicit candidate origin (from query param or Redis session)
    if (candidateOrigin && this.isValidFrontendOrigin(candidateOrigin, validOrigins)) {
      return new URL(candidateOrigin).origin;
    }

    // 2. Request Origin header (valid frontend app)
    const originHeader = req?.headers?.origin as string | undefined;
    if (originHeader && this.isValidFrontendOrigin(originHeader, validOrigins)) {
      return new URL(originHeader).origin;
    }

    // 3. Request Referer header ONLY IF NOT Facebook/Meta
    const refererHeader = req?.headers?.referer as string | undefined;
    if (refererHeader && this.isValidFrontendOrigin(refererHeader, validOrigins)) {
      return new URL(refererHeader).origin;
    }

    // 4. Domain matching with WEBHOOK_BASE_URL (single-domain setup or tunnel)
    const webhookBaseUrl = this.configService.get<string>('WEBHOOK_BASE_URL') || '';
    if (webhookBaseUrl) {
      try {
        const webhookOrigin = new URL(webhookBaseUrl).origin;
        const matchingOrigin = validOrigins.find(o => {
          try {
            return new URL(o).origin === webhookOrigin;
          } catch {
            return o === webhookOrigin;
          }
        });
        if (matchingOrigin) {
          return new URL(matchingOrigin).origin;
        }
        return webhookOrigin;
      } catch {
        // Invalid webhookBaseUrl URL, continue to fallbacks
      }
    }

    // 5. Prefer HTTPS origins from CORS_ORIGIN
    const httpsOrigin = validOrigins.find(o => o.startsWith('https://'));
    if (httpsOrigin) {
      return new URL(httpsOrigin).origin;
    }

    // 6. Safe fallback (first valid origin or localhost:3000)
    return (validOrigins[0] || 'http://localhost:3000').replace(/\/+$/, '');
  }

  private isValidFrontendOrigin(candidate: string, allowedOrigins: string[]): boolean {
    if (!candidate || candidate === 'null') return false;
    const lower = candidate.toLowerCase();
    if (lower.includes('facebook.com') || lower.includes('meta.com')) return false;

    try {
      const u = new URL(candidate);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
      const normalized = u.origin;
      const webhookBaseUrl = this.configService.get<string>('WEBHOOK_BASE_URL') || '';
      let webhookOrigin = '';
      let webhookHostname = '';
      if (webhookBaseUrl) {
        const whUrl = new URL(webhookBaseUrl);
        webhookOrigin = whUrl.origin;
        webhookHostname = whUrl.hostname;
      }

      return (
        allowedOrigins.some(ao => {
          try {
            return new URL(ao).origin === normalized;
          } catch {
            return ao === normalized;
          }
        }) ||
        (Boolean(webhookOrigin) && normalized === webhookOrigin) ||
        (Boolean(webhookHostname) && u.hostname === webhookHostname) ||
        u.hostname === 'localhost' ||
        u.hostname === '127.0.0.1'
      );
    } catch {
      return false;
    }
  }

  @Get('auth-url')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Generate Facebook OAuth authorization URL' })
  @ApiResponse({ status: 200, description: 'Returns the Facebook OAuth login URL' })
  async getAuthUrl(
    @CurrentWorkspace() context: WorkspaceContext,
    @Query('origin') originQuery?: string,
    @Query('returnUrl') returnUrlQuery?: string,
    @Req() req?: Request,
  ): Promise<{ authUrl: string }> {
    const origin = this.resolveFrontendUrl(originQuery, req);
    return this.facebookService.getAuthUrl(context.workspaceId, origin, returnUrlQuery);
  }

  @Get('callback')
  @Public()
  @ApiOperation({ summary: 'Handle Facebook OAuth callback redirect' })
  @ApiResponse({
    status: 200,
    description: 'HTML page sending postMessage to popup opener or redirecting',
  })
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
    @Req() req?: Request,
  ): Promise<void> {
    try {
      const result = await this.facebookService.handleCallback(code, state);
      const frontendUrl = this.resolveFrontendUrl(result.clientOrigin, req);

      let redirectUrl: string;
      if (result.returnUrl) {
        try {
          const returnUrlObj = new URL(result.returnUrl);
          returnUrlObj.searchParams.set('sessionId', result.sessionId);
          returnUrlObj.searchParams.set('workspaceId', result.workspaceId);
          redirectUrl = returnUrlObj.toString();
        } catch {
          redirectUrl = `${frontendUrl}/auth/facebook/callback?sessionId=${result.sessionId}&workspaceId=${result.workspaceId}`;
        }
      } else {
        redirectUrl = `${frontendUrl}/auth/facebook/callback?sessionId=${result.sessionId}&workspaceId=${result.workspaceId}`;
      }

      const html = `<!DOCTYPE html>
<html>
<head>
  <title>Facebook Authorization</title>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #0f172a; }
    .card { background: white; padding: 2rem; border-radius: 0.75rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); text-align: center; max-width: 400px; }
    .spinner { border: 3px solid #e2e8f0; border-top: 3px solid #2563eb; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; margin: 0 auto 1rem; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h3 style="margin: 0 0 0.5rem;">Authorization Successful</h3>
    <p style="color: #64748b; font-size: 0.875rem; margin: 0;">Connecting your Facebook Pages, this window will close automatically...</p>
  </div>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage({
          type: 'FACEBOOK_OAUTH_SUCCESS',
          sessionId: ${JSON.stringify(result.sessionId)},
          workspaceId: ${JSON.stringify(result.workspaceId)}
        }, '*');
      }
    } catch (e) {
      // ignore
    }
    window.location.href = ${JSON.stringify(redirectUrl)};
  </script>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html');
      res.status(HttpStatus.OK).send(html);
    } catch (error) {
      const errorMsg = (error as Error).message || 'Facebook authorization failed';
      const frontendUrl = this.resolveFrontendUrl(undefined, req);
      const redirectUrl = `${frontendUrl}/auth/facebook/callback?error=${encodeURIComponent(errorMsg)}`;

      const errorHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Facebook Authorization Failed</title>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #0f172a; }
    .card { background: white; padding: 2rem; border-radius: 0.75rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); text-align: center; max-width: 400px; }
  </style>
</head>
<body>
  <div class="card">
    <h3 style="margin: 0 0 0.5rem; color: #dc2626;">Authorization Failed</h3>
    <p style="color: #64748b; font-size: 0.875rem; margin: 0 0 1rem;">${errorMsg.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
    <button onclick="window.close()" style="background: #e2e8f0; border: none; padding: 0.5rem 1rem; border-radius: 0.375rem; cursor: pointer; font-size: 0.875rem;">Close Window</button>
  </div>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage({
          type: 'FACEBOOK_OAUTH_ERROR',
          error: ${JSON.stringify(errorMsg)}
        }, '*');
      }
    } catch (e) {
      // ignore
    }
    window.location.href = ${JSON.stringify(redirectUrl)};
  </script>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html');
      res.status(HttpStatus.OK).send(errorHtml);
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

  @Post('connect-batch')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Connect multiple Facebook Pages in batch' })
  @ApiResponse({ status: 201, description: 'Facebook Pages connected successfully' })
  async connectPagesBatch(
    @CurrentWorkspace() context: WorkspaceContext,
    @Body() body: any,
  ): Promise<{
    inboxes: Array<{ inboxId: string; channelId: string; pageId: string; pageName: string }>;
  }> {
    const dto = connectFacebookPagesBatchSchema.parse(body) as ConnectFacebookPagesBatchDto;
    return this.facebookService.connectPagesBatch(context.workspaceId, dto);
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
  @Throttle({ default: { limit: 200, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Facebook Central Webhook inbound event ingestion' })
  @ApiResponse({ status: 200, description: 'Webhook event received and processed' })
  async handleCentralWebhook(
    @Body() body: any,
    @Headers() headers: Record<string, any>,
    @Query() query: Record<string, any>,
    @Req() req?: Request,
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
      const rawPayload =
        (req as any)?.rawBody ||
        Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
      const expectedHash = crypto.createHmac('sha256', appSecret).update(rawPayload).digest('hex');

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
          { skipSignatureVerification: true },
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
