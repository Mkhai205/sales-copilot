import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateInboxDto,
  createInboxSchema,
  InboxDetailDto,
  InboxDto,
  UpdateInboxDto,
  updateInboxSchema,
  WorkspaceRole,
} from '@sales-copilot/shared-contracts';
import { ZodBody } from '../../../common/pipes';
import { CurrentWorkspace, Roles } from '../../identity/workspaces/decorators';
import { RolesGuard, WorkspaceGuard } from '../../identity/workspaces/guards';
import type { WorkspaceContext } from '../../identity/workspaces/types/workspace-context.type';
import { InboxesService } from './inboxes.service';

@ApiTags('Inboxes')
@Controller('inboxes')
@UseGuards(WorkspaceGuard, RolesGuard)
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Workspace-Id',
  required: true,
  description: 'Target Workspace UUID for tenant resolution',
})
export class InboxesController {
  constructor(private readonly inboxesService: InboxesService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'List all inboxes in the workspace (credentials omitted)' })
  @ApiResponse({ status: 200, description: 'Inboxes list retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Missing X-Workspace-Id header' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async listInboxes(@CurrentWorkspace() context: WorkspaceContext): Promise<InboxDto[]> {
    return this.inboxesService.listInboxes(context.workspaceId);
  }

  @Post('upload-avatar')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload an inbox avatar image to MinIO storage' })
  @ApiResponse({ status: 200, description: 'Avatar uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file or format' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async uploadAvatar(
    @CurrentWorkspace() context: WorkspaceContext,
    @UploadedFile() file: any,
  ): Promise<{ avatarUrl: string }> {
    return this.inboxesService.uploadAvatar(context.workspaceId, file);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Create a new Inbox and 1:1 linked Channel in the workspace' })
  @ApiResponse({ status: 201, description: 'Inbox and channel created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Insufficient permissions' })
  @ApiResponse({ status: 409, description: 'Channel with provider account ID already exists' })
  async createInbox(
    @CurrentWorkspace() context: WorkspaceContext,
    @ZodBody(createInboxSchema) dto: CreateInboxDto,
  ): Promise<InboxDetailDto> {
    return this.inboxesService.createInbox(context.workspaceId, dto);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'Get detailed inbox information with masked credentials' })
  @ApiResponse({ status: 200, description: 'Inbox details retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Inbox not found' })
  async getInbox(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') inboxId: string,
  ): Promise<InboxDetailDto> {
    return this.inboxesService.getInboxById(context.workspaceId, inboxId);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Update inbox configuration and channel settings' })
  @ApiResponse({ status: 200, description: 'Inbox updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Inbox not found' })
  @ApiResponse({ status: 409, description: 'Channel provider account ID conflict' })
  async updateInbox(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') inboxId: string,
    @ZodBody(updateInboxSchema) dto: UpdateInboxDto,
  ): Promise<InboxDetailDto> {
    return this.inboxesService.updateInbox(context.workspaceId, inboxId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Delete an inbox and cascade delete linked channel' })
  @ApiResponse({ status: 200, description: 'Inbox deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Inbox not found' })
  async deleteInbox(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') inboxId: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.inboxesService.deleteInbox(context.workspaceId, inboxId);
  }
}
