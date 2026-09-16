import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  PaginationMeta,
  PlatformAuditAction,
  PlatformAuditLogDto,
  PlatformAuditTargetType,
  QueryPlatformAuditLogsDto,
} from '@sales-copilot/shared-contracts';
import { Prisma, PrismaService } from '../../../infrastructure/database';

export interface CreatePlatformAuditLogParams {
  actorId: string;
  actorEmail: string;
  action: PlatformAuditAction | string;
  targetType: PlatformAuditTargetType | string;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class PlatformAuditLogsService {
  private readonly logger = new Logger(PlatformAuditLogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves paginated platform audit logs with multi-condition filtering.
   * Logs are always returned in descending order of createdAt.
   */
  async getAuditLogs(query?: Partial<QueryPlatformAuditLogsDto>): Promise<{
    items: PlatformAuditLogDto[];
    meta: PaginationMeta;
  }> {
    const client = this.prisma.getClient();
    const page = Math.max(1, Math.floor(Number(query?.page)) || 1);
    const limit = Math.min(100, Math.max(1, Math.floor(Number(query?.limit)) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.PlatformAuditLogWhereInput = {};

    if (query?.action) {
      where.action = query.action;
    }

    if (query?.targetType) {
      where.targetType = query.targetType;
    }

    if (query?.targetId?.trim()) {
      where.targetId = query.targetId.trim();
    }

    if (query?.actorEmail?.trim()) {
      where.actorEmail = {
        contains: query.actorEmail.trim(),
        mode: 'insensitive',
      };
    }

    if (query?.startDate || query?.endDate) {
      const createdAtFilter: Prisma.DateTimeFilter = {};
      if (query.startDate) {
        const startStr = query.startDate.includes('T')
          ? query.startDate
          : `${query.startDate}T00:00:00.000Z`;
        const start = new Date(startStr);
        if (!isNaN(start.getTime())) {
          createdAtFilter.gte = start;
        }
      }
      if (query.endDate) {
        const endStr = query.endDate.includes('T')
          ? query.endDate
          : `${query.endDate}T23:59:59.999Z`;
        const end = new Date(endStr);
        if (!isNaN(end.getTime())) {
          createdAtFilter.lte = end;
        }
      }
      if (Object.keys(createdAtFilter).length > 0) {
        where.createdAt = createdAtFilter;
      }
    }

    const [total, logs] = await Promise.all([
      client.platformAuditLog.count({ where }),
      client.platformAuditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const items: PlatformAuditLogDto[] = logs.map(log => ({
      id: log.id,
      actorId: log.actorId,
      actorEmail: log.actorEmail,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      metadata: (log.metadata as Record<string, unknown>) ?? null,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt,
    }));

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieves a single platform audit log entry by ID.
   * Throws NotFoundException if the log entry does not exist.
   */
  async getAuditLogById(id: string): Promise<PlatformAuditLogDto> {
    if (!id || typeof id !== 'string' || !id.trim()) {
      throw new NotFoundException({
        code: 'AUDIT_LOG_NOT_FOUND',
        message: `Platform audit log with id '${id}' not found`,
      });
    }

    const client = this.prisma.getClient();
    const log = await client.platformAuditLog.findUnique({
      where: { id: id.trim() },
    });

    if (!log) {
      throw new NotFoundException({
        code: 'AUDIT_LOG_NOT_FOUND',
        message: `Platform audit log with id '${id.trim()}' not found`,
      });
    }

    return {
      id: log.id,
      actorId: log.actorId,
      actorEmail: log.actorEmail,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      metadata: (log.metadata as Record<string, unknown>) ?? null,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt,
    };
  }

  /**
   * Records an immutable platform audit log entry.
   * Supports execution within an existing Prisma transaction or standalone client.
   */
  async logAction(
    entry: CreatePlatformAuditLogParams,
    tx?: Prisma.TransactionClient,
  ): Promise<PlatformAuditLogDto> {
    if (!entry.actorId || !entry.actorEmail || !entry.action || !entry.targetType) {
      this.logger.error('Missing mandatory fields for platform audit log entry', { entry });
      throw new BadRequestException({
        code: 'INVALID_AUDIT_LOG_ENTRY',
        message: 'actorId, actorEmail, action, and targetType are required for platform audit logs',
      });
    }

    try {
      const client = tx ?? this.prisma.client;
      const created = await client.platformAuditLog.create({
        data: {
          actorId: entry.actorId,
          actorEmail: entry.actorEmail,
          action: entry.action,
          targetType: entry.targetType,
          targetId: entry.targetId ?? null,
          metadata: (entry.metadata as any) ?? {},
          ipAddress: entry.ipAddress ?? null,
          userAgent: entry.userAgent ?? null,
        },
      });

      return {
        id: created.id,
        actorId: created.actorId,
        actorEmail: created.actorEmail,
        action: created.action,
        targetType: created.targetType,
        targetId: created.targetId,
        metadata: (created.metadata as Record<string, unknown>) ?? null,
        ipAddress: created.ipAddress,
        userAgent: created.userAgent,
        createdAt: created.createdAt,
      };
    } catch (error) {
      this.logger.error(`Failed to record platform audit log: ${(error as Error)?.message}`, error);
      throw error;
    }
  }
}
