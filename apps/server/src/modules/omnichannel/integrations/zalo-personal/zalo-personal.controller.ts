import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { WorkspaceRole } from '@sales-copilot/shared-contracts';
import { CurrentWorkspace } from '../../../../common/authz/current-workspace.decorator';
import { Roles } from '../../../../common/authz/roles.decorator';
import { RolesGuard } from '../../../../common/authz/roles.guard';
import { WorkspaceGuard } from '../../../identity/workspaces/guards/workspace.guard';
import { CurrentUser } from '../../../../common/authz/current-user.decorator';
import type { JwtUserPayload } from '../../../../common/authz/jwt-payload.type';
import type { WorkspaceContext } from '../../../../common/authz/workspace-context.type';
import { ZaloPersonalConnectionService } from './zalo-personal-connection.service';
import {
  completeZaloPersonalReauthorizeSchema,
  connectZaloPersonalSchema,
  type CompleteZaloPersonalReauthorizeDto,
  type ConnectZaloPersonalDto,
} from './zalo-personal.dto';

/**
 * Zalo Personal (unofficial) controller — QR connect sessions only.
 *
 * There is no inbound webhook: messages arrive through the persistent listener
 * owned by ZaloPersonalConnectionService. The generic webhook route rejects
 * this channel type (adapter verifyWebhook always fails closed).
 */
@ApiTags('Integrations - Zalo Personal')
@Controller('integrations/zalo-personal')
export class ZaloPersonalController {
  constructor(private readonly connectionService: ZaloPersonalConnectionService) {}

  @Post('connect-session')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Start a QR login session for a personal Zalo account' })
  async createConnectSession(
    @CurrentWorkspace() context: WorkspaceContext,
    @Body() body: { channelId?: string },
  ): Promise<{ sessionId: string; expiresInMs: number }> {
    return this.connectionService.createConnectSession(context.workspaceId, body?.channelId);
  }

  @Get('connect-session/:sessionId/status')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Poll a QR login session (status, QR image, profile)' })
  async getConnectSessionStatus(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('sessionId') sessionId: string,
  ): Promise<{
    status: string;
    qrImage?: string;
    profileName?: string;
    ownId?: string;
    error?: string;
  }> {
    return this.connectionService.getConnectSessionStatus(context.workspaceId, sessionId);
  }

  @Post('connect')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Create the Zalo personal inbox/channel from a connected QR session' })
  async connect(
    @CurrentWorkspace() context: WorkspaceContext,
    @CurrentUser() user: JwtUserPayload,
    @Body() body: any,
  ): Promise<{ inboxId: string; channelId: string; ownId: string; zaloName: string }> {
    const dto = connectZaloPersonalSchema.parse(body) as ConnectZaloPersonalDto;
    return this.connectionService.connect(context.workspaceId, dto, user?.userId);
  }

  @Post('reauthorize/:channelId')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Start a QR login session to re-authorize an existing channel' })
  @ApiParam({ name: 'channelId', description: 'Channel UUID to re-authorize' })
  async createReauthorizeSession(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('channelId') channelId: string,
  ): Promise<{ sessionId: string; expiresInMs: number }> {
    return this.connectionService.createConnectSession(context.workspaceId, channelId);
  }

  @Post('reauthorize/:channelId/complete')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Complete re-authorization with a connected QR session' })
  async completeReauthorize(
    @CurrentWorkspace() context: WorkspaceContext,
    @CurrentUser() user: JwtUserPayload,
    @Param('channelId') channelId: string,
    @Body() body: any,
  ): Promise<{ success: boolean }> {
    const dto = completeZaloPersonalReauthorizeSchema.parse(
      body,
    ) as CompleteZaloPersonalReauthorizeDto;
    await this.connectionService.connect(
      context.workspaceId,
      { sessionId: dto.sessionId },
      user?.userId,
    );
    return { success: true };
  }
}
