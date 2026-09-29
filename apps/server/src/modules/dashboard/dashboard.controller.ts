import { Controller, Get, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { WorkspaceRole, type DashboardSummaryDto } from '@sales-copilot/shared-contracts';
import { CurrentWorkspace } from '../../common/authz/current-workspace.decorator';
import { Roles } from '../../common/authz/roles.decorator';
import { RolesGuard } from '../../common/authz/roles.guard';
import { WorkspaceGuard } from '../identity/workspaces/guards/workspace.guard';
import type { WorkspaceContext } from '../../common/authz/workspace-context.type';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(WorkspaceGuard, RolesGuard)
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Workspace-Id',
  required: false,
  description: 'Target Workspace UUID for tenant resolution (or via path parameter)',
})
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Get workspace overview summary for today' })
  @ApiResponse({ status: 200, description: 'Summary retrieved successfully' })
  async getSummary(@CurrentWorkspace() context: WorkspaceContext): Promise<DashboardSummaryDto> {
    return this.dashboardService.getSummary(context.workspaceId);
  }
}
