import {
  Controller,
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
  WorkspaceRole,
  createOpportunitySchema,
  listOpportunitiesQuerySchema,
  pipelineSummaryQuerySchema,
  updateOpportunityStageSchema,
  type CreateOpportunityDto,
  type ListOpportunitiesQueryOutput,
  type OpportunityResponseDto,
  type PaginationMeta,
  type PipelineSummaryQueryOutput,
  type PipelineSummaryResponseDto,
  type UpdateOpportunityStageDto,
} from '@sales-copilot/shared-contracts';
import { ZodBody, ZodQuery } from '../../common/pipes';
import { CurrentWorkspace, Roles } from '../workspaces/decorators';
import { RolesGuard, WorkspaceGuard } from '../workspaces/guards';
import type { WorkspaceContext } from '../workspaces/types/workspace-context.type';
import { OpportunitiesService } from './opportunities.service';

@ApiTags('Opportunities')
@Controller(['workspaces/:workspaceId/opportunities', 'opportunities'])
@UseGuards(WorkspaceGuard, RolesGuard)
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Workspace-Id',
  required: false,
  description: 'Target Workspace UUID for tenant resolution (or via path parameter)',
})
export class OpportunitiesController {
  constructor(private readonly opportunitiesService: OpportunitiesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Create a new Opportunity in the sales pipeline' })
  @ApiResponse({ status: 201, description: 'Opportunity created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed or assignee not in workspace' })
  @ApiResponse({ status: 404, description: 'Contact or Lead not found in workspace' })
  async createOpportunity(
    @CurrentWorkspace() context: WorkspaceContext,
    @ZodBody(createOpportunitySchema) dto: CreateOpportunityDto,
  ): Promise<OpportunityResponseDto> {
    return this.opportunitiesService.createOpportunity(context.workspaceId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'List and filter opportunities in the workspace' })
  @ApiResponse({ status: 200, description: 'Opportunities retrieved successfully' })
  async listOpportunities(
    @CurrentWorkspace() context: WorkspaceContext,
    @ZodQuery(listOpportunitiesQuerySchema) query: ListOpportunitiesQueryOutput,
  ): Promise<{ items: OpportunityResponseDto[]; meta: PaginationMeta }> {
    return this.opportunitiesService.findAll(context.workspaceId, query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'Get details of a single Opportunity by ID' })
  @ApiResponse({ status: 200, description: 'Opportunity retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Opportunity not found' })
  async getOpportunityById(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') id: string,
  ): Promise<OpportunityResponseDto> {
    return this.opportunitiesService.findById(context.workspaceId, id);
  }

  @Patch(':id/stage')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Update opportunity stage, recalculating win probability' })
  @ApiResponse({ status: 200, description: 'Stage updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed (e.g. missing lostReason)' })
  @ApiResponse({ status: 403, description: 'Closed deals cannot be modified by non-admin' })
  @ApiResponse({ status: 404, description: 'Opportunity not found' })
  async updateStage(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') id: string,
    @ZodBody(updateOpportunityStageSchema) dto: UpdateOpportunityStageDto,
  ): Promise<OpportunityResponseDto> {
    return this.opportunitiesService.updateStage(
      context.workspaceId,
      id,
      dto,
      context.role as WorkspaceRole,
    );
  }
}

@ApiTags('Pipeline')
@Controller(['workspaces/:workspaceId/pipeline', 'pipeline'])
@UseGuards(WorkspaceGuard, RolesGuard)
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Workspace-Id',
  required: false,
  description: 'Target Workspace UUID for tenant resolution (or via path parameter)',
})
export class PipelineController {
  constructor(private readonly opportunitiesService: OpportunitiesService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'Get aggregated sales pipeline summary report' })
  @ApiResponse({ status: 200, description: 'Pipeline summary retrieved successfully' })
  async getPipelineSummary(
    @CurrentWorkspace() context: WorkspaceContext,
    @ZodQuery(pipelineSummaryQuerySchema) query: PipelineSummaryQueryOutput,
  ): Promise<PipelineSummaryResponseDto> {
    return this.opportunitiesService.getPipelineSummary(context.workspaceId, query);
  }
}
