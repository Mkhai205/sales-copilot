import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ConvertLeadDto,
  ConvertLeadOutput,
  DomainEvent,
  LeadResponseDto,
  LeadStage,
  LeadStatus,
  OpportunityResponseDto,
  OpportunityStage,
  STAGE_DEFAULT_PROBABILITIES,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { formatLeadResponse } from './leads.service';

export function formatOpportunityResponse(opp: any): OpportunityResponseDto {
  return {
    id: opp.id,
    workspaceId: opp.workspaceId,
    leadId: opp.leadId ?? null,
    contactId: opp.contactId,
    title: opp.title,
    stage: opp.stage as OpportunityStage,
    amount: opp.amount !== null && opp.amount !== undefined ? Number(opp.amount) : 0,
    currency: opp.currency || 'USD',
    probability: opp.probability ?? 50,
    expectedCloseDate: opp.expectedCloseDate ? new Date(opp.expectedCloseDate).toISOString() : null,
    actualCloseDate: opp.actualCloseDate ? new Date(opp.actualCloseDate).toISOString() : null,
    lostReason: opp.lostReason ?? null,
    assignedUserId: opp.assignedUserId ?? null,
    metadata: (opp.metadata as Record<string, unknown>) || {},
    createdAt: new Date(opp.createdAt).toISOString(),
    updatedAt: new Date(opp.updatedAt).toISOString(),
    contact: opp.contact
      ? {
          id: opp.contact.id,
          name: opp.contact.name,
          email: opp.contact.email,
          phoneNumber: opp.contact.phoneNumber,
          avatarUrl: opp.contact.avatarUrl,
        }
      : undefined,
    lead: opp.lead
      ? {
          id: opp.lead.id,
          status: opp.lead.status,
          stage: opp.lead.stage,
          score: opp.lead.score,
        }
      : null,
    assignedUser: opp.assignedUser
      ? {
          id: opp.assignedUser.id,
          name: opp.assignedUser.name,
          email: opp.assignedUser.email,
          avatarUrl: opp.assignedUser.avatarUrl,
        }
      : null,
  };
}

export interface ConvertLeadResult {
  lead: LeadResponseDto;
  opportunity: OpportunityResponseDto;
}

@Injectable()
export class LeadConversionService {
  private readonly logger = new Logger(LeadConversionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Atomically converts a Lead into an Opportunity.
   * Transactionally updates Lead status to CONVERTED, stage to WON,
   * creates Opportunity with default probability, updates Contact customAttributes,
   * and fires DomainEvent.LEAD_CONVERTED and DomainEvent.OPPORTUNITY_CREATED after commit.
   */
  async convertLead(
    workspaceId: string,
    leadId: string,
    dto: ConvertLeadOutput | ConvertLeadDto,
  ): Promise<ConvertLeadResult> {
    const rootClient = this.prisma.getClient();

    // 1. Fetch existing lead with contact
    const lead = await rootClient.lead.findFirst({
      where: { id: leadId, workspaceId },
      include: {
        contact: true,
      },
    });

    if (!lead) {
      throw new NotFoundException({
        code: 'LEAD_NOT_FOUND',
        message: 'Lead not found',
        details: { leadId, workspaceId },
      });
    }

    // 2. Reject if already converted
    if (lead.status === LeadStatus.CONVERTED) {
      throw new ConflictException({
        code: 'LEAD_ALREADY_CONVERTED',
        message: 'This lead has already been converted to an opportunity',
        details: { leadId, currentStatus: lead.status },
      });
    }

    // 3. Resolve and validate deal title (accepts dealName alias)
    const rawTitle = dto.title || (dto as any).dealName;
    const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
    if (!title || title.length < 3) {
      throw new BadRequestException({
        code: 'TITLE_REQUIRED',
        message: 'Title or dealName is required with at least 3 characters',
      });
    }

    // 4. Verify assignee if explicitly specified in conversion
    const assignedUserId = dto.assignedUserId || lead.assignedUserId;
    if (dto.assignedUserId) {
      const member = await rootClient.workspaceMember.findFirst({
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

    const stage = dto.stage || OpportunityStage.QUALIFICATION;
    const probability =
      dto.probability !== undefined ? dto.probability : (STAGE_DEFAULT_PROBABILITIES[stage] ?? 25);

    // 4. Run atomic conversion inside transaction
    return await this.prisma.runInTransaction(async ctx => {
      const tx = ctx.tx;

      // 4a. Atomically transition Lead status to CONVERTED & stage to WON
      const updateResult = await tx.lead.updateMany({
        where: {
          id: lead.id,
          workspaceId,
          status: { not: LeadStatus.CONVERTED },
        },
        data: {
          status: LeadStatus.CONVERTED,
          stage: LeadStage.WON,
          lastActivityAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictException({
          code: 'LEAD_ALREADY_CONVERTED',
          message: 'This lead has already been converted to an opportunity',
          details: { leadId, currentStatus: LeadStatus.CONVERTED },
        });
      }

      // 4b. Fetch updated lead with relations
      const updatedLead = await tx.lead.findFirst({
        where: { id: lead.id, workspaceId },
        include: {
          contact: {
            select: { id: true, name: true, email: true, phoneNumber: true, avatarUrl: true },
          },
          assignedUser: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      });

      if (!updatedLead) {
        throw new NotFoundException({
          code: 'LEAD_NOT_FOUND',
          message: 'Lead not found after conversion update',
          details: { leadId: lead.id, workspaceId },
        });
      }

      // 4c. Create Opportunity
      const opportunity = await tx.opportunity.create({
        data: {
          workspaceId,
          leadId: lead.id,
          contactId: lead.contactId,
          title,
          stage,
          amount: dto.amount,
          currency: dto.currency || lead.currency || 'USD',
          probability,
          expectedCloseDate: dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : null,
          assignedUserId,
          metadata: {},
        },
        include: {
          contact: {
            select: { id: true, name: true, email: true, phoneNumber: true, avatarUrl: true },
          },
          assignedUser: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      });

      // 4d. Update Contact customAttributes: preserve Phase 1 invariants by storing flags in JSON
      const rawAttrs = lead.contact?.customAttributes;
      const currentAttrs =
        typeof rawAttrs === 'object' && rawAttrs !== null
          ? (rawAttrs as Record<string, unknown>)
          : {};
      await tx.contact.update({
        where: { id: lead.contactId },
        data: {
          customAttributes: {
            ...currentAttrs,
            isOpportunity: true,
            convertedAt: new Date().toISOString(),
          },
        },
      });

      const leadResponse = formatLeadResponse(updatedLead);
      const oppResponse = formatOpportunityResponse(opportunity);

      // 4d. Post-commit hooks: emit domain events safely
      ctx.addPostCommitHook(() => {
        this.eventEmitter.emit(DomainEvent.LEAD_CONVERTED, {
          workspaceId,
          leadId: updatedLead.id,
          contactId: updatedLead.contactId,
          opportunityId: opportunity.id,
          lead: leadResponse,
          opportunity: oppResponse,
        });

        this.eventEmitter.emit(DomainEvent.OPPORTUNITY_CREATED, {
          workspaceId,
          opportunityId: opportunity.id,
          leadId: updatedLead.id,
          contactId: opportunity.contactId,
          stage: opportunity.stage,
          amount: Number(opportunity.amount),
          currency: opportunity.currency,
          assignedUserId: opportunity.assignedUserId,
          opportunity: oppResponse,
        });
      });

      return {
        lead: leadResponse,
        opportunity: oppResponse,
      };
    });
  }
}
