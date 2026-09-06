import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  WorkspaceRole,
  createSalesEvidenceSchema,
  invalidateSalesEvidenceSchema,
  listLeadEvidenceQuerySchema,
  type CreateSalesEvidenceDto,
  type InvalidateSalesEvidenceDto,
  type ListLeadEvidenceQueryDto,
  type PaginationMeta,
  type SalesEvidenceResponseDto,
} from '@sales-copilot/shared-contracts';
import { ZodBody, ZodQuery } from '../../common/pipes';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentWorkspace, Roles } from '../workspaces/decorators';
import { RolesGuard, WorkspaceGuard } from '../workspaces/guards';
import type { WorkspaceContext } from '../workspaces/types/workspace-context.type';
import { SalesEvidenceService } from './sales-evidence.service';

@ApiTags('Sales Evidence')
@Controller()
@UseGuards(WorkspaceGuard, RolesGuard)
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Workspace-Id',
  required: false,
  description: 'Target Workspace UUID for tenant resolution (or via path parameter)',
})
export class SalesEvidenceController {
  constructor(private readonly salesEvidenceService: SalesEvidenceService) {}

  @Post(['workspaces/:workspaceId/sales-evidence', 'sales-evidence'])
  @HttpCode(HttpStatus.CREATED)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({
    summary: 'Record a structured Sales Evidence citation with snippet and confidence',
  })
  @ApiResponse({ status: 201, description: 'Sales evidence recorded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid confidence bounds or message mismatch' })
  @ApiResponse({ status: 404, description: 'Conversation or Message not found in workspace' })
  async recordEvidence(
    @CurrentWorkspace() context: WorkspaceContext,
    @ZodBody(createSalesEvidenceSchema) dto: CreateSalesEvidenceDto,
  ): Promise<SalesEvidenceResponseDto> {
    return this.salesEvidenceService.recordEvidence(context.workspaceId, dto);
  }

  @Get(['workspaces/:workspaceId/leads/:leadId/evidence', 'leads/:leadId/evidence'])
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'Retrieve paginated sales evidence timeline for a lead' })
  @ApiResponse({ status: 200, description: 'List of sales evidence returned' })
  @ApiResponse({ status: 404, description: 'Lead not found in workspace' })
  async listByLead(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('leadId') leadId: string,
    @ZodQuery(listLeadEvidenceQuerySchema) query: ListLeadEvidenceQueryDto,
  ): Promise<{ items: SalesEvidenceResponseDto[]; meta: PaginationMeta }> {
    return this.salesEvidenceService.listByLead(context.workspaceId, leadId, query);
  }

  @Get([
    'workspaces/:workspaceId/conversations/:conversationId/evidence',
    'conversations/:conversationId/evidence',
  ])
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'Retrieve buying signals detected within a conversation' })
  @ApiResponse({ status: 200, description: 'List of conversation sales evidence returned' })
  @ApiResponse({ status: 404, description: 'Conversation not found in workspace' })
  async listByConversation(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('conversationId') conversationId: string,
    @ZodQuery(listLeadEvidenceQuerySchema) query: ListLeadEvidenceQueryDto,
  ): Promise<SalesEvidenceResponseDto[]> {
    return this.salesEvidenceService.listByConversation(context.workspaceId, conversationId, query);
  }

  @Delete(['workspaces/:workspaceId/sales-evidence/:id', 'sales-evidence/:id'])
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Invalidate false-positive AI-detected sales evidence' })
  @ApiResponse({ status: 200, description: 'Evidence marked as invalidated' })
  @ApiResponse({ status: 403, description: 'Forbidden from modifying evidence' })
  @ApiResponse({ status: 404, description: 'Sales evidence not found' })
  async invalidateEvidence(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') id: string,
    @CurrentUser() user: any,
    @ZodBody(invalidateSalesEvidenceSchema) dto?: InvalidateSalesEvidenceDto,
  ): Promise<SalesEvidenceResponseDto> {
    const actorId = user?.userId || user?.id || 'SYSTEM';
    return this.salesEvidenceService.invalidateEvidence(context.workspaceId, id, actorId, dto);
  }
}
