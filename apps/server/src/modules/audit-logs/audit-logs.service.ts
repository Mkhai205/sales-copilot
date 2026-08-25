import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type {
  AuditLogDto,
  AuditLogListQueryDto,
  PaginationMeta,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database';
import { mapAuditLogToDto } from './audit-logs.mapper';

export interface CreateAuditLogParams {
  workspaceId?: string | null;
  userId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  payload?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Logs an immutable audit event in the database.
   */
  async log(
    params: CreateAuditLogParams,
    tx?: ReturnType<PrismaService['getClient']>,
  ): Promise<AuditLogDto> {
    const client = tx || this.prisma.getClient();

    const created = await client.auditLog.create({
      data: {
        workspaceId: params.workspaceId ?? null,
        userId: params.userId ?? null,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId ?? null,
        payload: (params.payload as any) ?? undefined,
        ipAddress: params.ipAddress ?? null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    const dto = mapAuditLogToDto(created);

    this.logger.log(
      `AuditLog [${dto.action}] on ${dto.resourceType}${dto.resourceId ? `:${dto.resourceId}` : ''} in workspace '${dto.workspaceId}' by actor '${dto.userId}'`,
    );

    return dto;
  }

  /**
   * Lists audit logs for a workspace with multi-attribute filtering and pagination.
   */
  async list(
    workspaceId: string,
    query?: AuditLogListQueryDto,
  ): Promise<{ items: AuditLogDto[]; meta: PaginationMeta }> {
    const client = this.prisma.getClient();
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { workspaceId };

    if (query?.action) {
      where.action = query.action;
    }

    const actorId = query?.actorId || query?.userId;
    if (actorId) {
      where.userId = actorId;
    }

    if (query?.resourceType) {
      where.resourceType = query.resourceType;
    }

    if (query?.resourceId) {
      where.resourceId = query.resourceId;
    }

    if (query?.startDate || query?.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (query.startDate) {
        dateFilter.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        dateFilter.lte = new Date(query.endDate);
      }
      where.createdAt = dateFilter;
    }

    const [items, total] = await Promise.all([
      client.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      }),
      client.auditLog.count({ where }),
    ]);

    return {
      items: items.map(mapAuditLogToDto),
      meta: {
        page,
        limit,
        total,
        hasMore: skip + items.length < total,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Event-driven domain audit log handlers
  // ---------------------------------------------------------------------------

  @OnEvent('contact.merged', { async: true })
  async handleContactMerged(payload: any): Promise<void> {
    try {
      if (!payload?.workspaceId) return;
      await this.log({
        workspaceId: payload.workspaceId,
        userId: payload.performedByUserId ?? null,
        action: 'CONTACT_MERGED',
        resourceType: 'CONTACT',
        resourceId: payload.primaryContactId || payload.contact?.id,
        payload: {
          mergedContactId: payload.mergedContactId,
          primaryContactId: payload.primaryContactId,
        },
      });
    } catch (err) {
      this.logger.error('Failed to record audit log for contact.merged', err);
    }
  }

  @OnEvent('channel.created', { async: true })
  async handleChannelCreated(payload: any): Promise<void> {
    try {
      if (!payload?.workspaceId) return;
      await this.log({
        workspaceId: payload.workspaceId,
        userId: payload.userId ?? null,
        action: 'CHANNEL_CREATED',
        resourceType: 'CHANNEL',
        resourceId: payload.channelId || payload.channel?.id,
        payload: {
          channelType: payload.channelType || payload.channel?.channelType,
          inboxId: payload.inboxId || payload.channel?.inboxId,
        },
      });
    } catch (err) {
      this.logger.error('Failed to record audit log for channel.created', err);
    }
  }

  @OnEvent('channel.deleted', { async: true })
  async handleChannelDeleted(payload: any): Promise<void> {
    try {
      if (!payload?.workspaceId) return;
      await this.log({
        workspaceId: payload.workspaceId,
        userId: payload.userId ?? null,
        action: 'CHANNEL_DELETED',
        resourceType: 'CHANNEL',
        resourceId: payload.channelId || payload.id,
        payload: {
          channelType: payload.channelType,
        },
      });
    } catch (err) {
      this.logger.error('Failed to record audit log for channel.deleted', err);
    }
  }

  @OnEvent('label.created', { async: true })
  async handleLabelCreated(payload: any): Promise<void> {
    try {
      if (!payload?.workspaceId) return;
      await this.log({
        workspaceId: payload.workspaceId,
        userId: payload.userId ?? null,
        action: 'LABEL_CREATED',
        resourceType: 'LABEL',
        resourceId: payload.label?.id,
        payload: {
          title: payload.label?.title,
          color: payload.label?.color,
        },
      });
    } catch (err) {
      this.logger.error('Failed to record audit log for label.created', err);
    }
  }

  @OnEvent('label.deleted', { async: true })
  async handleLabelDeleted(payload: any): Promise<void> {
    try {
      if (!payload?.workspaceId) return;
      await this.log({
        workspaceId: payload.workspaceId,
        userId: payload.userId ?? null,
        action: 'LABEL_DELETED',
        resourceType: 'LABEL',
        resourceId: payload.labelId,
        payload: {
          title: payload.title,
        },
      });
    } catch (err) {
      this.logger.error('Failed to record audit log for label.deleted', err);
    }
  }

  @OnEvent('canned_response.created', { async: true })
  async handleCannedResponseCreated(payload: any): Promise<void> {
    try {
      if (!payload?.workspaceId) return;
      await this.log({
        workspaceId: payload.workspaceId,
        userId: payload.userId ?? null,
        action: 'CANNED_RESPONSE_CREATED',
        resourceType: 'CANNED_RESPONSE',
        resourceId: payload.cannedResponse?.id,
        payload: {
          shortCode: payload.cannedResponse?.shortCode,
        },
      });
    } catch (err) {
      this.logger.error('Failed to record audit log for canned_response.created', err);
    }
  }

  @OnEvent('canned_response.deleted', { async: true })
  async handleCannedResponseDeleted(payload: any): Promise<void> {
    try {
      if (!payload?.workspaceId) return;
      await this.log({
        workspaceId: payload.workspaceId,
        userId: payload.userId ?? null,
        action: 'CANNED_RESPONSE_DELETED',
        resourceType: 'CANNED_RESPONSE',
        resourceId: payload.cannedResponseId,
        payload: {
          shortCode: payload.shortCode,
        },
      });
    } catch (err) {
      this.logger.error('Failed to record audit log for canned_response.deleted', err);
    }
  }

  @OnEvent('automation_rule.created', { async: true })
  async handleAutomationRuleCreated(payload: any): Promise<void> {
    try {
      if (!payload?.workspaceId) return;
      await this.log({
        workspaceId: payload.workspaceId,
        userId: payload.userId ?? null,
        action: 'AUTOMATION_RULE_CREATED',
        resourceType: 'AUTOMATION_RULE',
        resourceId: payload.rule?.id,
        payload: {
          name: payload.rule?.name,
          eventTrigger: payload.rule?.eventTrigger,
          isActive: payload.rule?.isActive,
        },
      });
    } catch (err) {
      this.logger.error('Failed to record audit log for automation_rule.created', err);
    }
  }

  @OnEvent('automation_rule.updated', { async: true })
  async handleAutomationRuleUpdated(payload: any): Promise<void> {
    try {
      if (!payload?.workspaceId) return;
      await this.log({
        workspaceId: payload.workspaceId,
        userId: payload.userId ?? null,
        action: 'AUTOMATION_RULE_UPDATED',
        resourceType: 'AUTOMATION_RULE',
        resourceId: payload.rule?.id,
        payload: {
          name: payload.rule?.name,
          eventTrigger: payload.rule?.eventTrigger,
          isActive: payload.rule?.isActive,
        },
      });
    } catch (err) {
      this.logger.error('Failed to record audit log for automation_rule.updated', err);
    }
  }

  @OnEvent('automation_rule.deleted', { async: true })
  async handleAutomationRuleDeleted(payload: any): Promise<void> {
    try {
      if (!payload?.workspaceId) return;
      await this.log({
        workspaceId: payload.workspaceId,
        userId: payload.userId ?? null,
        action: 'AUTOMATION_RULE_DELETED',
        resourceType: 'AUTOMATION_RULE',
        resourceId: payload.ruleId,
        payload: {
          name: payload.name,
        },
      });
    } catch (err) {
      this.logger.error('Failed to record audit log for automation_rule.deleted', err);
    }
  }
}
