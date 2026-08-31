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
  CreateLabelDto,
  createLabelSchema,
  LabelDto,
  LabelListQueryDto,
  labelListQuerySchema,
  UpdateLabelDto,
  updateLabelSchema,
  WorkspaceRole,
} from '@sales-copilot/shared-contracts';
import { ZodBody, ZodQuery } from '../../common/pipes';
import { CurrentWorkspace, Roles } from '../workspaces/decorators';
import { RolesGuard, WorkspaceGuard } from '../workspaces/guards';
import type { WorkspaceContext } from '../workspaces/types/workspace-context.type';
import { LabelsService } from './labels.service';

@ApiTags('Labels')
@Controller('labels')
@UseGuards(WorkspaceGuard, RolesGuard)
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Workspace-Id',
  required: true,
  description: 'Target Workspace UUID for tenant resolution',
})
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'List all labels in the workspace' })
  @ApiResponse({ status: 200, description: 'Labels list retrieved successfully' })
  @ApiResponse({
    status: 400,
    description: 'Missing X-Workspace-Id header or invalid query params',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async list(
    @CurrentWorkspace() context: WorkspaceContext,
    @ZodQuery(labelListQuerySchema) query?: LabelListQueryDto,
  ): Promise<LabelDto[]> {
    return this.labelsService.list(context.workspaceId, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Create a new label in the workspace' })
  @ApiResponse({ status: 201, description: 'Label created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Insufficient permissions' })
  @ApiResponse({
    status: 409,
    description: 'Label with this title already exists in the workspace',
  })
  async create(
    @CurrentWorkspace() context: WorkspaceContext,
    @ZodBody(createLabelSchema) dto: CreateLabelDto,
  ): Promise<LabelDto> {
    return this.labelsService.create(context.workspaceId, dto);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'Get a label by ID in the workspace' })
  @ApiResponse({ status: 200, description: 'Label detail retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Label not found' })
  async getById(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') id: string,
  ): Promise<LabelDto> {
    return this.labelsService.getById(context.workspaceId, id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Update a label in the workspace' })
  @ApiResponse({ status: 200, description: 'Label updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Label not found' })
  @ApiResponse({ status: 409, description: 'Label with updated title already exists' })
  async update(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') id: string,
    @ZodBody(updateLabelSchema) dto: UpdateLabelDto,
  ): Promise<LabelDto> {
    return this.labelsService.update(context.workspaceId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Delete a label from the workspace' })
  @ApiResponse({ status: 200, description: 'Label deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Label not found' })
  async delete(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    return this.labelsService.delete(context.workspaceId, id);
  }
}
