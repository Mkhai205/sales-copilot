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
  AddTeamMembersDto,
  addTeamMembersSchema,
  CreateTeamDto,
  createTeamSchema,
  RemoveTeamMembersDto,
  removeTeamMembersSchema,
  TeamDto,
  TeamMemberDto,
  UpdateTeamDto,
  updateTeamSchema,
  WorkspaceRole,
} from '@sales-copilot/shared-contracts';
import { ZodBody } from '../../common/pipes';
import { JwtAuthGuard } from '../auth';
import { CurrentWorkspace, Roles } from '../workspaces/decorators';
import { RolesGuard, WorkspaceGuard } from '../workspaces/guards';
import type { WorkspaceContext } from '../workspaces/types/workspace-context.type';
import { TeamsService } from './teams.service';

@ApiTags('Teams')
@Controller('teams')
@UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Workspace-Id',
  required: true,
  description: 'Target Workspace UUID for tenant resolution',
})
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'List all teams in the workspace' })
  @ApiResponse({ status: 200, description: 'Teams list retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Missing X-Workspace-Id header' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async listTeams(@CurrentWorkspace() context: WorkspaceContext): Promise<TeamDto[]> {
    return this.teamsService.listTeams(context.workspaceId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Create a new team in the workspace' })
  @ApiResponse({ status: 201, description: 'Team created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Insufficient permissions' })
  @ApiResponse({ status: 409, description: 'Team name already exists in workspace' })
  async createTeam(
    @CurrentWorkspace() context: WorkspaceContext,
    @ZodBody(createTeamSchema) dto: CreateTeamDto,
  ): Promise<TeamDto> {
    return this.teamsService.createTeam(context.workspaceId, dto);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'Get team details and members by team ID' })
  @ApiResponse({ status: 200, description: 'Team details retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  async getTeam(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') teamId: string,
  ): Promise<TeamDto> {
    return this.teamsService.getTeamById(context.workspaceId, teamId);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Update team details' })
  @ApiResponse({ status: 200, description: 'Team updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  @ApiResponse({ status: 409, description: 'Team name already exists in workspace' })
  async updateTeam(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') teamId: string,
    @ZodBody(updateTeamSchema) dto: UpdateTeamDto,
  ): Promise<TeamDto> {
    return this.teamsService.updateTeam(context.workspaceId, teamId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Delete a team from the workspace' })
  @ApiResponse({ status: 200, description: 'Team deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  async deleteTeam(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') teamId: string,
  ): Promise<{ success: boolean }> {
    return this.teamsService.deleteTeam(context.workspaceId, teamId);
  }

  @Get(':id/members')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'List all members of a specific team' })
  @ApiResponse({ status: 200, description: 'Team members retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  async listTeamMembers(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') teamId: string,
  ): Promise<TeamMemberDto[]> {
    return this.teamsService.listTeamMembers(context.workspaceId, teamId);
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Add members to a team' })
  @ApiResponse({ status: 200, description: 'Members added to team successfully' })
  @ApiResponse({ status: 400, description: 'Invalid user IDs or user not in workspace' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  async addTeamMembers(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') teamId: string,
    @ZodBody(addTeamMembersSchema) dto: AddTeamMembersDto,
  ): Promise<TeamMemberDto[]> {
    return this.teamsService.addTeamMembers(context.workspaceId, teamId, dto.userIds);
  }

  @Delete(':id/members')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Remove multiple members from a team' })
  @ApiResponse({ status: 200, description: 'Members removed from team successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  async removeTeamMembers(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') teamId: string,
    @ZodBody(removeTeamMembersSchema) dto: RemoveTeamMembersDto,
  ): Promise<{ success: boolean }> {
    return this.teamsService.removeTeamMembers(context.workspaceId, teamId, dto.userIds);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Remove a single member from a team' })
  @ApiResponse({ status: 200, description: 'Member removed from team successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  async removeSingleTeamMember(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') teamId: string,
    @Param('userId') userId: string,
  ): Promise<{ success: boolean }> {
    return this.teamsService.removeTeamMembers(context.workspaceId, teamId, [userId]);
  }
}
