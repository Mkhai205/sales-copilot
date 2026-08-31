import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  AddInboxMemberDto,
  addInboxMemberSchema,
  InboxMemberDto,
  WorkspaceRole,
} from '@sales-copilot/shared-contracts';
import { ZodBody } from '../../common/pipes';
import { CurrentWorkspace, Roles } from '../workspaces/decorators';
import { RolesGuard, WorkspaceGuard } from '../workspaces/guards';
import type { WorkspaceContext } from '../workspaces/types/workspace-context.type';
import { InboxesService } from './inboxes.service';

@ApiTags('Inbox Members')
@Controller('inboxes/:id/members')
@UseGuards(WorkspaceGuard, RolesGuard)
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Workspace-Id',
  required: true,
  description: 'Target Workspace UUID for tenant resolution',
})
export class InboxMembersController {
  constructor(private readonly inboxesService: InboxesService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'List all members assigned to an inbox' })
  @ApiResponse({ status: 200, description: 'Inbox members list retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Missing X-Workspace-Id header' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Inbox not found' })
  async listMembers(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') inboxId: string,
  ): Promise<InboxMemberDto[]> {
    return this.inboxesService.listMembers(context.workspaceId, inboxId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Add a user to an inbox (user must be a workspace member)' })
  @ApiResponse({ status: 201, description: 'Member added to inbox successfully' })
  @ApiResponse({ status: 400, description: 'User is not a member of this workspace (BR-1.3)' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Inbox not found' })
  @ApiResponse({ status: 409, description: 'User is already a member of this inbox' })
  async addMember(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') inboxId: string,
    @ZodBody(addInboxMemberSchema) dto: AddInboxMemberDto,
  ): Promise<InboxMemberDto> {
    return this.inboxesService.addMember(context.workspaceId, inboxId, dto.userId);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Remove a user from an inbox' })
  @ApiResponse({ status: 200, description: 'Member removed from inbox successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Inbox or member not found' })
  async removeMember(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') inboxId: string,
    @Param('userId') userId: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.inboxesService.removeMember(context.workspaceId, inboxId, userId);
  }
}
