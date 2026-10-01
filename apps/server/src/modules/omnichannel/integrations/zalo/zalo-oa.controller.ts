import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { WorkspaceRole } from '@sales-copilot/shared-contracts';
import { Public } from '../../../../common/authz/public.decorator';
import { CurrentWorkspace } from '../../../../common/authz/current-workspace.decorator';
import { Roles } from '../../../../common/authz/roles.decorator';
import { RolesGuard } from '../../../../common/authz/roles.guard';
import { WorkspaceGuard } from '../../../identity/workspaces/guards/workspace.guard';
import type { WorkspaceContext } from '../../../../common/authz/workspace-context.type';
import { resolveFrontendUrl } from '../../../../common/http/frontend-url';
import { ZaloOaService } from './zalo-oa.service';
import { connectZaloOaSchema, type ConnectZaloOaDto } from './zalo-oa.dto';

/**
 * Zalo Official Account integration controller — OAuth provisioning only.
 *
 * Webhook ingress reuses the generic public route `POST /api/v1/channels/:channelId/webhook`
 * (each OA registers its own callback URL in the OA Console, so no central webhook is needed),
 * and channel deletion reuses the generic inbox deletion flow.
 */
@ApiTags('Integrations - Zalo OA')
@Controller('integrations/zalo')
export class ZaloOaController {
  constructor(
    private readonly zaloOaService: ZaloOaService,
    private readonly configService: ConfigService,
  ) {}

  @Get('config')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({
    summary: 'Zalo connect configuration (redirect URI to register in Zalo console)',
  })
  async getConnectConfig(): Promise<{ redirectUri: string }> {
    return this.zaloOaService.getConnectConfig();
  }

  @Get('auth-url')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Generate Zalo OA OAuth authorization URL' })
  async getAuthUrl(
    @CurrentWorkspace() context: WorkspaceContext,
    @Query('origin') originQuery?: string,
    @Query('returnUrl') returnUrlQuery?: string,
    @Query('channelId') channelId?: string,
    @Req() req?: Request,
  ): Promise<{ authUrl: string }> {
    const clientOrigin = resolveFrontendUrl(this.configService, originQuery, req);
    return this.zaloOaService.getAuthUrl(context.workspaceId, {
      clientOrigin,
      returnUrl: returnUrlQuery,
      channelId: channelId || undefined,
    });
  }

  @Get('callback')
  @Public()
  @ApiOperation({ summary: 'Handle Zalo OA OAuth callback redirect' })
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
    @Req() req?: Request,
  ): Promise<void> {
    try {
      const result = await this.zaloOaService.handleCallback(code, state);
      const frontendUrl = resolveFrontendUrl(this.configService, result.clientOrigin, req);

      let redirectUrl: string;
      if (result.returnUrl) {
        try {
          const returnUrlObj = new URL(result.returnUrl);
          returnUrlObj.searchParams.set('sessionId', result.sessionId);
          returnUrlObj.searchParams.set('workspaceId', result.workspaceId);
          redirectUrl = returnUrlObj.toString();
        } catch {
          redirectUrl = `${frontendUrl}/auth/zalo/callback?sessionId=${result.sessionId}&workspaceId=${result.workspaceId}`;
        }
      } else {
        redirectUrl = `${frontendUrl}/auth/zalo/callback?sessionId=${result.sessionId}&workspaceId=${result.workspaceId}`;
      }

      return res.redirect(redirectUrl);
    } catch (error) {
      const errorMsg = (error as Error).message || 'Zalo authorization failed';
      const frontendUrl = resolveFrontendUrl(this.configService, undefined, req);
      const redirectUrl = `${frontendUrl}/auth/zalo/callback?error=${encodeURIComponent(errorMsg)}`;

      return res.redirect(redirectUrl);
    }
  }

  @Get('session')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Get the authorized OA info for an OAuth session' })
  async getSessionInfo(
    @CurrentWorkspace() context: WorkspaceContext,
    @Query('sessionId') sessionId: string,
  ): Promise<{ oaId: string; oaName: string; oaAvatar?: string }> {
    return this.zaloOaService.getSessionInfo(context.workspaceId, sessionId);
  }

  @Post('connect')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({
    summary: 'Create the Zalo OA inbox/channel from an OAuth session (or re-authorize)',
  })
  async connectZalo(
    @CurrentWorkspace() context: WorkspaceContext,
    @Body() body: any,
  ): Promise<{ inboxId: string; channelId: string; oaId: string; oaName: string }> {
    const dto = connectZaloOaSchema.parse(body) as ConnectZaloOaDto;
    return this.zaloOaService.connect(context.workspaceId, dto);
  }
}
