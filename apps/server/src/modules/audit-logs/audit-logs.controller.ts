import { Controller, Get, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  AuditLogDto,
  AuditLogListQueryDto,
  auditLogListQuerySchema,
  PaginationMeta,
  WorkspaceRole,
} from '@sales-copilot/shared-contracts';
import { ZodQuery } from '../../common/pipes';
import { JwtAuthGuard } from '../auth';
import { CurrentWorkspace, Roles } from '../workspaces/decorators';
import { RolesGuard, WorkspaceGuard } from '../workspaces/guards';
import type { WorkspaceContext } from '../workspaces/types/workspace-context.type';
import { AuditLogService } from './audit-logs.service';

@ApiTags('Audit Logs')
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Workspace-Id',
  required: true,
  description: 'Target Workspace UUID for tenant resolution',
})
export class AuditLogsController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({
    summary: 'List audit logs in workspace with pagination and multi-attribute filters',
  })
  @ApiResponse({ status: 200, description: 'Audit logs retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Missing X-Workspace-Id header or invalid query' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Only ADMIN and OWNER can view audit logs' })
  async list(
    @CurrentWorkspace() context: WorkspaceContext,
    @ZodQuery(auditLogListQuerySchema) query?: AuditLogListQueryDto,
  ): Promise<{ items: AuditLogDto[]; meta: PaginationMeta }> {
    return this.auditLogService.list(context.workspaceId, query);
  }
}
