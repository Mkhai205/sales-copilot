import { Controller, Get, HttpCode, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PresenceEntry } from '@sales-copilot/shared-contracts';
import { CurrentWorkspace } from '../../common/authz/current-workspace.decorator';
import type { WorkspaceContext } from '../../common/authz/workspace-context.type';
import { WorkspaceGuard } from '../identity/workspaces/guards/workspace.guard';
import { PresenceService } from './presence.service';

/**
 * REST API controller for agent online presence queries within a workspace.
 * Route: `/presence` — the workspace is resolved from the X-Workspace-Id
 * header (or auto-resolved for single-workspace users) by WorkspaceGuard,
 * matching every other tenant-scoped endpoint. Live updates flow over the
 * /realtime socket; this endpoint only seeds the initial snapshot.
 */
@ApiTags('Presence')
@Controller('presence')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
export class PresenceController {
  constructor(private readonly presenceService: PresenceService) {}

  /**
   * Retrieves presence status for all agents in the workspace.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get online/away agents presence list for a workspace' })
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
    @CurrentWorkspace() workspace: WorkspaceContext,
    @Query('includeOffline') includeOffline?: string,
  ): Promise<PresenceEntry[]> {
    const shouldIncludeOffline = includeOffline === 'true' || includeOffline === '1';
    return this.presenceService.getWorkspacePresence(workspace.workspaceId, shouldIncludeOffline);
  }
}
