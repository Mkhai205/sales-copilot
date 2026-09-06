import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  WorkspaceRole,
  timelineQuerySchema,
  type TimelineQueryDto,
  type TimelineResponseDto,
} from '@sales-copilot/shared-contracts';
import { ZodQuery } from '../../common/pipes';
import { CurrentWorkspace, Roles } from '../workspaces/decorators';
import { RolesGuard, WorkspaceGuard } from '../workspaces/guards';
import type { WorkspaceContext } from '../workspaces/types/workspace-context.type';
import { ActivityTimelineService } from './activity-timeline.service';

@ApiTags('Activity Timeline')
@Controller()
@UseGuards(WorkspaceGuard, RolesGuard)
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Workspace-Id',
  required: false,
  description: 'Target Workspace UUID for tenant resolution (or via path parameter)',
})
export class ActivityTimelineController {
  constructor(private readonly activityTimelineService: ActivityTimelineService) {}

  @Get(['workspaces/:workspaceId/leads/:leadId/timeline', 'leads/:leadId/timeline'])
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({
    summary: 'Retrieve unified chronological activity timeline for a Lead with cursor pagination',
  })
  @ApiResponse({ status: 200, description: 'Aggregated timeline events returned' })
  @ApiResponse({ status: 404, description: 'Lead not found in workspace' })
  async getLeadTimeline(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('leadId') leadId: string,
    @ZodQuery(timelineQuerySchema) query: TimelineQueryDto,
  ): Promise<TimelineResponseDto> {
    return this.activityTimelineService.getLeadTimeline(context.workspaceId, leadId, query);
  }
}
