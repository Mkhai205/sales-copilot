import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DomainEvent,
  OpportunityResponseDto,
  OpportunityStage,
  PipelineStageSummaryDto,
  PipelineSummaryResponseDto,
  STAGE_DEFAULT_PROBABILITIES,
  WorkspaceRole,
  type CreateOpportunityDto,
  type ListOpportunitiesQueryDto,
  type ListOpportunitiesQueryOutput,
  type PaginationMeta,
  type PipelineSummaryQueryDto,
  type PipelineSummaryQueryOutput,
  type UpdateOpportunityStageDto,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { formatOpportunityResponse } from '../leads/lead-conversion.service';

@Injectable()
export class OpportunitiesService {
  private readonly logger = new Logger(OpportunitiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Creates a new Opportunity scoped to workspace.
   */
  async createOpportunity(
    workspaceId: string,
    dto: CreateOpportunityDto,
  ): Promise<OpportunityResponseDto> {
    const client = this.prisma.getClient();

    // 1. Verify contact exists in workspace
    const contact = await client.contact.findFirst({
      where: { id: dto.contactId, workspaceId },
    });
    if (!contact) {
      throw new NotFoundException({
        code: 'CONTACT_NOT_FOUND',
        message: 'Contact not found in this workspace',
        details: { contactId: dto.contactId, workspaceId },
      });
    }

    // 2. Verify lead if associated
    if (dto.leadId) {
      const lead = await client.lead.findFirst({
        where: { id: dto.leadId, workspaceId },
      });
      if (!lead) {
        throw new NotFoundException({
          code: 'LEAD_NOT_FOUND',
          message: 'Lead not found in this workspace',
          details: { leadId: dto.leadId, workspaceId },
        });
      }
    }

    // 3. Verify assignee if provided
    if (dto.assignedUserId) {
      const member = await client.workspaceMember.findFirst({
        where: { workspaceId, userId: dto.assignedUserId },
      });
      if (!member) {
        throw new BadRequestException({
          code: 'ASSIGNEE_NOT_IN_WORKSPACE',
          message: 'Assigned user is not a member of this workspace',
          details: { assignedUserId: dto.assignedUserId, workspaceId },
        });
      }
    }

    const stage = dto.stage || OpportunityStage.PROSPECTING;
    const probability =
      dto.probability !== undefined ? dto.probability : (STAGE_DEFAULT_PROBABILITIES[stage] ?? 50);

    const opportunity = await client.opportunity.create({
      data: {
        workspaceId,
        contactId: dto.contactId,
        leadId: dto.leadId || null,
        title: dto.title,
        stage,
        amount: dto.amount,
        currency: dto.currency || 'USD',
        probability,
        expectedCloseDate: dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : null,
        assignedUserId: dto.assignedUserId || null,
        metadata: dto.metadata || {},
      },
      include: {
        contact: {
          select: { id: true, name: true, email: true, phoneNumber: true, avatarUrl: true },
        },
        lead: {
          select: { id: true, status: true, stage: true, score: true },
        },
        assignedUser: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    const response = formatOpportunityResponse(opportunity);

    this.eventEmitter.emit(DomainEvent.OPPORTUNITY_CREATED, {
      workspaceId,
      opportunityId: opportunity.id,
      leadId: opportunity.leadId,
      contactId: opportunity.contactId,
      stage: opportunity.stage,
      amount: Number(opportunity.amount),
      currency: opportunity.currency,
      assignedUserId: opportunity.assignedUserId,
      opportunity: response,
    });

    return response;
  }

  /**
   * Retrieves paginated opportunities with stage/assignee filtering.
   */
  async findAll(
    workspaceId: string,
    query: ListOpportunitiesQueryOutput | ListOpportunitiesQueryDto,
  ): Promise<{ items: OpportunityResponseDto[]; meta: PaginationMeta }> {
    const client = this.prisma.getClient();
    const where: any = { workspaceId };

    if (query.stage) {
      where.stage = query.stage;
    }
    if (query.assignedUserId) {
      where.assignedUserId = query.assignedUserId;
    }
    if (query.startDate || query.endDate) {
      where.expectedCloseDate = {};
      if (query.startDate) where.expectedCloseDate.gte = new Date(query.startDate);
      if (query.endDate) where.expectedCloseDate.lte = new Date(query.endDate);
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const skip = (page - 1) * limit;
    const take = limit;
    const orderBy = { [sortBy]: sortOrder };

    const [total, opportunities] = await Promise.all([
      client.opportunity.count({ where }),
      client.opportunity.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          contact: {
            select: { id: true, name: true, email: true, phoneNumber: true, avatarUrl: true },
          },
          lead: {
            select: { id: true, status: true, stage: true, score: true },
          },
          assignedUser: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      }),
    ]);

    const items = opportunities.map((opp: any) => formatOpportunityResponse(opp));

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + items.length < total,
      },
    };
  }

  /**
   * Retrieves single opportunity by ID.
   */
  async findById(workspaceId: string, id: string): Promise<OpportunityResponseDto> {
    const client = this.prisma.getClient();
    const opportunity = await client.opportunity.findFirst({
      where: { id, workspaceId },
      include: {
        contact: {
          select: { id: true, name: true, email: true, phoneNumber: true, avatarUrl: true },
        },
        lead: {
          select: { id: true, status: true, stage: true, score: true },
        },
        assignedUser: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    if (!opportunity) {
      throw new NotFoundException({
        code: 'OPPORTUNITY_NOT_FOUND',
        message: 'Opportunity not found',
        details: { id, workspaceId },
      });
    }

    return formatOpportunityResponse(opportunity);
  }

  /**
   * Updates opportunity stage with probability recalculation and closed deal governance.
   */
  async updateStage(
    workspaceId: string,
    id: string,
    dto: UpdateOpportunityStageDto,
    userRole?: WorkspaceRole,
  ): Promise<OpportunityResponseDto> {
    const client = this.prisma.getClient();

    const existing = await client.opportunity.findFirst({
      where: { id, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'OPPORTUNITY_NOT_FOUND',
        message: 'Opportunity not found',
        details: { id, workspaceId },
      });
    }

    // Governance: Closed deals are immutable to regular agents, only ADMIN or OWNER can edit
    const isCurrentlyClosed =
      existing.stage === OpportunityStage.CLOSED_WON ||
      existing.stage === OpportunityStage.CLOSED_LOST;

    if (
      isCurrentlyClosed &&
      userRole &&
      userRole !== WorkspaceRole.OWNER &&
      userRole !== WorkspaceRole.ADMIN
    ) {
      throw new ForbiddenException({
        code: 'CLOSED_DEAL_IMMUTABLE',
        message: 'Only workspace administrators or owners can modify an already closed deal',
        details: { id, currentStage: existing.stage },
      });
    }

    const updateData: any = {
      stage: dto.stage,
      updatedAt: new Date(),
    };

    if (dto.stage === OpportunityStage.CLOSED_LOST) {
      if (!dto.lostReason || dto.lostReason.trim().length < 5) {
        throw new BadRequestException({
          code: 'LOST_REASON_REQUIRED',
          message:
            'lostReason is required and must have at least 5 characters when stage is CLOSED_LOST',
        });
      }
      updateData.probability = 0;
      updateData.actualCloseDate = new Date();
      updateData.lostReason = dto.lostReason.trim();
    } else if (dto.stage === OpportunityStage.CLOSED_WON) {
      updateData.probability = 100;
      updateData.actualCloseDate = new Date();
      updateData.lostReason = null;
    } else {
      // Re-opening or progressing in pipeline
      updateData.actualCloseDate = null;
      updateData.lostReason = null;
      updateData.probability =
        dto.probability !== undefined
          ? dto.probability
          : (STAGE_DEFAULT_PROBABILITIES[dto.stage] ?? 50);
    }

    const updated = await client.opportunity.update({
      where: { id },
      data: updateData,
      include: {
        contact: {
          select: { id: true, name: true, email: true, phoneNumber: true, avatarUrl: true },
        },
        lead: {
          select: { id: true, status: true, stage: true, score: true },
        },
        assignedUser: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    const response = formatOpportunityResponse(updated);

    this.eventEmitter.emit(DomainEvent.OPPORTUNITY_STAGE_UPDATED, {
      workspaceId,
      opportunityId: updated.id,
      stage: updated.stage,
      previousStage: existing.stage,
      lostReason: updated.lostReason,
      opportunity: response,
    });

    return response;
  }

  /**
   * Generates pipeline summary report aggregating deals by stage, computing weighted revenue.
   */
  async getPipelineSummary(
    workspaceId: string,
    query?: PipelineSummaryQueryOutput | PipelineSummaryQueryDto,
  ): Promise<PipelineSummaryResponseDto> {
    const client = this.prisma.getClient();
    const currency = query?.currency || 'USD';

    const where: any = {
      workspaceId,
      currency,
    };

    if (query?.assignedUserId) {
      where.assignedUserId = query.assignedUserId;
    }

    const deals = await client.opportunity.findMany({
      where,
      select: {
        id: true,
        stage: true,
        amount: true,
        probability: true,
      },
    });

    const allStages: OpportunityStage[] = [
      OpportunityStage.PROSPECTING,
      OpportunityStage.QUALIFICATION,
      OpportunityStage.PROPOSAL,
      OpportunityStage.NEGOTIATION,
      OpportunityStage.CLOSED_WON,
      OpportunityStage.CLOSED_LOST,
    ];

    const stages: PipelineStageSummaryDto[] = allStages.map(stage => {
      const stageDeals = deals.filter((d: any) => d.stage === stage);
      const count = stageDeals.length;
      const totalAmount = stageDeals.reduce((sum: number, d: any) => sum + Number(d.amount), 0);
      const weightedAmount = stageDeals.reduce(
        (sum: number, d: any) => sum + Number(d.amount) * (d.probability / 100),
        0,
      );
      const averageProbability =
        count > 0
          ? Math.round(stageDeals.reduce((sum: number, d: any) => sum + d.probability, 0) / count)
          : (STAGE_DEFAULT_PROBABILITIES[stage] ?? 0);

      return {
        stage,
        count,
        totalAmount: Math.round(totalAmount * 100) / 100,
        weightedAmount: Math.round(weightedAmount * 100) / 100,
        averageProbability,
      };
    });

    const rawTotalPipelineValue = deals.reduce((sum: number, d: any) => sum + Number(d.amount), 0);
    const totalPipelineValue = Math.round(rawTotalPipelineValue * 100) / 100;
    const weightedPipelineValue = deals.reduce(
      (sum: number, d: any) => sum + Number(d.amount) * (d.probability / 100),
      0,
    );

    return {
      currency,
      totalPipelineValue,
      weightedPipelineValue: Math.round(weightedPipelineValue * 100) / 100,
      totalDeals: deals.length,
      stages,
    };
  }
}
