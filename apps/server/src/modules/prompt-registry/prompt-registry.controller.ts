import { Controller, Get, HttpCode, HttpStatus, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  PromptTemplateCreateDto,
  PromptTemplateFilterDto,
  PromptTemplateRenderDto,
  PromptTemplateTestDto,
  PromptTemplateUpdateDto,
  WorkspaceRole,
  promptTemplateCreateSchema,
  promptTemplateFilterSchema,
  promptTemplateRenderSchema,
  promptTemplateTestSchema,
  promptTemplateUpdateSchema,
} from '@sales-copilot/shared-contracts';
import { ZodBody, ZodQuery } from '../../common/pipes';
import { CurrentUser } from '../auth/decorators';
import { CurrentWorkspace, Roles } from '../workspaces/decorators';
import { RolesGuard, WorkspaceGuard } from '../workspaces/guards';
import type { WorkspaceContext } from '../workspaces/types/workspace-context.type';
import { PromptRegistryService } from './prompt-registry.service';
import { LlmGatewayService } from '../llm-gateway/llm-gateway.service';

@ApiTags('Prompt Registry')
@Controller(['workspaces/:workspaceId/prompts', 'prompts'])
@UseGuards(WorkspaceGuard, RolesGuard)
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Workspace-Id',
  required: false,
  description: 'Target Workspace UUID for tenant resolution (or via path parameter)',
})
export class PromptRegistryController {
  constructor(
    private readonly promptRegistryService: PromptRegistryService,
    private readonly llmGatewayService: LlmGatewayService,
  ) {}

  @Get()
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'List all prompt templates for the workspace including presets' })
  @ApiResponse({ status: 200, description: 'List of prompt templates' })
  async listTemplates(
    @CurrentWorkspace() context: WorkspaceContext,
    @ZodQuery(promptTemplateFilterSchema) filter: PromptTemplateFilterDto,
  ): Promise<any[]> {
    return this.promptRegistryService.listTemplates(context.workspaceId, filter);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Create a new prompt template version for the workspace' })
  @ApiResponse({ status: 201, description: 'Template created successfully' })
  async createTemplate(
    @CurrentWorkspace() context: WorkspaceContext,
    @ZodBody(promptTemplateCreateSchema) dto: PromptTemplateCreateDto,
    @CurrentUser('userId') userId?: string,
  ): Promise<any> {
    return this.promptRegistryService.createTemplate(context.workspaceId, dto, userId);
  }

  @Get(':name')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Get active prompt template by name' })
  @ApiResponse({ status: 200, description: 'Template retrieved' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async getTemplate(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('name') name: string,
  ): Promise<any> {
    return this.promptRegistryService.findTemplate(context.workspaceId, name);
  }

  @Put(':id')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Update an existing prompt template' })
  @ApiResponse({ status: 200, description: 'Template updated successfully' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async updateTemplate(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') id: string,
    @ZodBody(promptTemplateUpdateSchema) dto: PromptTemplateUpdateDto,
  ): Promise<any> {
    return this.promptRegistryService.updateTemplate(context.workspaceId, id, dto);
  }

  @Post(':name/render')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Render a template with variables (interpolation test)' })
  @ApiResponse({ status: 200, description: 'Rendered prompt result' })
  async renderPrompt(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('name') name: string,
    @ZodBody(promptTemplateRenderSchema) dto: PromptTemplateRenderDto,
  ): Promise<any> {
    return this.promptRegistryService.renderPrompt(context.workspaceId, name, dto.variables);
  }

  @Post(':name/test')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Execute sandbox inference test with the template and test variables' })
  @ApiResponse({ status: 200, description: 'Inference test output from LLM gateway' })
  async testPrompt(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('name') name: string,
    @ZodBody(promptTemplateTestSchema) dto: PromptTemplateTestDto,
  ): Promise<any> {
    const rendered = await this.promptRegistryService.renderPrompt(
      context.workspaceId,
      name,
      dto.variables,
    );

    const completion = await this.llmGatewayService.generateCompletion({
      workspaceId: context.workspaceId,
      messages: [
        { role: 'system', content: rendered.systemPrompt },
        { role: 'user', content: rendered.userPrompt },
      ],
      options: {
        model: dto.model || rendered.template.model,
        temperature: dto.temperature ?? rendered.template.temperature,
        maxTokens: dto.maxTokens ?? rendered.template.maxTokens,
      },
      preferredProvider: dto.provider || rendered.template.provider,
    });

    return {
      rendered,
      completion,
    };
  }
}
