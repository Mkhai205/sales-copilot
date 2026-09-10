import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  PaginationMeta,
  PlatformRole,
  PlatformWorkspaceDetailDto,
  PlatformWorkspaceListItemDto,
  QueryPlatformWorkspacesDto,
  queryPlatformWorkspacesSchema,
  ToggleWorkspaceStatusDto,
  toggleWorkspaceStatusSchema,
  UpdateWorkspacePlanDto,
  updateWorkspacePlanSchema,
} from '@sales-copilot/shared-contracts';
import type { Request } from 'express';
import { ZodBody, ZodQuery } from '../../../common/pipes';
import { CurrentUser } from '../../auth';
import type { JwtUserPayload } from '../../auth';
import { PlatformRoles } from '../decorators/platform-roles.decorator';
import { PlatformRolesGuard } from '../guards/platform-roles.guard';
import { PlatformWorkspacesService } from '../services/platform-workspaces.service';

@ApiTags('Platform Admin Workspaces')
@Controller('platform-admin/workspaces')
@UseGuards(PlatformRolesGuard)
@PlatformRoles(PlatformRole.SUPER_ADMIN)
@ApiBearerAuth()
export class PlatformWorkspacesController {
  constructor(private readonly platformWorkspacesService: PlatformWorkspacesService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List workspaces with search, plan/status filters, and pagination',
  })
  @ApiResponse({ status: 200, description: 'Workspaces retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Super Administrator role required' })
  async list(
    @ZodQuery(queryPlatformWorkspacesSchema) query?: Partial<QueryPlatformWorkspacesDto>,
  ): Promise<{ items: PlatformWorkspaceListItemDto[]; meta: PaginationMeta }> {
    return this.platformWorkspacesService.getWorkspaces(query ?? {});
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get workspace technical details, quotas, and usage breakdown',
  })
  @ApiResponse({ status: 200, description: 'Workspace details retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Super Administrator role required' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async getDetail(@Param('id') id: string): Promise<PlatformWorkspaceDetailDto> {
    return this.platformWorkspacesService.getWorkspaceDetail(id);
  }

  @Patch(':id/plan')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update workspace billing plan and custom quota overrides atomically',
  })
  @ApiResponse({ status: 200, description: 'Workspace plan updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Super Administrator role required' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async updatePlan(
    @Param('id') id: string,
    @ZodBody(updateWorkspacePlanSchema) dto: UpdateWorkspacePlanDto,
    @CurrentUser() user: JwtUserPayload,
    @Req() req: Request,
  ): Promise<PlatformWorkspaceDetailDto> {
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
    const userAgent = req.headers['user-agent'] as string | undefined;

    return this.platformWorkspacesService.updateWorkspacePlan(id, dto, {
      userId: user.userId,
      email: user.email,
      ipAddress,
      userAgent,
    });
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Suspend or activate a workspace with mandatory reason tracking',
  })
  @ApiResponse({ status: 200, description: 'Workspace status updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed or status already matching' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Super Administrator role required' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async toggleStatus(
    @Param('id') id: string,
    @ZodBody(toggleWorkspaceStatusSchema) dto: ToggleWorkspaceStatusDto,
    @CurrentUser() user: JwtUserPayload,
    @Req() req: Request,
  ): Promise<PlatformWorkspaceDetailDto> {
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
    const userAgent = req.headers['user-agent'] as string | undefined;

    return this.platformWorkspacesService.toggleWorkspaceSuspension(id, dto, {
      userId: user.userId,
      email: user.email,
      ipAddress,
      userAgent,
    });
  }
}
