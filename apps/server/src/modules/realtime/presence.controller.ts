import {
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PresenceEntry } from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database';
import { CurrentUser, JwtAuthGuard } from '../auth';
import type { JwtUserPayload } from '../auth/types/jwt-payload.type';
import { PresenceService } from './presence.service';

/**
 * REST API controller for agent online presence queries within a workspace.
 * Route: `/workspaces/:workspaceId/presence`
 */
@ApiTags('Presence')
@Controller('workspaces/:workspaceId/presence')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PresenceController {
  constructor(
    private readonly presenceService: PresenceService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Retrieves presence status for all active agents in a workspace (with optional offline inclusion).
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get online/away agents presence list for a workspace' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace UUID' })
  @ApiQuery({
    name: 'includeOffline',
    required: false,
    type: Boolean,
    description: 'Whether to include offline agents in the response',
  })
  @ApiResponse({ status: 200, description: 'Workspace presence list retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden: caller is not a member of this workspace' })
  async getWorkspacePresence(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtUserPayload,
    @Query('includeOffline') includeOffline?: string,
  ): Promise<PresenceEntry[]> {
    await this.verifyWorkspaceMembership(workspaceId, user.userId);

    const shouldIncludeOffline = includeOffline === 'true' || includeOffline === '1';
    return this.presenceService.getWorkspacePresence(workspaceId, shouldIncludeOffline);
  }

  /**
   * Retrieves presence status for a specific user in a workspace.
   */
  @Get(':userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get presence status for a specific user in a workspace' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace UUID' })
  @ApiParam({ name: 'userId', description: 'Target user UUID' })
  @ApiResponse({ status: 200, description: 'User presence retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden: caller is not a member of this workspace' })
  @ApiResponse({ status: 404, description: 'Presence record for user not found' })
  async getUserPresence(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: JwtUserPayload,
  ): Promise<PresenceEntry> {
    await this.verifyWorkspaceMembership(workspaceId, user.userId);

    const entry = await this.presenceService.getUserPresence(workspaceId, targetUserId);
    if (!entry) {
      throw new NotFoundException({
        code: 'PRESENCE_NOT_FOUND',
        message: `Presence record for user '${targetUserId}' not found in workspace '${workspaceId}'`,
      });
    }

    return entry;
  }

  private async verifyWorkspaceMembership(workspaceId: string, userId: string): Promise<void> {
    const member = await this.prisma.getClient().workspaceMember.findFirst({
      where: { workspaceId, userId },
      select: { workspaceId: true },
    });

    if (!member) {
      throw new ForbiddenException({
        code: 'WORKSPACE_ACCESS_DENIED',
        message: 'You do not have access to this workspace',
      });
    }
  }
}
