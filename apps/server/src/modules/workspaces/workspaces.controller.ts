import { Controller, Get, HttpCode, HttpStatus, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  type CreateWorkspaceDto,
  createWorkspaceSchema,
  type UpdateWorkspaceDto,
  updateWorkspaceSchema,
  type UserWorkspaceDto,
  type WorkspaceDto,
  WorkspaceRole,
} from '@sales-copilot/shared-contracts';
import { ZodBody } from '../../common/pipes';
import { CurrentUser } from '../auth';
import type { JwtUserPayload } from '../auth/types/jwt-payload.type';
import { CurrentWorkspace, Roles } from './decorators';
import { RolesGuard, WorkspaceGuard } from './guards';
import type { WorkspaceContext } from './types/workspace-context.type';
import { WorkspacesService } from './workspaces.service';

@ApiTags('Workspaces')
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all workspaces the authenticated user belongs to' })
  @ApiResponse({ status: 200, description: 'List of workspaces retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyWorkspaces(@CurrentUser() user: JwtUserPayload): Promise<UserWorkspaceDto[]> {
    return this.workspacesService.findWorkspacesByUserId(user.userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Provision a new workspace and become OWNER' })
  @ApiResponse({ status: 201, description: 'Workspace provisioned successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed or invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createWorkspace(
    @CurrentUser() user: JwtUserPayload,
    @ZodBody(createWorkspaceSchema) dto: CreateWorkspaceDto,
  ): Promise<WorkspaceDto> {
    return this.workspacesService.createWorkspace(user.userId, dto);
  }

  @Get('current')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WorkspaceGuard)
  @ApiBearerAuth()
  @ApiHeader({
    name: 'X-Workspace-Id',
    required: true,
    description: 'Target Workspace UUID for tenant resolution',
  })
  @ApiOperation({ summary: 'Get current workspace details specified by X-Workspace-Id header' })
  @ApiResponse({ status: 200, description: 'Current workspace retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Missing X-Workspace-Id header' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Access denied to workspace' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async getCurrentWorkspace(@CurrentWorkspace() context: WorkspaceContext): Promise<WorkspaceDto> {
    return this.workspacesService.getWorkspaceForContext(context.workspaceId);
  }

  @Patch('current')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiBearerAuth()
  @ApiHeader({
    name: 'X-Workspace-Id',
    required: true,
    description: 'Target Workspace UUID for tenant resolution',
  })
  @ApiOperation({
    summary: 'Update current workspace settings (requires OWNER or ADMIN role)',
  })
  @ApiResponse({ status: 200, description: 'Workspace settings updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed or missing header' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async updateCurrentWorkspace(
    @CurrentWorkspace() context: WorkspaceContext,
    @ZodBody(updateWorkspaceSchema) dto: UpdateWorkspaceDto,
  ): Promise<WorkspaceDto> {
    return this.workspacesService.updateWorkspace(context.workspaceId, dto);
  }
}
