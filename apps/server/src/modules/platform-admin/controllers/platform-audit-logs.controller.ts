import { Controller, Get, HttpCode, HttpStatus, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  PaginationMeta,
  PlatformAuditLogDto,
  PlatformRole,
  QueryPlatformAuditLogsDto,
  queryPlatformAuditLogsSchema,
} from '@sales-copilot/shared-contracts';
import { ZodQuery } from '../../../common/pipes';
import { PlatformRoles } from '../decorators/platform-roles.decorator';
import { PlatformRolesGuard } from '../guards/platform-roles.guard';
import { PlatformAuditLogsService } from '../services/platform-audit-logs.service';

@ApiTags('Platform Admin Audit Logs')
@Controller('platform-admin/audit-logs')
@UseGuards(PlatformRolesGuard)
@PlatformRoles(PlatformRole.SUPER_ADMIN)
@ApiBearerAuth()
export class PlatformAuditLogsController {
  constructor(private readonly platformAuditLogsService: PlatformAuditLogsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List platform audit logs with filters and pagination',
  })
  @ApiResponse({ status: 200, description: 'Platform audit logs retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Super Administrator role required' })
  async list(
    @ZodQuery(queryPlatformAuditLogsSchema) query?: Partial<QueryPlatformAuditLogsDto>,
  ): Promise<{ items: PlatformAuditLogDto[]; meta: PaginationMeta }> {
    return this.platformAuditLogsService.getAuditLogs(query ?? {});
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get platform audit log details by ID',
  })
  @ApiResponse({ status: 200, description: 'Platform audit log retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Super Administrator role required' })
  @ApiResponse({ status: 404, description: 'Platform audit log not found' })
  async getDetail(@Param('id') id: string): Promise<PlatformAuditLogDto> {
    return this.platformAuditLogsService.getAuditLogById(id);
  }
}
