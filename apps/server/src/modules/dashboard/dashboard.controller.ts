import { Controller, Get, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { WorkspaceRole, type DashboardSummaryDto } from '@sales-copilot/shared-contracts';
import { CurrentWorkspace, Roles } from '../identity/workspaces/decorators';
import { RolesGuard, WorkspaceGuard } from '../identity/workspaces/guards';
import type { WorkspaceContext } from '../identity/workspaces/types/workspace-context.type';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@Controller(['workspaces/:workspaceId/dashboard', 'dashboard'])
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
