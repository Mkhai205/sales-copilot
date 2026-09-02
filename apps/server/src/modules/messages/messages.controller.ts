import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateMessageDto,
  createMessageSchema,
  MessageListQueryDto,
  messageListQuerySchema,
  MessageResponseDto,
  PaginationMeta,
  UpdateDeliveryStatusDto,
  updateDeliveryStatusSchema,
  SenderType,
  WorkspaceRole,
} from '@sales-copilot/shared-contracts';
import { ZodQuery } from '../../common/pipes';
import { CurrentUser } from '../auth/decorators';
import type { JwtUserPayload } from '../auth/types/jwt-payload.type';
import { CurrentWorkspace, Roles } from '../workspaces/decorators';
import { RolesGuard, WorkspaceGuard } from '../workspaces/guards';
import type { WorkspaceContext } from '../workspaces/types/workspace-context.type';
import type { UploadedFile } from './attachments.service';
import { MessagesService } from './messages.service';

@ApiTags('Messages')
@Controller()
@UseGuards(WorkspaceGuard, RolesGuard)
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Workspace-Id',
  required: true,
  description: 'Target Workspace UUID for tenant resolution',
})
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('conversations/:conversationId/messages')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'List all messages for a specific conversation' })
  @ApiResponse({ status: 200, description: 'Messages list retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async list(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('conversationId') conversationId: string,
    @ZodQuery(messageListQuerySchema) query?: MessageListQueryDto,
  ): Promise<{ items: MessageResponseDto[]; meta: PaginationMeta }> {
    const isAgent = context.role !== WorkspaceRole.VIEWER;
    return this.messagesService.list(context.workspaceId, conversationId, query, isAgent);
  }

  @Post('conversations/:conversationId/messages')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @UseInterceptors(FilesInterceptor('attachments'))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({ summary: 'Send or create a new message in a conversation' })
  @ApiResponse({ status: 201, description: 'Message created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed or invalid sender' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async create(
    @CurrentWorkspace() context: WorkspaceContext,
    @CurrentUser() user: JwtUserPayload,
    @Param('conversationId') conversationId: string,
    @Body() body: any,
    @UploadedFiles() files?: UploadedFile[],
  ): Promise<MessageResponseDto> {
    // If multipart/form-data, parse boolean / json strings
    const payload = typeof body === 'object' && body !== null ? { ...body } : {};

    if (typeof payload.isPrivate === 'string') {
      payload.isPrivate = payload.isPrivate === 'true';
    }

    if (typeof payload.metadata === 'string') {
      try {
        payload.metadata = JSON.parse(payload.metadata);
      } catch {
        // keep as is
      }
    }

    if (typeof payload.attachments === 'string') {
      try {
        payload.attachments = JSON.parse(payload.attachments);
      } catch {
        // keep as is
      }
    }

    // In authenticated endpoints, force senderId to authenticated user ID for USER sender type to prevent impersonation
    if (user?.userId) {
      if (payload.senderType === SenderType.USER || !payload.senderType) {
        payload.senderId = user.userId;
      }
    }

    const validatedDto: CreateMessageDto = createMessageSchema.parse(payload);

    return this.messagesService.create(
      context.workspaceId,
      conversationId,
      validatedDto,
      files,
      undefined,
      user?.userId,
    );
  }

  @Get('messages/:id')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'Get message details by ID' })
  @ApiResponse({ status: 200, description: 'Message detail retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  async getById(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') id: string,
  ): Promise<MessageResponseDto> {
    const isAgent = context.role !== WorkspaceRole.VIEWER;
    return this.messagesService.getById(context.workspaceId, id, isAgent);
  }

  @Patch('messages/:id/delivery-status')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Update message delivery status' })
  @ApiResponse({ status: 200, description: 'Delivery status updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid delivery status' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  async updateDeliveryStatus(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') id: string,
    @Body() body: any,
  ): Promise<MessageResponseDto> {
    const validatedDto: UpdateDeliveryStatusDto = updateDeliveryStatusSchema.parse(body);
    return this.messagesService.updateDeliveryStatus(context.workspaceId, id, validatedDto);
  }

  @Delete('messages/:id')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Delete a message and its attachments' })
  @ApiResponse({ status: 200, description: 'Message deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  async delete(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    return this.messagesService.delete(context.workspaceId, id);
  }
}
