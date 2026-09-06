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
  convertLeadSchema,
  createLeadSchema,
  listLeadsQuerySchema,
  updateLeadSchema,
  type ConvertLeadOutput,
  type CreateLeadDto,
  type LeadResponseDto,
  type ListLeadsQueryOutput,
  type PaginationMeta,
  type UpdateLeadDto,
} from '@sales-copilot/shared-contracts';
import { ZodBody, ZodQuery } from '../../common/pipes';
import { CurrentWorkspace, Roles } from '../workspaces/decorators';
import { RolesGuard, WorkspaceGuard } from '../workspaces/guards';
import type { WorkspaceContext } from '../workspaces/types/workspace-context.type';
import { LeadConversionService, type ConvertLeadResult } from './lead-conversion.service';
import { LeadsService } from './leads.service';

@ApiTags('Leads')
@Controller(['workspaces/:workspaceId/leads', 'leads'])
@UseGuards(WorkspaceGuard, RolesGuard)
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Workspace-Id',
  required: false,
  description: 'Target Workspace UUID for tenant resolution (or via path parameter)',
})
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly leadConversionService: LeadConversionService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Create a new Lead for a Contact within the workspace' })
  @ApiResponse({ status: 201, description: 'Lead created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed or assignee outside workspace' })
  @ApiResponse({ status: 404, description: 'Contact not found in workspace' })
  @ApiResponse({ status: 409, description: 'Lead already exists for contact' })
  async createLead(
    @CurrentWorkspace() context: WorkspaceContext,
    @ZodBody(createLeadSchema) dto: CreateLeadDto,
  ): Promise<LeadResponseDto> {
    return this.leadsService.createLead(context.workspaceId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'List and filter leads in the workspace' })
  @ApiResponse({ status: 200, description: 'Leads retrieved successfully' })
  async listLeads(
    @CurrentWorkspace() context: WorkspaceContext,
    @ZodQuery(listLeadsQuerySchema) query: ListLeadsQueryOutput,
  ): Promise<{ items: LeadResponseDto[]; meta: PaginationMeta }> {
    return this.leadsService.findAll(context.workspaceId, query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'Get details of a single Lead by ID' })
  @ApiResponse({ status: 200, description: 'Lead retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  async getLeadById(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') id: string,
  ): Promise<LeadResponseDto> {
    return this.leadsService.findById(context.workspaceId, id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Update status, stage, assignee or metadata of a Lead' })
  @ApiResponse({ status: 200, description: 'Lead updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid status transition or assignee' })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  @ApiResponse({ status: 409, description: 'Lead has already been converted' })
  async updateLead(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') id: string,
    @ZodBody(updateLeadSchema) dto: UpdateLeadDto,
  ): Promise<LeadResponseDto> {
    return this.leadsService.updateLead(context.workspaceId, id, dto);
  }

  @Post(':id/convert')
  @HttpCode(HttpStatus.CREATED)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Convert an active Lead into an Opportunity' })
  @ApiResponse({ status: 201, description: 'Lead converted into Opportunity successfully' })
  @ApiResponse({ status: 400, description: 'Invalid conversion parameters' })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  @ApiResponse({ status: 409, description: 'Lead has already been converted' })
  async convertLead(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') id: string,
    @ZodBody(convertLeadSchema) dto: ConvertLeadOutput,
  ): Promise<ConvertLeadResult> {
    return this.leadConversionService.convertLead(context.workspaceId, id, dto);
  }
}
