import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DomainEvent,
  LeadGrade,
  LeadStage,
  LeadStatus,
  computeLeadGrade,
  type CreateLeadDto,
  type LeadResponseDto,
  type ListLeadsQueryDto,
  type ListLeadsQueryOutput,
  type PaginationMeta,
  type UpdateLeadDto,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database/prisma.service';

export function formatLeadResponse(lead: any): LeadResponseDto {
  return {
    id: lead.id,
    workspaceId: lead.workspaceId,
    contactId: lead.contactId,
    status: lead.status as LeadStatus,
    stage: lead.stage as LeadStage,
    score: lead.score ?? 0,
    grade: computeLeadGrade(lead.score ?? 0),
    assignedUserId: lead.assignedUserId,
    estimatedValue:
      lead.estimatedValue !== null && lead.estimatedValue !== undefined
        ? Number(lead.estimatedValue)
        : null,
    currency: lead.currency || 'USD',
    metadata: (lead.metadata as Record<string, unknown>) || {},
    lastActivityAt: lead.lastActivityAt ? new Date(lead.lastActivityAt).toISOString() : null,
    createdAt: new Date(lead.createdAt).toISOString(),
    updatedAt: new Date(lead.updatedAt).toISOString(),
    contact: lead.contact
      ? {
          id: lead.contact.id,
          name: lead.contact.name,
          email: lead.contact.email,
          phoneNumber: lead.contact.phoneNumber,
          avatarUrl: lead.contact.avatarUrl,
        }
      : undefined,
    assignedUser: lead.assignedUser
      ? {
          id: lead.assignedUser.id,
          name: lead.assignedUser.name,
          email: lead.assignedUser.email,
          avatarUrl: lead.assignedUser.avatarUrl,
        }
      : null,
  };
}

export const VALID_LEAD_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  [LeadStatus.NEW]: [
    LeadStatus.CONTACTED,
    LeadStatus.ENGAGED,
    LeadStatus.QUALIFIED,
    LeadStatus.UNQUALIFIED,
    LeadStatus.DISQUALIFIED,
  ],
  [LeadStatus.CONTACTED]: [
    LeadStatus.ENGAGED,
    LeadStatus.QUALIFIED,
    LeadStatus.UNQUALIFIED,
    LeadStatus.DISQUALIFIED,
  ],
  [LeadStatus.ENGAGED]: [LeadStatus.QUALIFIED, LeadStatus.UNQUALIFIED, LeadStatus.DISQUALIFIED],
  [LeadStatus.QUALIFIED]: [LeadStatus.UNQUALIFIED, LeadStatus.DISQUALIFIED],
  [LeadStatus.UNQUALIFIED]: [
    LeadStatus.NEW,
    LeadStatus.CONTACTED,
    LeadStatus.ENGAGED,
    LeadStatus.QUALIFIED,
    LeadStatus.DISQUALIFIED,
  ],
  [LeadStatus.DISQUALIFIED]: [
    LeadStatus.NEW,
    LeadStatus.CONTACTED,
    LeadStatus.ENGAGED,
    LeadStatus.QUALIFIED,
    LeadStatus.UNQUALIFIED,
  ],
  [LeadStatus.CONVERTED]: [],
};

export function validateLeadTransition(currentStatus: LeadStatus, nextStatus: LeadStatus): void {
  if (currentStatus === nextStatus) return;

  if (currentStatus === LeadStatus.CONVERTED) {
    throw new BadRequestException({
      code: 'INVALID_STATUS_TRANSITION',
      message: 'Converted leads cannot be reverted to active qualification stages',
    });
  }

  if (nextStatus === LeadStatus.CONVERTED) {
    throw new BadRequestException({
      code: 'USE_CONVERT_ENDPOINT',
      message: 'Use the POST /convert endpoint to convert a lead into an opportunity',
    });
  }

  const allowed = VALID_LEAD_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw new BadRequestException({
      code: 'INVALID_STATUS_TRANSITION',
      message: `Invalid status transition from ${currentStatus} to ${nextStatus}`,
    });
  }
}

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Creates a new Lead for a Contact within a specific workspace.
   * Enforces 1 active lead per contact per workspace and assignee membership.
   */
  async createLead(workspaceId: string, dto: CreateLeadDto): Promise<LeadResponseDto> {
    const client = this.prisma.getClient();

    // 1. Verify contact exists within this tenant
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

    // 2. Check uniqueness: 1 lead per contact per workspace
    const existingLead = await client.lead.findFirst({
      where: { workspaceId, contactId: dto.contactId },
    });
    if (existingLead) {
      throw new ConflictException({
        code: 'LEAD_ALREADY_EXISTS',
        message: 'A lead already exists for this contact in this workspace',
        details: { contactId: dto.contactId, existingLeadId: existingLead.id },
      });
    }

    // 3. Reject direct creation as CONVERTED
    if (dto.status === LeadStatus.CONVERTED) {
      throw new BadRequestException({
        code: 'USE_CONVERT_ENDPOINT',
        message: 'Use the POST /convert endpoint to convert a lead into an opportunity',
      });
    }

    // 4. Verify assignee if provided
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

    // 5. Create Lead in DB (catch P2002 race condition)
    let lead;
    try {
      lead = await client.lead.create({
        data: {
          workspaceId,
          contactId: dto.contactId,
          status: dto.status || LeadStatus.NEW,
          stage: dto.stage || LeadStage.DISCOVERY,
          score: 0,
          assignedUserId: dto.assignedUserId || null,
          estimatedValue:
            dto.estimatedValue !== undefined && dto.estimatedValue !== null
              ? dto.estimatedValue
              : null,
          currency: dto.currency || 'USD',
          metadata: ((dto.metadata as Record<string, unknown>) || {}) as any,
          lastActivityAt: new Date(),
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
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException({
          code: 'LEAD_ALREADY_EXISTS',
          message: 'A lead already exists for this contact in this workspace',
          details: { contactId: dto.contactId, workspaceId },
        });
      }
      throw err;
    }

    const response = formatLeadResponse(lead);

    // 5. Emit DomainEvent.LEAD_CREATED
    this.eventEmitter.emit(DomainEvent.LEAD_CREATED, {
      workspaceId,
      leadId: lead.id,
      contactId: lead.contactId,
      status: lead.status,
      stage: lead.stage,
      score: lead.score,
      assignedUserId: lead.assignedUserId,
      lead: response,
    });

    return response;
  }

  /**
   * Retrieves paginated leads with filtering and search.
   */
  async findAll(
    workspaceId: string,
    query: ListLeadsQueryOutput | ListLeadsQueryDto,
  ): Promise<{ items: LeadResponseDto[]; meta: PaginationMeta }> {
    const client = this.prisma.getClient();
    const where: any = { workspaceId };

    if (query.status) {
      where.status = query.status;
    }
    if (query.stage) {
      where.stage = query.stage;
    }
    if (query.assignedUserId) {
      where.assignedUserId = query.assignedUserId;
    }
    if (query.contactId) {
      where.contactId = query.contactId;
    }

    // Score filtering
    if (query.minScore !== undefined || query.maxScore !== undefined) {
      where.score = {};
      if (query.minScore !== undefined) where.score.gte = query.minScore;
      if (query.maxScore !== undefined) where.score.lte = query.maxScore;
    }

    // Grade filtering
    if (query.grade) {
      if (query.grade === LeadGrade.HOT) {
        where.score = { ...where.score, gte: 80 };
      } else if (query.grade === LeadGrade.WARM) {
        where.score = { ...where.score, gte: 50, lte: 79 };
      } else if (query.grade === LeadGrade.COLD) {
        where.score = { ...where.score, gte: 20, lte: 49 };
      } else if (query.grade === LeadGrade.JUNK) {
        where.score = { ...where.score, lt: 20 };
      }
    }

    // Contact name / email search
    if (query.search && query.search.trim() !== '') {
      where.contact = {
        OR: [
          { name: { contains: query.search.trim(), mode: 'insensitive' } },
          { email: { contains: query.search.trim(), mode: 'insensitive' } },
        ],
      };
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const skip = (page - 1) * limit;
    const take = limit;
    const orderBy = { [sortBy]: sortOrder };

    const [total, leads] = await Promise.all([
      client.lead.count({ where }),
      client.lead.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          contact: {
            select: { id: true, name: true, email: true, phoneNumber: true, avatarUrl: true },
          },
          assignedUser: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      }),
    ]);

    const items = leads.map((lead: any) => formatLeadResponse(lead));

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
   * Retrieves single lead by ID with tenant isolation.
   */
  async findById(workspaceId: string, id: string): Promise<LeadResponseDto> {
    const client = this.prisma.getClient();
    const lead = await client.lead.findFirst({
      where: { id, workspaceId },
      include: {
        contact: {
          select: { id: true, name: true, email: true, phoneNumber: true, avatarUrl: true },
        },
        assignedUser: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    if (!lead) {
      throw new NotFoundException({
        code: 'LEAD_NOT_FOUND',
        message: 'Lead not found',
        details: { id, workspaceId },
      });
    }

    return formatLeadResponse(lead);
  }

  /**
   * Updates an existing Lead.
   * Rejects modification if the lead is already CONVERTED.
   */
  async updateLead(workspaceId: string, id: string, dto: UpdateLeadDto): Promise<LeadResponseDto> {
    const client = this.prisma.getClient();

    const existing = await client.lead.findFirst({
      where: { id, workspaceId },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'LEAD_NOT_FOUND',
        message: 'Lead not found',
        details: { id, workspaceId },
      });
    }

    // 1. State machine transition & immutable state check
    if (existing.status === LeadStatus.CONVERTED) {
      if (dto.status !== undefined) {
        validateLeadTransition(existing.status as unknown as LeadStatus, dto.status);
      }
      throw new ConflictException({
        code: 'LEAD_ALREADY_CONVERTED',
        message: 'Cannot modify a lead that has already been converted',
        details: { id, currentStatus: existing.status },
      });
    }

    // 2. Validate requested status transition
    if (dto.status !== undefined) {
      validateLeadTransition(existing.status as unknown as LeadStatus, dto.status);
    }

    // 3. Verify assignee if being reassigned
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

    const updateData: any = {
      lastActivityAt: new Date(),
      updatedAt: new Date(),
    };

    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.stage !== undefined) updateData.stage = dto.stage;
    if (dto.assignedUserId !== undefined) updateData.assignedUserId = dto.assignedUserId;
    if (dto.estimatedValue !== undefined) updateData.estimatedValue = dto.estimatedValue;
    if (dto.currency !== undefined) updateData.currency = dto.currency;
    if (dto.metadata !== undefined) updateData.metadata = dto.metadata as any;

    const updated = await client.lead.update({
      where: { id },
      data: updateData,
      include: {
        contact: {
          select: { id: true, name: true, email: true, phoneNumber: true, avatarUrl: true },
        },
        assignedUser: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    const response = formatLeadResponse(updated);

    // 4. Emit DomainEvent.LEAD_UPDATED
    this.eventEmitter.emit(DomainEvent.LEAD_UPDATED, {
      workspaceId,
      leadId: updated.id,
      contactId: updated.contactId,
      status: updated.status,
      stage: updated.stage,
      score: updated.score,
      assignedUserId: updated.assignedUserId,
      lead: response,
      previousChanges: {
        status: existing.status !== updated.status ? existing.status : undefined,
        stage: existing.stage !== updated.stage ? existing.stage : undefined,
      },
    });

    return response;
  }

  /**
   * Finds a Lead by Contact ID with tenant scoping. Returns null if not found.
   */
  async findByContactId(workspaceId: string, contactId: string): Promise<LeadResponseDto | null> {
    const client = this.prisma.getClient();
    const lead = await client.lead.findFirst({
      where: { contactId, workspaceId },
      include: {
        contact: {
          select: { id: true, name: true, email: true, phoneNumber: true, avatarUrl: true },
        },
        assignedUser: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    if (!lead) return null;
    return formatLeadResponse(lead);
  }
}
