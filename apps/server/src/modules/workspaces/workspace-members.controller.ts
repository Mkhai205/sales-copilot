import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  AddWorkspaceMemberDto,
  addWorkspaceMemberSchema,
  UpdateWorkspaceMemberRoleDto,
  updateWorkspaceMemberRoleSchema,
  WorkspaceMemberDto,
  WorkspaceRole,
} from '@sales-copilot/shared-contracts';
import { ZodBody } from '../../common/pipes';
import { CurrentUser } from '../auth';
import type { JwtUserPayload } from '../auth/types/jwt-payload.type';
import { CurrentWorkspace, Roles } from './decorators';
import { RolesGuard, WorkspaceGuard } from './guards';
import type { WorkspaceContext } from './types/workspace-context.type';
import { WorkspacesService } from './workspaces.service';

@ApiTags('Workspace Members')
@Controller('workspaces/current/members')
@UseGuards(WorkspaceGuard, RolesGuard)
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Workspace-Id',
  required: true,
  description: 'Target Workspace UUID for tenant resolution',
})
export class WorkspaceMembersController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'List all members of the current workspace' })
  @ApiResponse({ status: 200, description: 'Members list retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Missing X-Workspace-Id header' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async listMembers(@CurrentWorkspace() context: WorkspaceContext): Promise<WorkspaceMemberDto[]> {
    return this.workspacesService.findMembersByWorkspaceId(context.workspaceId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Add a new member to the current workspace by email' })
  @ApiResponse({ status: 201, description: 'Member added successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input or user is inactive' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'User with specified email not found' })
  @ApiResponse({ status: 409, description: 'User is already a member of this workspace' })
  async addMember(
    @CurrentWorkspace() context: WorkspaceContext,
    @CurrentUser() user: JwtUserPayload,
    @ZodBody(addWorkspaceMemberSchema) dto: AddWorkspaceMemberDto,
  ): Promise<WorkspaceMemberDto> {
    return this.workspacesService.addMemberByEmail(
      context.workspaceId,
      user.userId,
      context.role,
      dto,
    );
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Update a workspace member role' })
  @ApiResponse({ status: 200, description: 'Member role updated successfully' })
  @ApiResponse({ status: 400, description: 'Cannot demote the only workspace owner' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Workspace member not found' })
  async updateMemberRole(
    @CurrentWorkspace() context: WorkspaceContext,
    @CurrentUser() user: JwtUserPayload,
    @Param('id') memberId: string,
    @ZodBody(updateWorkspaceMemberRoleSchema) dto: UpdateWorkspaceMemberRoleDto,
  ): Promise<WorkspaceMemberDto> {
    return this.workspacesService.updateMemberRole(
      context.workspaceId,
      memberId,
      user.userId,
      context.role,
      dto,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Remove a member from the workspace' })
  @ApiResponse({ status: 200, description: 'Member removed successfully' })
  @ApiResponse({ status: 400, description: 'Cannot remove the only workspace owner' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Workspace member not found' })
  async removeMember(
    @CurrentWorkspace() context: WorkspaceContext,
    @CurrentUser() user: JwtUserPayload,
    @Param('id') memberId: string,
  ): Promise<{ success: boolean }> {
    return this.workspacesService.removeMember(
      context.workspaceId,
      memberId,
      user.userId,
      context.role,
    );
  }
}
