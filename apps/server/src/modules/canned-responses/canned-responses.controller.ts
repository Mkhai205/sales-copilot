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
  CannedResponseDto,
  CannedResponseListQueryDto,
  cannedResponseListQuerySchema,
  CreateCannedResponseDto,
  createCannedResponseSchema,
  UpdateCannedResponseDto,
  updateCannedResponseSchema,
  WorkspaceRole,
} from '@sales-copilot/shared-contracts';
import { ZodBody, ZodQuery } from '../../common/pipes';
import { CurrentWorkspace, Roles } from '../workspaces/decorators';
import { RolesGuard, WorkspaceGuard } from '../workspaces/guards';
import type { WorkspaceContext } from '../workspaces/types/workspace-context.type';
import { CannedResponsesService } from './canned-responses.service';

@ApiTags('Canned Responses')
@Controller('canned-responses')
@UseGuards(WorkspaceGuard, RolesGuard)
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Workspace-Id',
  required: true,
  description: 'Target Workspace UUID for tenant resolution',
})
export class CannedResponsesController {
  constructor(private readonly cannedResponsesService: CannedResponsesService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'List all canned responses in the workspace with optional search' })
  @ApiResponse({ status: 200, description: 'Canned responses retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Missing X-Workspace-Id header or invalid query' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async list(
    @CurrentWorkspace() context: WorkspaceContext,
    @ZodQuery(cannedResponseListQuerySchema) query?: CannedResponseListQueryDto,
  ): Promise<CannedResponseDto[]> {
    return this.cannedResponsesService.list(context.workspaceId, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Create a new canned response in the workspace' })
  @ApiResponse({ status: 201, description: 'Canned response created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed or invalid shortcode/content' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Insufficient permissions' })
  @ApiResponse({ status: 409, description: 'Canned response with this shortcode already exists' })
  async create(
    @CurrentWorkspace() context: WorkspaceContext,
    @ZodBody(createCannedResponseSchema) dto: CreateCannedResponseDto,
  ): Promise<CannedResponseDto> {
    return this.cannedResponsesService.create(context.workspaceId, dto);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'Get a canned response detail by ID' })
  @ApiResponse({ status: 200, description: 'Canned response detail retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Canned response not found' })
  async getById(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') id: string,
  ): Promise<CannedResponseDto> {
    return this.cannedResponsesService.getById(context.workspaceId, id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Update a canned response in the workspace' })
  @ApiResponse({ status: 200, description: 'Canned response updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Canned response not found' })
  @ApiResponse({
    status: 409,
    description: 'Canned response with updated shortcode already exists',
  })
  async update(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') id: string,
    @ZodBody(updateCannedResponseSchema) dto: UpdateCannedResponseDto,
  ): Promise<CannedResponseDto> {
    return this.cannedResponsesService.update(context.workspaceId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Delete a canned response from the workspace' })
  @ApiResponse({ status: 200, description: 'Canned response deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Canned response not found' })
  async delete(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    return this.cannedResponsesService.delete(context.workspaceId, id);
  }
}
