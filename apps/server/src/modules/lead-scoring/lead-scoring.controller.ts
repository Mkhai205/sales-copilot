import { Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  LeadScoreHistoryItemDto,
  LeadScoreResponseDto,
  ListLeadScoreHistoryQueryDto,
  PaginationMeta,
  RecalculateScoreDto,
  ScoreTriggerEvent,
  WorkspaceRole,
  listLeadScoreHistoryQuerySchema,
  recalculateScoreSchema,
} from '@sales-copilot/shared-contracts';
import { ZodBody, ZodQuery } from '../../common/pipes';
import { CurrentWorkspace, Roles } from '../workspaces/decorators';
import { RolesGuard, WorkspaceGuard } from '../workspaces/guards';
import type { WorkspaceContext } from '../workspaces/types/workspace-context.type';
import { LeadScoringService } from './lead-scoring.service';

@ApiTags('Lead Scoring')
@Controller()
@UseGuards(WorkspaceGuard, RolesGuard)
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Workspace-Id',
  required: false,
  description: 'Target Workspace UUID for tenant resolution (or via path parameter)',
})
export class LeadScoringController {
  constructor(private readonly leadScoringService: LeadScoringService) {}

  @Get(['workspaces/:workspaceId/leads/:leadId/score', 'leads/:leadId/score'])
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'Retrieve the current score and explainability factors for a lead' })
  @ApiResponse({ status: 200, description: 'Current lead score snapshot returned successfully' })
  @ApiResponse({ status: 404, description: 'Lead not found in workspace' })
  async getScore(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('leadId') leadId: string,
  ): Promise<LeadScoreResponseDto> {
    return this.leadScoringService.getScore(context.workspaceId, leadId);
  }

  @Get(['workspaces/:workspaceId/leads/:leadId/score/history', 'leads/:leadId/score/history'])
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'Retrieve paginated immutable audit history of score changes' })
  @ApiResponse({ status: 200, description: 'Paginated lead score history returned successfully' })
  @ApiResponse({ status: 404, description: 'Lead not found in workspace' })
  async getHistory(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('leadId') leadId: string,
    @ZodQuery(listLeadScoreHistoryQuerySchema) query: ListLeadScoreHistoryQueryDto,
  ): Promise<{ items: LeadScoreHistoryItemDto[]; meta: PaginationMeta }> {
    return this.leadScoringService.getHistory(context.workspaceId, leadId, query);
  }

  @Post([
    'workspaces/:workspaceId/leads/:leadId/score/recalculate',
    'leads/:leadId/score/recalculate',
  ])
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Trigger an on-demand synchronous recalculation of the lead score' })
  @ApiResponse({ status: 200, description: 'Lead score recalculated successfully' })
  @ApiResponse({ status: 404, description: 'Lead not found in workspace' })
  async recalculateScore(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('leadId') leadId: string,
    @ZodBody(recalculateScoreSchema) dto?: RecalculateScoreDto,
  ): Promise<LeadScoreResponseDto> {
    return this.leadScoringService.recalculateScore(
      context.workspaceId,
      leadId,
      ScoreTriggerEvent.MANUAL_RECALCULATION,
      dto?.reason || 'Manual recalculation requested by user',
    );
  }
}
