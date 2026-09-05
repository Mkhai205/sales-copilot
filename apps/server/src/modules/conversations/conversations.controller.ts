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
  AssignConversationDto,
  assignConversationSchema,
  AssignLabelsDto,
  assignLabelsSchema,
  ConversationListQueryDto,
  conversationListQuerySchema,
  ConversationCountsQueryDto,
  conversationCountsQuerySchema,
  ConversationCountsResponseDto,
  ConversationResponseDto,
  CreateConversationDto,
  createConversationSchema,
  LabelDto,
  PaginationMeta,
  UpdateConversationPriorityDto,
  updateConversationPrioritySchema,
  UpdateConversationStatusDto,
  updateConversationStatusSchema,
  WorkspaceRole,
} from '@sales-copilot/shared-contracts';
import { ZodBody, ZodQuery } from '../../common/pipes';
import { CurrentUser } from '../auth/decorators';
import type { JwtUserPayload } from '../auth/types/jwt-payload.type';
import { CurrentWorkspace, Roles } from '../workspaces/decorators';
import { RolesGuard, WorkspaceGuard } from '../workspaces/guards';
import type { WorkspaceContext } from '../workspaces/types/workspace-context.type';
import { ConversationsService } from './conversations.service';

@ApiTags('Conversations')
@Controller('conversations')
@UseGuards(WorkspaceGuard, RolesGuard)
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Workspace-Id',
  required: true,
  description: 'Target Workspace UUID for tenant resolution',
})
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({
    summary: 'List all conversations in the workspace with filtering and pagination',
  })
  @ApiResponse({ status: 200, description: 'Conversations list retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Missing X-Workspace-Id header or invalid query' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async list(
    @CurrentWorkspace() context: WorkspaceContext,
    @ZodQuery(conversationListQuerySchema) query?: ConversationListQueryDto,
  ): Promise<{ items: ConversationResponseDto[]; meta: PaginationMeta }> {
    return this.conversationsService.list(context.workspaceId, query);
  }

  @Get('counts')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'Get conversation counts for tabs (mine, unassigned, all)' })
  @ApiResponse({ status: 200, description: 'Conversation counts retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getCounts(
    @CurrentWorkspace() context: WorkspaceContext,
    @CurrentUser() user: JwtUserPayload,
    @ZodQuery(conversationCountsQuerySchema) query?: ConversationCountsQueryDto,
  ): Promise<ConversationCountsResponseDto> {
    return this.conversationsService.getCounts(context.workspaceId, query?.status, user?.userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Create a new conversation in the workspace' })
  @ApiResponse({ status: 201, description: 'Conversation created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed or assignee not in inbox' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Contact or Inbox not found' })
  async create(
    @CurrentWorkspace() context: WorkspaceContext,
    @ZodBody(createConversationSchema) dto: CreateConversationDto,
  ): Promise<ConversationResponseDto> {
    return this.conversationsService.create(context.workspaceId, dto);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'Get a conversation detail by ID' })
  @ApiResponse({ status: 200, description: 'Conversation detail retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async getById(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') id: string,
  ): Promise<ConversationResponseDto> {
    return this.conversationsService.getById(context.workspaceId, id);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Update conversation status via State Machine' })
  @ApiResponse({ status: 200, description: 'Conversation status updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid status transition or missing snoozedUntil' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async updateStatus(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') id: string,
    @ZodBody(updateConversationStatusSchema) dto: UpdateConversationStatusDto,
  ): Promise<ConversationResponseDto> {
    return this.conversationsService.updateStatus(context.workspaceId, id, dto);
  }

  @Patch(':id/assign')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Assign agent and/or team to conversation' })
  @ApiResponse({ status: 200, description: 'Conversation assigned successfully' })
  @ApiResponse({ status: 400, description: 'Assignee not a member of conversation inbox' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Conversation or Team not found' })
  async assign(
    @CurrentWorkspace() context: WorkspaceContext,
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
    @ZodBody(assignConversationSchema) dto: AssignConversationDto,
  ): Promise<ConversationResponseDto> {
    return this.conversationsService.assign(context.workspaceId, id, dto, user?.userId);
  }

  @Patch(':id/priority')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Update conversation priority' })
  @ApiResponse({ status: 200, description: 'Conversation priority updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid priority level' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async updatePriority(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') id: string,
    @ZodBody(updateConversationPrioritySchema) dto: UpdateConversationPriorityDto,
  ): Promise<ConversationResponseDto> {
    return this.conversationsService.updatePriority(context.workspaceId, id, dto);
  }

  @Post(':id/reset-unread')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'Reset unread messages counter to 0' })
  @ApiResponse({ status: 200, description: 'Unread counter reset successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async resetUnread(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') id: string,
  ): Promise<ConversationResponseDto> {
    return this.conversationsService.resetUnreadCount(context.workspaceId, id);
  }

  @Get(':id/labels')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'List all labels assigned to a conversation' })
  @ApiResponse({ status: 200, description: 'Labels list retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async getLabels(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') id: string,
  ): Promise<LabelDto[]> {
    return this.conversationsService.getLabels(context.workspaceId, id);
  }

  @Post(':id/labels')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Assign labels to a conversation' })
  @ApiResponse({ status: 200, description: 'Labels assigned successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Conversation or Label not found' })
  async assignLabels(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') id: string,
    @ZodBody(assignLabelsSchema) dto: AssignLabelsDto,
  ): Promise<LabelDto[]> {
    return this.conversationsService.assignLabels(context.workspaceId, id, dto.labelIds);
  }

  @Delete(':id/labels/:labelId')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Remove a label from a conversation' })
  @ApiResponse({ status: 200, description: 'Label removed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Conversation or Label junction not found' })
  async removeLabel(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') id: string,
    @Param('labelId') labelId: string,
  ): Promise<{ success: true }> {
    return this.conversationsService.removeLabel(context.workspaceId, id, labelId);
  }
}
