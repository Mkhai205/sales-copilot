import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import * as crypto from 'crypto';
import type { Request, Response } from 'express';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { COMMENT_GUARD_QUEUE, WorkspaceRole } from '@sales-copilot/shared-contracts';
import { Public } from '../../../../common/authz/public.decorator';
import { CurrentWorkspace } from '../../../../common/authz/current-workspace.decorator';
import { Roles } from '../../../../common/authz/roles.decorator';
import { RolesGuard } from '../../../../common/authz/roles.guard';
import { WorkspaceGuard } from '../../../identity/workspaces/guards/workspace.guard';
import type { WorkspaceContext } from '../../../../common/authz/workspace-context.type';
import { ChannelCredentialService } from '../../../../infrastructure/crypto/channel-credential.service';
import { SystemSettingsService } from '../../../../common/settings/system-settings.service';
import { resolveFrontendUrl } from '../../../../common/http/frontend-url';
import { WebhooksService } from '../channel-webhooks/webhooks.service';
import { FacebookService } from './facebook.service';
import { FacebookAdapter } from './facebook.adapter';
import { connectFacebookPagesBatchSchema, type ConnectFacebookPagesBatchDto } from './facebook.dto';

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
    private readonly credentialService: ChannelCredentialService,
    private readonly systemSettingsService: SystemSettingsService,
    private readonly webhooksService: WebhooksService,
    private readonly adapter: FacebookAdapter,
    @InjectQueue(COMMENT_GUARD_QUEUE)
    private readonly commentGuardQueue: Queue,
  ) {}

  // ─── OAuth Endpoints ────────────────────────────────────────────────────────

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
    const origin = resolveFrontendUrl(this.configService, originQuery, req);
    return this.facebookService.getAuthUrl(context.workspaceId, origin, returnUrlQuery);
  }

  @Get('callback')
  @Public()
  @ApiOperation({ summary: 'Handle Facebook OAuth callback redirect' })
  @ApiResponse({
    status: 302,
    description: 'Redirects to frontend OAuth callback page with sessionId or error',
  })
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
    @Req() req?: Request,
  ): Promise<void> {
    try {
      const result = await this.facebookService.handleCallback(code, state);
      const frontendUrl = resolveFrontendUrl(this.configService, result.clientOrigin, req);

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

      return res.redirect(redirectUrl);
    } catch (error) {
      const errorMsg = (error as Error).message || 'Facebook authorization failed';
      const frontendUrl = resolveFrontendUrl(this.configService, undefined, req);
      const redirectUrl = `${frontendUrl}/auth/facebook/callback?error=${encodeURIComponent(errorMsg)}`;

      return res.redirect(redirectUrl);
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
    // 1. Verify HMAC signature using platform-level FB_APP_SECRET (fail-closed:
    // without a configured secret the payload cannot be authenticated, so it is rejected)
    const appSecret = this.configService.get<string>('FB_APP_SECRET');
    if (!appSecret) {
      this.logger.error('Central Webhook: FB_APP_SECRET is not configured. Rejecting payload.');
      return { success: false };
    }
    const signatureHeader = headers['x-hub-signature-256'] || headers['X-Hub-Signature-256'];

    if (!signatureHeader) {
      this.logger.warn('Central Webhook: Missing X-Hub-Signature-256 header');
      return { success: false };
    }

    const headerValue = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    const rawPayload =
      (req as any)?.rawBody || Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
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

    // 2. Extract page_id from each entry and route to correct Channel
    // Facebook webhook payload: { object: 'page', entry: [{ id: PAGE_ID, ... }] }
    if (body?.object !== 'page' || !Array.isArray(body?.entry)) {
      this.logger.debug('Central Webhook: Non-page event or empty entry, skipping');
      return { success: true };
    }

    const requestId = headers['x-request-id'] || headers['x-correlation-id'];

    // Platform kill-switch for comment masking (decision D1: flag now gates behavior)
    const commentMaskingEnabled = await this.systemSettingsService.getSetting<boolean>(
      'feature.comment_masking_enabled',
      true,
    );

    for (const entry of body.entry) {
      const pageId = String(entry.id);

      // Find channel by providerAccountId (page_id)
      // Reference: Chatwoot ChatwootFbProvider.access_token_for(page_id)
      const channel = await this.facebookService.findChannelByPageId(pageId);

      if (!channel) {
        this.logger.warn(
          `Central Webhook: No channel found for Facebook Page ID '${pageId}', skipping entry`,
        );
        continue;
      }

      // 2a. Process Feed changes (Comment Guard)
      if (Array.isArray(entry.changes)) {
        for (const change of entry.changes) {
          if (
            change.field === 'feed' &&
            change.value?.item === 'comment' &&
            (change.value?.verb === 'add' || change.value?.verb === 'edited')
          ) {
            const fromId = change.value?.from?.id ? String(change.value.from.id) : undefined;
            // Filter out comments from the page itself
            if (fromId === pageId) {
              this.logger.debug(
                `Central Webhook: Skipping feed comment from page itself '${pageId}'`,
              );
              continue;
            }

            const commentId = change.value?.comment_id
              ? String(change.value.comment_id)
              : change.value?.id
                ? String(change.value.id)
                : undefined;
            if (!commentId) {
              continue;
            }

            const verb = change.value?.verb || 'add';
            // Construct deterministic externalEventId:
            // For 'add', use commentId.
            // For 'edited', use commentId + stable edit signature (created_time or message content hash)
            // so an edited comment is not falsely blocked by the earlier 'add' event,
            // while retries of the edited webhook are properly deduplicated.
            const editSignature =
              verb === 'edited'
                ? `_edit_${
                    change.value?.created_time ||
                    crypto
                      .createHash('md5')
                      .update(change.value?.message || '')
                      .digest('hex')
                      .substring(0, 10)
                  }`
                : '';
            const externalEventId = `${commentId}${editSignature}`;

            const channelSettings = (channel.settings as any) || {};
            if (channelSettings.commentGuard?.enabled === true && commentMaskingEnabled !== false) {
              const { isDuplicate, event: channelEvent } =
                await this.facebookService.recordChannelEvent(
                  channel.id,
                  externalEventId,
                  `feed_comment_${verb}`,
                  change,
                );

              if (isDuplicate || !channelEvent) {
                this.logger.log(
                  `Duplicate feed comment '${externalEventId}' received for channel '${channel.id}'. Skipping.`,
                );
                continue;
              }

              // Enqueue job into BullMQ comment-guard queue
              await this.commentGuardQueue.add(
                'process-comment-guard',
                {
                  workspaceId: channel.workspaceId,
                  channelId: channel.id,
                  channelEventId: channelEvent.id,
                  commentId,
                  parentId: change.value.parent_id ? String(change.value.parent_id) : undefined,
                  postId: change.value.post_id ? String(change.value.post_id) : undefined,
                  senderId: fromId || commentId,
                  senderName: change.value.from?.name,
                  message: change.value.message || '',
                  verb,
                  timestamp: change.value.created_time
                    ? new Date(change.value.created_time * 1000).toISOString()
                    : new Date().toISOString(),
                  ...(requestId ? { requestId: String(requestId) } : {}),
                },
                {
                  jobId: `comment_${externalEventId}`,
                  attempts: 3,
                  backoff: {
                    type: 'exponential',
                    delay: 30_000,
                  },
                  removeOnComplete: true,
                  removeOnFail: false,
                },
              );

              this.logger.log(
                `Enqueued comment-guard job for comment '${externalEventId}' on channel '${channel.id}'`,
              );
            }
          }
        }
      }

      // 2b. Process Messaging events (chats)
      if (entry.messaging || entry.standby) {
        // Delegate to existing WebhooksService per-channel handler
        // Construct a single-entry payload without feed changes for messaging handler
        const singleEntryPayload = {
          object: body.object,
          entry: [
            {
              ...entry,
              changes: undefined,
            },
          ],
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
    }

    return { success: true };
  }
}
