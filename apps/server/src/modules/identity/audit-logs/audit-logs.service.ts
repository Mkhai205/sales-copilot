import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type {
  AuditLogDto,
  AuditLogListQueryDto,
  PaginationMeta,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

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

    this.logger.log(
      `AuditLog [${created.action}] on ${created.resourceType}${created.resourceId ? `:${created.resourceId}` : ''} in workspace '${created.workspaceId}' by actor '${created.userId}'`,
    );

    return created as unknown as AuditLogDto;
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
      items: items as unknown as AuditLogDto[],
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

  // NOTE: `contact.merged` is intentionally NOT audited here — the merge
  // transaction in ContactsService.merge writes the canonical CONTACT_MERGED
  // entry atomically with the change (this listener used to write a duplicate
  // with a different shape, racing the closing transaction).

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

  @OnEvent('workspace_member.added', { async: true })
  async handleWorkspaceMemberAdded(payload: any): Promise<void> {
    try {
      if (!payload?.workspaceId) return;
      await this.log({
        workspaceId: payload.workspaceId,
        userId: payload.performedByUserId ?? null,
        action: 'WORKSPACE_MEMBER_ADDED',
        resourceType: 'WORKSPACE_MEMBER',
        resourceId: payload.memberId,
        payload: {
          userId: payload.userId,
          email: payload.email,
          role: payload.role,
        },
      });
    } catch (err) {
      this.logger.error('Failed to record audit log for workspace_member.added', err);
    }
  }

  @OnEvent('workspace_member.role_updated', { async: true })
  async handleWorkspaceMemberRoleUpdated(payload: any): Promise<void> {
    try {
      if (!payload?.workspaceId) return;
      await this.log({
        workspaceId: payload.workspaceId,
        userId: payload.performedByUserId ?? null,
        action: 'WORKSPACE_MEMBER_ROLE_UPDATED',
        resourceType: 'WORKSPACE_MEMBER',
        resourceId: payload.memberId,
        payload: {
          userId: payload.userId,
          oldRole: payload.oldRole,
          newRole: payload.newRole,
        },
      });
    } catch (err) {
      this.logger.error('Failed to record audit log for workspace_member.role_updated', err);
    }
  }

  @OnEvent('workspace_member.removed', { async: true })
  async handleWorkspaceMemberRemoved(payload: any): Promise<void> {
    try {
      if (!payload?.workspaceId) return;
      await this.log({
        workspaceId: payload.workspaceId,
        userId: payload.performedByUserId ?? null,
        action: 'WORKSPACE_MEMBER_REMOVED',
        resourceType: 'WORKSPACE_MEMBER',
        resourceId: payload.memberId,
        payload: {
          userId: payload.userId,
          role: payload.role,
        },
      });
    } catch (err) {
      this.logger.error('Failed to record audit log for workspace_member.removed', err);
    }
  }
}
