import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ConversationPriority,
  ConversationResponseDto,
  ConversationStatus,
  CreateConversationDto,
  AssignConversationDto,
  UpdateConversationPriorityDto,
  UpdateConversationStatusDto,
  ConversationListQueryDto,
  LabelDto,
  PaginationMeta,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database';
import { mapConversationToDto } from './conversations.mapper';
import { mapLabelToDto } from '../labels/labels.mapper';

/**
 * Standard Conversation includes for full DTO reconstruction.
 */
const CONVERSATION_STANDARD_INCLUDE = {
  contact: {
    include: {
      identities: true,
    },
  },
  inbox: true,
  assignee: true,
  team: true,
  labels: {
    include: {
      label: true,
    },
  },
  messages: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
  },
};

/**
 * Valid state transitions matrix (BR-4.1).
 */
const ALLOWED_STATUS_TRANSITIONS: Record<ConversationStatus, ConversationStatus[]> = {
  [ConversationStatus.OPEN]: [
    ConversationStatus.PENDING,
    ConversationStatus.SNOOZED,
    ConversationStatus.RESOLVED,
  ],
  [ConversationStatus.PENDING]: [
    ConversationStatus.OPEN,
    ConversationStatus.SNOOZED,
    ConversationStatus.RESOLVED,
  ],
  [ConversationStatus.SNOOZED]: [ConversationStatus.OPEN, ConversationStatus.RESOLVED],
  [ConversationStatus.RESOLVED]: [ConversationStatus.OPEN],
};

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Creates a new Conversation within a workspace.
   * Validates contact, inbox, assignee (inbox membership), and team existence.
   */
  async create(
    workspaceId: string,
    dto: CreateConversationDto,
    tx?: ReturnType<PrismaService['getClient']>,
  ): Promise<ConversationResponseDto> {
    const client = tx || this.prisma.getClient();

    // 1. Validate contact exists in workspace
    const contact = await client.contact.findFirst({
      where: { id: dto.contactId, workspaceId },
    });
    if (!contact) {
      throw new NotFoundException({
        code: 'CONTACT_NOT_FOUND',
        message: `Contact with id '${dto.contactId}' not found in this workspace`,
      });
    }

    // 2. Validate inbox exists in workspace
    const inbox = await client.inbox.findFirst({
      where: { id: dto.inboxId, workspaceId },
    });
    if (!inbox) {
      throw new NotFoundException({
        code: 'INBOX_NOT_FOUND',
        message: `Inbox with id '${dto.inboxId}' not found in this workspace`,
      });
    }

    // 3. Validate channel identity if supplied
    if (dto.channelIdentityId) {
      const identity = await client.channelIdentity.findFirst({
        where: {
          id: dto.channelIdentityId,
          workspaceId,
          contactId: dto.contactId,
        },
      });
      if (!identity) {
        throw new NotFoundException({
          code: 'CHANNEL_IDENTITY_NOT_FOUND',
          message: `Channel identity with id '${dto.channelIdentityId}' not found for contact '${dto.contactId}'`,
        });
      }
    }

    // 4. Validate assignee membership in target Inbox
    if (dto.assigneeId) {
      const inboxMember = await client.inboxMember.findUnique({
        where: {
          inboxId_userId: {
            inboxId: dto.inboxId,
            userId: dto.assigneeId,
          },
        },
      });
      if (!inboxMember) {
        throw new BadRequestException({
          code: 'ASSIGNEE_NOT_IN_INBOX',
          message: `User with id '${dto.assigneeId}' is not an assigned member of inbox '${dto.inboxId}'`,
        });
      }
    }

    // 5. Validate team belongs to workspace
    if (dto.teamId) {
      const team = await client.team.findFirst({
        where: { id: dto.teamId, workspaceId },
      });
      if (!team) {
        throw new NotFoundException({
          code: 'TEAM_NOT_FOUND',
          message: `Team with id '${dto.teamId}' not found in this workspace`,
        });
      }
    }

    const priority = dto.priority || ConversationPriority.MEDIUM;
    const now = new Date();

    const created = await client.conversation.create({
      data: {
        workspaceId,
        contactId: dto.contactId,
        inboxId: dto.inboxId,
        channelIdentityId: dto.channelIdentityId ?? null,
        assigneeId: dto.assigneeId ?? null,
        teamId: dto.teamId ?? null,
        status: ConversationStatus.OPEN,
        priority,
        lastActivityAt: now,
        unreadMessagesCount: 0,
        customAttributes: (dto.customAttributes as any) ?? {},
      },
      include: CONVERSATION_STANDARD_INCLUDE,
    });

    const conversationDto = mapConversationToDto(created);

    this.eventEmitter.emit('conversation.created', {
      workspaceId,
      conversation: conversationDto,
    });

    this.logger.log(
      `Created conversation #${conversationDto.displayId} (${conversationDto.id}) in workspace '${workspaceId}'`,
    );

    return conversationDto;
  }

  /**
   * Updates conversation status enforcing strict state machine transitions (BR-4.1).
   */
  async updateStatus(
    workspaceId: string,
    id: string,
    dto: UpdateConversationStatusDto,
    tx?: ReturnType<PrismaService['getClient']>,
  ): Promise<ConversationResponseDto> {
    const client = tx || this.prisma.getClient();

    const existing = await client.conversation.findFirst({
      where: { id, workspaceId },
      include: CONVERSATION_STANDARD_INCLUDE,
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'CONVERSATION_NOT_FOUND',
        message: `Conversation with id '${id}' not found in this workspace`,
      });
    }

    const currentStatus = existing.status as ConversationStatus;
    const targetStatus = dto.status;

    // Idempotent if status is unchanged
    if (currentStatus === targetStatus) {
      return mapConversationToDto(existing);
    }

    // Validate transition
    const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      throw new BadRequestException({
        code: 'INVALID_STATUS_TRANSITION',
        message: `Cannot transition conversation from '${currentStatus}' to '${targetStatus}'`,
      });
    }

    let snoozedUntilDate: Date | null = null;

    if (targetStatus === ConversationStatus.SNOOZED) {
      if (!dto.snoozedUntil) {
        throw new BadRequestException({
          code: 'INVALID_SNOOZED_UNTIL',
          message: 'snoozedUntil must be provided when setting conversation status to SNOOZED',
        });
      }

      snoozedUntilDate = new Date(dto.snoozedUntil);
      if (isNaN(snoozedUntilDate.getTime()) || snoozedUntilDate.getTime() <= Date.now()) {
        throw new BadRequestException({
          code: 'INVALID_SNOOZED_UNTIL',
          message: 'snoozedUntil must be a valid datetime in the future',
        });
      }
    }

    const updated = await client.conversation.update({
      where: { id },
      data: {
        status: targetStatus,
        snoozedUntil: snoozedUntilDate,
      },
      include: CONVERSATION_STANDARD_INCLUDE,
    });

    const conversationDto = mapConversationToDto(updated);

    this.eventEmitter.emit('conversation.status_updated', {
      workspaceId,
      conversationId: id,
      previousStatus: currentStatus,
      currentStatus: targetStatus,
      conversation: conversationDto,
    });

    // Auto-reopen event if transitioned from RESOLVED or SNOOZED to OPEN
    if (
      (currentStatus === ConversationStatus.RESOLVED ||
        currentStatus === ConversationStatus.SNOOZED) &&
      targetStatus === ConversationStatus.OPEN
    ) {
      this.eventEmitter.emit('conversation.reopened', {
        workspaceId,
        conversationId: id,
        triggeredBySenderType: 'USER',
        conversation: conversationDto,
      });
    }

    this.logger.log(
      `Updated status of conversation #${conversationDto.displayId} from '${currentStatus}' to '${targetStatus}' in workspace '${workspaceId}'`,
    );

    return conversationDto;
  }

  /**
   * Assigns an agent and/or a team to a conversation.
   * Validates that the assignee is an active member of the conversation's Inbox.
   */
  async assign(
    workspaceId: string,
    id: string,
    dto: AssignConversationDto,
    assignedByUserId?: string | null,
    tx?: ReturnType<PrismaService['getClient']>,
  ): Promise<ConversationResponseDto> {
    const client = tx || this.prisma.getClient();

    const existing = await client.conversation.findFirst({
      where: { id, workspaceId },
      include: CONVERSATION_STANDARD_INCLUDE,
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'CONVERSATION_NOT_FOUND',
        message: `Conversation with id '${id}' not found in this workspace`,
      });
    }

    const updateData: Record<string, unknown> = {};

    // Validate assignee
    if (dto.assigneeId !== undefined) {
      if (dto.assigneeId !== null) {
        const inboxMember = await client.inboxMember.findUnique({
          where: {
            inboxId_userId: {
              inboxId: existing.inboxId,
              userId: dto.assigneeId,
            },
          },
        });
        if (!inboxMember) {
          throw new BadRequestException({
            code: 'ASSIGNEE_NOT_IN_INBOX',
            message: `User with id '${dto.assigneeId}' is not an assigned member of inbox '${existing.inboxId}'`,
          });
        }
      }
      updateData.assigneeId = dto.assigneeId;
    }

    // Validate team
    if (dto.teamId !== undefined) {
      if (dto.teamId !== null) {
        const team = await client.team.findFirst({
          where: { id: dto.teamId, workspaceId },
        });
        if (!team) {
          throw new NotFoundException({
            code: 'TEAM_NOT_FOUND',
            message: `Team with id '${dto.teamId}' not found in this workspace`,
          });
        }
      }
      updateData.teamId = dto.teamId;
    }

    const updated = await client.conversation.update({
      where: { id },
      data: updateData,
      include: CONVERSATION_STANDARD_INCLUDE,
    });

    const conversationDto = mapConversationToDto(updated);

    this.eventEmitter.emit('conversation.assigned', {
      workspaceId,
      conversationId: id,
      previousAssigneeId: existing.assigneeId,
      newAssigneeId: updated.assigneeId,
      teamId: updated.teamId,
      assignedByUserId: assignedByUserId ?? null,
      conversation: conversationDto,
    });

    this.logger.log(
      `Assigned conversation #${conversationDto.displayId} to assignee '${updated.assigneeId}' / team '${updated.teamId}' in workspace '${workspaceId}'`,
    );

    return conversationDto;
  }

  /**
   * Updates the priority level of a conversation.
   */
  async updatePriority(
    workspaceId: string,
    id: string,
    dto: UpdateConversationPriorityDto,
    tx?: ReturnType<PrismaService['getClient']>,
  ): Promise<ConversationResponseDto> {
    const client = tx || this.prisma.getClient();

    const existing = await client.conversation.findFirst({
      where: { id, workspaceId },
      include: CONVERSATION_STANDARD_INCLUDE,
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'CONVERSATION_NOT_FOUND',
        message: `Conversation with id '${id}' not found in this workspace`,
      });
    }

    const previousPriority = existing.priority as ConversationPriority;
    const currentPriority = dto.priority;

    if (previousPriority === currentPriority) {
      return mapConversationToDto(existing);
    }

    const updated = await client.conversation.update({
      where: { id },
      data: { priority: currentPriority },
      include: CONVERSATION_STANDARD_INCLUDE,
    });

    const conversationDto = mapConversationToDto(updated);

    this.eventEmitter.emit('conversation.priority_updated', {
      workspaceId,
      conversationId: id,
      previousPriority,
      currentPriority,
      conversation: conversationDto,
    });

    this.logger.log(
      `Updated priority of conversation #${conversationDto.displayId} to '${currentPriority}' in workspace '${workspaceId}'`,
    );

    return conversationDto;
  }

  /**
   * Resets unread messages counter to 0 (BR-4.3) when agent views conversation.
   */
  async resetUnreadCount(
    workspaceId: string,
    id: string,
    tx?: ReturnType<PrismaService['getClient']>,
  ): Promise<ConversationResponseDto> {
    const client = tx || this.prisma.getClient();

    const existing = await client.conversation.findFirst({
      where: { id, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'CONVERSATION_NOT_FOUND',
        message: `Conversation with id '${id}' not found in this workspace`,
      });
    }

    if (existing.unreadMessagesCount === 0) {
      const full = await client.conversation.findFirst({
        where: { id, workspaceId },
        include: CONVERSATION_STANDARD_INCLUDE,
      });
      return mapConversationToDto(full);
    }

    const updated = await client.conversation.update({
      where: { id },
      data: { unreadMessagesCount: 0 },
      include: CONVERSATION_STANDARD_INCLUDE,
    });

    return mapConversationToDto(updated);
  }

  /**
   * Finds the latest active conversation for a contact on an inbox (OPEN, PENDING, SNOOZED).
   */
  async findActiveByContactAndInbox(
    workspaceId: string,
    contactId: string,
    inboxId: string,
    tx?: ReturnType<PrismaService['getClient']>,
  ): Promise<ConversationResponseDto | null> {
    const client = tx || this.prisma.getClient();

    const active = await client.conversation.findFirst({
      where: {
        workspaceId,
        contactId,
        inboxId,
        status: {
          in: [ConversationStatus.OPEN, ConversationStatus.PENDING, ConversationStatus.SNOOZED],
        },
      },
      orderBy: { lastActivityAt: 'desc' },
      include: CONVERSATION_STANDARD_INCLUDE,
    });

    return active ? mapConversationToDto(active) : null;
  }

  /**
   * Finds existing active conversation or creates a new one (used by Inbound Ingestion Pipeline).
   */
  async findOrCreateActiveConversation(
    workspaceId: string,
    params: {
      contactId: string;
      inboxId: string;
      channelIdentityId?: string | null;
    },
    tx?: ReturnType<PrismaService['getClient']>,
  ): Promise<ConversationResponseDto> {
    const client = tx || this.prisma.getClient();

    const active = await this.findActiveByContactAndInbox(
      workspaceId,
      params.contactId,
      params.inboxId,
      client,
    );

    if (active) {
      // If snoozed, auto-reopen
      if (active.status === ConversationStatus.SNOOZED) {
        return this.updateStatus(
          workspaceId,
          active.id,
          { status: ConversationStatus.OPEN },
          client,
        );
      }
      return active;
    }

    return this.create(
      workspaceId,
      {
        contactId: params.contactId,
        inboxId: params.inboxId,
        channelIdentityId: params.channelIdentityId,
      },
      client,
    );
  }

  /**
   * Retrieves conversation by ID within a workspace with full details.
   */
  async getById(workspaceId: string, id: string): Promise<ConversationResponseDto> {
    const client = this.prisma.getClient();

    const conversation = await client.conversation.findFirst({
      where: { id, workspaceId },
      include: CONVERSATION_STANDARD_INCLUDE,
    });

    if (!conversation) {
      throw new NotFoundException({
        code: 'CONVERSATION_NOT_FOUND',
        message: `Conversation with id '${id}' not found in this workspace`,
      });
    }

    return mapConversationToDto(conversation);
  }

  /**
   * Lists conversations within a workspace with extensive filtering and pagination.
   */
  async list(
    workspaceId: string,
    query?: ConversationListQueryDto,
  ): Promise<{ items: ConversationResponseDto[]; meta: PaginationMeta }> {
    const client = this.prisma.getClient();
    const page = query?.page ? Number(query.page) : 1;
    const limit = query?.limit ? Number(query.limit) : 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { workspaceId };

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.inboxId) {
      where.inboxId = query.inboxId;
    }

    if (query?.assigneeId) {
      if (query.assigneeId === 'unassigned') {
        where.assigneeId = null;
      } else {
        where.assigneeId = query.assigneeId;
      }
    }

    if (query?.teamId) {
      where.teamId = query.teamId;
    }

    if (query?.contactId) {
      where.contactId = query.contactId;
    }

    if (query?.priority) {
      where.priority = query.priority;
    }

    if (query?.labelId) {
      where.labels = {
        some: {
          labelId: query.labelId,
        },
      };
    }

    if (query?.q && query.q.trim() !== '') {
      const search = query.q.trim();
      where.OR = [
        { contact: { name: { contains: search, mode: 'insensitive' } } },
        { contact: { email: { contains: search, mode: 'insensitive' } } },
        { contact: { phoneNumber: { contains: search, mode: 'insensitive' } } },
        { contact: { identifier: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const sortBy = query?.sortBy || 'lastActivityAt';
    const sortOrder = query?.sortOrder || 'desc';

    const [total, conversations] = await Promise.all([
      client.conversation.count({ where }),
      client.conversation.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
        include: CONVERSATION_STANDARD_INCLUDE,
      }),
    ]);

    const items = conversations.map(mapConversationToDto);
    const hasMore = skip + items.length < total;

    return {
      items,
      meta: {
        page,
        limit,
        total,
        hasMore,
      },
    };
  }

  /**
   * Assigns one or more labels to a conversation idempotently.
   */
  async assignLabels(
    workspaceId: string,
    conversationId: string,
    labelIds: string[],
    tx?: ReturnType<PrismaService['getClient']>,
  ): Promise<LabelDto[]> {
    const client = tx || this.prisma.getClient();

    // 1. Validate conversation exists in workspace
    const conversation = await client.conversation.findFirst({
      where: { id: conversationId, workspaceId },
    });

    if (!conversation) {
      throw new NotFoundException({
        code: 'CONVERSATION_NOT_FOUND',
        message: `Conversation with id '${conversationId}' not found in this workspace`,
      });
    }

    if (labelIds.length === 0) {
      return this.getLabels(workspaceId, conversationId, client);
    }

    // 2. Validate all labels exist in the same workspace
    const foundLabels = await client.label.findMany({
      where: {
        id: { in: labelIds },
        workspaceId,
      },
    });

    if (foundLabels.length !== labelIds.length) {
      throw new NotFoundException({
        code: 'LABEL_NOT_FOUND',
        message: 'One or more labels not found in this workspace',
      });
    }

    // 3. Idempotent create junction records
    for (const labelId of labelIds) {
      const existing = await client.conversationLabel.findUnique({
        where: {
          conversationId_labelId: {
            conversationId,
            labelId,
          },
        },
      });

      if (!existing) {
        await client.conversationLabel.create({
          data: {
            conversationId,
            labelId,
          },
        });
      }
    }

    const currentLabels = await this.getLabels(workspaceId, conversationId, client);
    const fullConv = await this.getById(workspaceId, conversationId);

    this.eventEmitter.emit('conversation.labels_updated', {
      workspaceId,
      conversationId,
      labelIds: currentLabels.map(l => l.id),
      labels: currentLabels,
      conversation: fullConv,
    });

    this.logger.log(
      `Assigned labels [${labelIds.join(', ')}] to conversation #${conversation.displayId} in workspace '${workspaceId}'`,
    );

    return currentLabels;
  }

  /**
   * Removes a label from a conversation.
   */
  async removeLabel(
    workspaceId: string,
    conversationId: string,
    labelId: string,
    tx?: ReturnType<PrismaService['getClient']>,
  ): Promise<{ success: true }> {
    const client = tx || this.prisma.getClient();

    const conversation = await client.conversation.findFirst({
      where: { id: conversationId, workspaceId },
    });

    if (!conversation) {
      throw new NotFoundException({
        code: 'CONVERSATION_NOT_FOUND',
        message: `Conversation with id '${conversationId}' not found in this workspace`,
      });
    }

    const existingJunction = await client.conversationLabel.findUnique({
      where: {
        conversationId_labelId: {
          conversationId,
          labelId,
        },
      },
    });

    if (!existingJunction) {
      throw new NotFoundException({
        code: 'CONVERSATION_LABEL_NOT_FOUND',
        message: `Label with id '${labelId}' is not assigned to this conversation`,
      });
    }

    await client.conversationLabel.delete({
      where: {
        conversationId_labelId: {
          conversationId,
          labelId,
        },
      },
    });

    const currentLabels = await this.getLabels(workspaceId, conversationId, client);
    const fullConv = await this.getById(workspaceId, conversationId);

    this.eventEmitter.emit('conversation.labels_updated', {
      workspaceId,
      conversationId,
      labelIds: currentLabels.map(l => l.id),
      labels: currentLabels,
      conversation: fullConv,
    });

    this.logger.log(
      `Removed label '${labelId}' from conversation #${conversation.displayId} in workspace '${workspaceId}'`,
    );

    return { success: true };
  }

  /**
   * Lists all labels assigned to a conversation.
   */
  async getLabels(
    workspaceId: string,
    conversationId: string,
    tx?: ReturnType<PrismaService['getClient']>,
  ): Promise<LabelDto[]> {
    const client = tx || this.prisma.getClient();

    const conversation = await client.conversation.findFirst({
      where: { id: conversationId, workspaceId },
    });

    if (!conversation) {
      throw new NotFoundException({
        code: 'CONVERSATION_NOT_FOUND',
        message: `Conversation with id '${conversationId}' not found in this workspace`,
      });
    }

    const junctionList = await client.conversationLabel.findMany({
      where: { conversationId },
      include: { label: true },
      orderBy: { label: { title: 'asc' } },
    });

    return junctionList.map(j => mapLabelToDto(j.label));
  }
}
