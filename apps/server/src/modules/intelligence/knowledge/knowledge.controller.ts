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
  CreateKnowledgeArticleDto,
  createKnowledgeArticleSchema,
  KnowledgeArticleDto,
  KnowledgeArticleListResponseDto,
  KnowledgeArticleQueryDto,
  knowledgeArticleQuerySchema,
  TestSearchKnowledgeDto,
  testSearchKnowledgeSchema,
  TestSearchResultDto,
  UpdateKnowledgeArticleDto,
  updateKnowledgeArticleSchema,
  WorkspaceRole,
} from '@sales-copilot/shared-contracts';
import { ZodBody, ZodQuery } from '../../../common/pipes/zod-schema-validation.pipe';
import { CurrentWorkspace } from '../../identity/workspaces/decorators/current-workspace.decorator';
import { Roles } from '../../identity/workspaces/decorators/roles.decorator';
import { RolesGuard } from '../../identity/workspaces/guards/roles.guard';
import { WorkspaceGuard } from '../../identity/workspaces/guards/workspace.guard';
import type { WorkspaceContext } from '../../identity/workspaces/types/workspace-context.type';
import { KnowledgeService } from './knowledge.service';

@ApiTags('Knowledge Articles')
@Controller('knowledge-articles')
@UseGuards(WorkspaceGuard, RolesGuard)
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Workspace-Id',
  required: true,
  description: 'Target Workspace UUID for tenant resolution',
})
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'List knowledge articles in the workspace with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Knowledge articles retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Missing X-Workspace-Id header or invalid query' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async list(
    @CurrentWorkspace() context: WorkspaceContext,
    @ZodQuery(knowledgeArticleQuerySchema) query?: KnowledgeArticleQueryDto,
  ): Promise<KnowledgeArticleListResponseDto> {
    return this.knowledgeService.list(context.workspaceId, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Create a new knowledge article' })
  @ApiResponse({ status: 201, description: 'Knowledge article created and queued for embedding' })
  @ApiResponse({ status: 400, description: 'Validation failed or article limit reached' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Insufficient permissions' })
  async create(
    @CurrentWorkspace() context: WorkspaceContext,
    @ZodBody(createKnowledgeArticleSchema) dto: CreateKnowledgeArticleDto,
  ): Promise<KnowledgeArticleDto> {
    return this.knowledgeService.create(context.workspaceId, dto);
  }

  @Post('test-search')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Test vector similarity search against active knowledge articles' })
  @ApiResponse({ status: 200, description: 'Vector search results with similarity scores' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async testSearch(
    @CurrentWorkspace() context: WorkspaceContext,
    @ZodBody(testSearchKnowledgeSchema) dto: TestSearchKnowledgeDto,
  ): Promise<TestSearchResultDto[]> {
    return this.knowledgeService.searchSimilar(
      context.workspaceId,
      dto.query,
      dto.minSimilarity !== undefined ? Number(dto.minSimilarity) : undefined,
      dto.limit !== undefined ? Number(dto.limit) : undefined,
    );
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Get knowledge article details by ID' })
  @ApiResponse({ status: 200, description: 'Knowledge article details retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Knowledge article not found' })
  async getById(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') id: string,
  ): Promise<KnowledgeArticleDto> {
    return this.knowledgeService.getById(context.workspaceId, id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Update a knowledge article' })
  @ApiResponse({ status: 200, description: 'Knowledge article updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Knowledge article not found' })
  async update(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') id: string,
    @ZodBody(updateKnowledgeArticleSchema) dto: UpdateKnowledgeArticleDto,
  ): Promise<KnowledgeArticleDto> {
    return this.knowledgeService.update(context.workspaceId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Delete a knowledge article' })
  @ApiResponse({ status: 200, description: 'Knowledge article deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Knowledge article not found' })
  async delete(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    return this.knowledgeService.delete(context.workspaceId, id);
  }

  @Post(':id/reindex')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Trigger manual re-indexing of article vector embedding' })
  @ApiResponse({ status: 200, description: 'Article queued for re-indexing' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Knowledge article not found' })
  async reindex(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') id: string,
  ): Promise<KnowledgeArticleDto> {
    return this.knowledgeService.reindex(context.workspaceId, id);
  }
}
