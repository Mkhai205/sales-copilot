import { Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  CopilotMetricsDto,
  CopilotSuggestionDto,
  ResolveSuggestionDto,
  StreamReplyDraftDto,
  SuggestionStatus,
  TriggerCopilotGenerationDto,
  WorkspaceRole,
  resolveSuggestionSchema,
  streamReplyDraftSchema,
  triggerCopilotGenerationSchema,
} from '@sales-copilot/shared-contracts';
import { ZodBody } from '../../common/pipes';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentWorkspace, Roles } from '../workspaces/decorators';
import { RolesGuard, WorkspaceGuard } from '../workspaces/guards';
import type { WorkspaceContext } from '../workspaces/types/workspace-context.type';
import { CopilotContextService } from './copilot-context.service';
import { CopilotEngineService } from './copilot-engine.service';
import { CopilotService } from './copilot.service';

@ApiTags('Sales Copilot')
@Controller()
@UseGuards(WorkspaceGuard, RolesGuard)
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Workspace-Id',
  required: false,
  description: 'Target Workspace UUID for tenant resolution (or via path parameter)',
})
export class CopilotController {
  constructor(
    private readonly copilotService: CopilotService,
    private readonly contextService: CopilotContextService,
    private readonly engineService: CopilotEngineService,
  ) {}

  @Get([
    'workspaces/:workspaceId/copilot/conversations/:conversationId/suggestions',
    'copilot/conversations/:conversationId/suggestions',
  ])
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'Get active pending Copilot suggestions for a conversation' })
  @ApiResponse({ status: 200, description: 'Active suggestions returned' })
  async getSuggestions(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('conversationId') conversationId: string,
  ): Promise<CopilotSuggestionDto[]> {
    return this.copilotService.getPendingSuggestions(context.workspaceId, conversationId);
  }

  @Post([
    'workspaces/:workspaceId/copilot/conversations/:conversationId/generate',
    'copilot/conversations/:conversationId/generate',
  ])
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Manually trigger Copilot suggestions generation for a conversation' })
  @ApiResponse({ status: 200, description: 'Suggestions generated and saved' })
  async generateSuggestions(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('conversationId') conversationId: string,
    @ZodBody(triggerCopilotGenerationSchema) dto: TriggerCopilotGenerationDto,
  ): Promise<CopilotSuggestionDto[]> {
    const copilotContext = await this.contextService.buildContext(
      context.workspaceId,
      conversationId,
      dto.messageId,
    );

    const generated = await this.engineService.generateStructuredSuggestions(copilotContext);

    return this.copilotService.createSuggestions(context.workspaceId, conversationId, generated, {
      messageId: dto.messageId,
      leadId: copilotContext.leadId || undefined,
    });
  }

  @Post([
    'workspaces/:workspaceId/copilot/conversations/:conversationId/stream-reply',
    'copilot/conversations/:conversationId/stream-reply',
  ])
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Stream reply draft over WebSocket for a conversation' })
  @ApiResponse({ status: 200, description: 'Streaming completed' })
  async streamReplyDraft(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('conversationId') conversationId: string,
    @ZodBody(streamReplyDraftSchema) dto: StreamReplyDraftDto,
  ): Promise<{ status: string; content: string }> {
    const copilotContext = await this.contextService.buildContext(
      context.workspaceId,
      conversationId,
    );

    const content = await this.engineService.streamReplyDraft(
      copilotContext,
      dto.customInstruction,
    );

    return { status: 'completed', content };
  }

  @Post([
    'workspaces/:workspaceId/copilot/suggestions/:id/accept',
    'copilot/suggestions/:id/accept',
  ])
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Mark Copilot suggestion as accepted' })
  @ApiResponse({ status: 200, description: 'Suggestion marked as ACCEPTED' })
  async acceptSuggestion(
    @CurrentWorkspace() context: WorkspaceContext,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ): Promise<CopilotSuggestionDto> {
    return this.copilotService.resolveSuggestion(
      context.workspaceId,
      id,
      SuggestionStatus.ACCEPTED,
      user?.id || user?.userId,
    );
  }

  @Post([
    'workspaces/:workspaceId/copilot/suggestions/:id/dismiss',
    'copilot/suggestions/:id/dismiss',
  ])
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Dismiss Copilot suggestion with optional reason' })
  @ApiResponse({ status: 200, description: 'Suggestion marked as DISMISSED' })
  async dismissSuggestion(
    @CurrentWorkspace() context: WorkspaceContext,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @ZodBody(resolveSuggestionSchema) dto: ResolveSuggestionDto,
  ): Promise<CopilotSuggestionDto> {
    return this.copilotService.resolveSuggestion(
      context.workspaceId,
      id,
      SuggestionStatus.DISMISSED,
      user?.id || user?.userId,
      dto.reason,
    );
  }

  @Post(['workspaces/:workspaceId/copilot/suggestions/:id/apply', 'copilot/suggestions/:id/apply'])
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Apply Copilot suggestion into composer or execute action' })
  @ApiResponse({ status: 200, description: 'Suggestion marked as APPLIED' })
  async applySuggestion(
    @CurrentWorkspace() context: WorkspaceContext,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ): Promise<CopilotSuggestionDto> {
    return this.copilotService.resolveSuggestion(
      context.workspaceId,
      id,
      SuggestionStatus.APPLIED,
      user?.id || user?.userId,
    );
  }

  @Get(['workspaces/:workspaceId/copilot/metrics', 'copilot/metrics'])
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'Retrieve Copilot adoption and resolution metrics' })
  @ApiResponse({ status: 200, description: 'Copilot metrics returned' })
  async getMetrics(@CurrentWorkspace() context: WorkspaceContext): Promise<CopilotMetricsDto> {
    return this.copilotService.getMetrics(context.workspaceId);
  }
}
