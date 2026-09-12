import { Controller, Get, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PlatformMetricsOverviewDto, PlatformRole } from '@sales-copilot/shared-contracts';
import { PlatformRoles } from '../decorators/platform-roles.decorator';
import { PlatformRolesGuard } from '../guards/platform-roles.guard';
import { PlatformMetricsService } from '../services/platform-metrics.service';

@ApiTags('Platform Admin Metrics')
@Controller('platform-admin/metrics')
@UseGuards(PlatformRolesGuard)
@PlatformRoles(PlatformRole.SUPER_ADMIN)
@ApiBearerAuth()
export class PlatformMetricsController {
  constructor(private readonly platformMetricsService: PlatformMetricsService) {}

  @Get('overview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get system-wide platform metrics overview and infrastructure health status',
  })
  @ApiResponse({ status: 200, description: 'Metrics overview retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Super Administrator role required' })
  async getOverview(): Promise<PlatformMetricsOverviewDto> {
    return this.platformMetricsService.getMetricsOverview();
  }
}
