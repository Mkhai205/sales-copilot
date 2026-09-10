import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  BillingPlanType,
  PaginationMeta,
  PlatformAuditAction,
  PlatformAuditTargetType,
  PlatformWorkspaceDetailDto,
  PlatformWorkspaceListItemDto,
  PlatformWorkspaceMemberDto,
  PlatformWorkspaceQuotasDto,
  PlatformWorkspaceUsageDto,
  QueryPlatformWorkspacesDto,
  ToggleWorkspaceStatusDto,
  UpdateWorkspacePlanDto,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../../infrastructure/database';
import { ActorContext, SystemSettingsService } from './system-settings.service';

@Injectable()
export class PlatformWorkspacesService {
  private readonly logger = new Logger(PlatformWorkspacesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemSettings: SystemSettingsService,
    @Optional() private readonly eventEmitter?: EventEmitter2,
  ) {}

  /**
   * Resolves default quotas for a billing plan dynamically via SystemSettingsService,
   * falling back to safe compile-time constants if database/cache settings are uninitialized.
   */
  async getDefaultQuotas(plan: BillingPlanType | string): Promise<PlatformWorkspaceQuotasDto> {
    const normalizedPlan = (plan || 'FREE').toUpperCase();

    if (normalizedPlan === BillingPlanType.ENTERPRISE) {
      return {
        maxAgents: await this.systemSettings.getSetting<number>(
          'quotas.enterprise.max_agents',
          100,
        ),
        maxChannels: await this.systemSettings.getSetting<number>(
          'quotas.enterprise.max_channels',
          20,
        ),
        storageLimitMb: await this.systemSettings.getSetting<number>(
          'quotas.enterprise.storage_mb',
          50000,
        ),
        aiMonthlyTokens: await this.systemSettings.getSetting<number>(
          'quotas.enterprise.ai_monthly_tokens',
          5000000,
        ),
      };
    }

    if (normalizedPlan === BillingPlanType.STANDARD) {
      return {
        maxAgents: await this.systemSettings.getSetting<number>('quotas.standard.max_agents', 10),
        maxChannels: await this.systemSettings.getSetting<number>(
          'quotas.standard.max_channels',
          5,
        ),
        storageLimitMb: await this.systemSettings.getSetting<number>(
          'quotas.standard.storage_mb',
          5000,
        ),
        aiMonthlyTokens: await this.systemSettings.getSetting<number>(
          'quotas.standard.ai_monthly_tokens',
          500000,
        ),
      };
    }

    // Default to FREE tier
    return {
      maxAgents: await this.systemSettings.getSetting<number>('quotas.free.max_agents', 2),
      maxChannels: await this.systemSettings.getSetting<number>('quotas.free.max_channels', 2),
      storageLimitMb: await this.systemSettings.getSetting<number>('quotas.free.storage_mb', 500),
      aiMonthlyTokens: await this.systemSettings.getSetting<number>(
        'quotas.free.ai_monthly_tokens',
        50000,
      ),
    };
  }

  /**
   * Returns a paginated list of workspaces supporting multi-field search and advanced filters.
   */
  async getWorkspaces(
    query: Partial<QueryPlatformWorkspacesDto> = {},
  ): Promise<{ items: PlatformWorkspaceListItemDto[]; meta: PaginationMeta }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (query.search && query.search.trim()) {
      const s = query.search.trim();
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { slug: { contains: s, mode: 'insensitive' } },
        {
          members: {
            some: {
              user: {
                OR: [
                  { email: { contains: s, mode: 'insensitive' } },
                  { name: { contains: s, mode: 'insensitive' } },
                ],
              },
            },
          },
        },
      ];
    }

    if (query.plan) {
      where.billingPlan = query.plan;
    }

    if (query.status === 'ACTIVE') {
      where.isSuspended = false;
    } else if (query.status === 'SUSPENDED') {
      where.isSuspended = true;
    }

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';
    const orderBy = { [sortBy]: sortOrder };

    const client = this.prisma.getClient();
    const [total, workspaces] = await Promise.all([
      client.workspace.count({ where }),
      client.workspace.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          members: {
            where: { role: 'OWNER' },
            take: 1,
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                },
              },
            },
          },
          _count: {
            select: {
              members: true,
              channels: true,
            },
          },
        },
      }),
    ]);

    const items: PlatformWorkspaceListItemDto[] = workspaces.map((ws: any) => {
      const ownerMember = ws.members?.[0];
      return {
        id: ws.id,
        name: ws.name,
        slug: ws.slug,
        billingPlan: ws.billingPlan,
        isSuspended: ws.isSuspended,
        suspendedReason: ws.suspendedReason,
        suspendedAt: ws.suspendedAt,
        owner: ownerMember?.user
          ? {
              id: ownerMember.user.id,
              email: ownerMember.user.email,
              name: ownerMember.user.name,
            }
          : null,
        memberCount: ws._count?.members ?? 0,
        channelCount: ws._count?.channels ?? 0,
        createdAt: ws.createdAt,
        updatedAt: ws.updatedAt,
      };
    });

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
   * Retrieves full technical and resource consumption details for a single workspace.
   */
  async getWorkspaceDetail(id: string): Promise<PlatformWorkspaceDetailDto> {
    const client = this.prisma.getClient();
    const workspace = await client.workspace.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: {
            channels: true,
          },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException({
        code: 'WORKSPACE_NOT_FOUND',
        message: `Workspace with id '${id}' not found`,
      });
    }

    const defaultQuotas = await this.getDefaultQuotas(workspace.billingPlan);
    const settings = (workspace.settings as Record<string, any>) || {};
    const customQuotas = (settings.quotas as Record<string, any>) || {};

    const effectiveQuotas: PlatformWorkspaceQuotasDto = {
      maxAgents: customQuotas.maxAgents ?? defaultQuotas.maxAgents,
      maxChannels: customQuotas.maxChannels ?? defaultQuotas.maxChannels,
      storageLimitMb: customQuotas.storageLimitMb ?? defaultQuotas.storageLimitMb,
      aiMonthlyTokens: customQuotas.aiMonthlyTokens ?? defaultQuotas.aiMonthlyTokens,
    };

    const usageData = (settings.usage as Record<string, any>) || {};
    const usage: PlatformWorkspaceUsageDto = {
      currentAgents: workspace.members.length,
      currentChannels: workspace._count?.channels ?? 0,
      storageUsedMb: Number(usageData.storageUsedMb) || 0,
      aiUsedTokens: Number(usageData.aiUsedTokens) || 0,
    };

    const members: PlatformWorkspaceMemberDto[] = workspace.members.map((m: any) => ({
      id: m.id,
      userId: m.userId,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
      createdAt: m.createdAt,
    }));

    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      billingPlan: workspace.billingPlan,
      isSuspended: workspace.isSuspended,
      suspendedReason: workspace.suspendedReason,
      suspendedAt: workspace.suspendedAt,
      timezone: workspace.timezone,
      defaultLanguage: workspace.defaultLanguage,
      settings: workspace.settings as Record<string, unknown> | null,
      quotas: effectiveQuotas,
      usage,
      members,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    };
  }

  /**
   * Updates billing plan and custom quota overrides atomically within a database transaction,
   * recording PlatformAuditLog entries for PLAN_CHANGED and/or QUOTA_UPDATED.
   */
  async updateWorkspacePlan(
    id: string,
    dto: UpdateWorkspacePlanDto,
    actor: ActorContext,
  ): Promise<PlatformWorkspaceDetailDto> {
    const client = this.prisma.getClient();
    const existing = await client.workspace.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'WORKSPACE_NOT_FOUND',
        message: `Workspace with id '${id}' not found`,
      });
    }

    const currentSettings = (existing.settings as Record<string, any>) || {};
    const currentQuotas = (currentSettings.quotas as Record<string, any>) || {};

    const updatedQuotas = { ...currentQuotas };
    if (dto.quotas) {
      for (const [key, value] of Object.entries(dto.quotas)) {
        if (value === null) {
          delete updatedQuotas[key];
        } else if (value !== undefined) {
          updatedQuotas[key] = value;
        }
      }
    }

    const planChanged = dto.billingPlan !== undefined && dto.billingPlan !== existing.billingPlan;
    const quotasChanged =
      dto.quotas !== undefined && JSON.stringify(updatedQuotas) !== JSON.stringify(currentQuotas);

    if (planChanged || quotasChanged) {
      const updatedSettings = {
        ...currentSettings,
        quotas: updatedQuotas,
      };

      await this.prisma.runInTransaction(async ctx => {
        await ctx.tx.workspace.update({
          where: { id },
          data: {
            ...(dto.billingPlan !== undefined ? { billingPlan: dto.billingPlan } : {}),
            settings: updatedSettings,
          },
        });

        if (planChanged) {
          await ctx.tx.platformAuditLog.create({
            data: {
              actorId: actor.userId,
              actorEmail: actor.email,
              action: PlatformAuditAction.PLAN_CHANGED,
              targetType: PlatformAuditTargetType.WORKSPACE,
              targetId: id,
              metadata: {
                oldPlan: existing.billingPlan,
                newPlan: dto.billingPlan,
              },
              ipAddress: actor.ipAddress ?? null,
              userAgent: actor.userAgent ?? null,
            },
          });
        }

        if (quotasChanged) {
          await ctx.tx.platformAuditLog.create({
            data: {
              actorId: actor.userId,
              actorEmail: actor.email,
              action: PlatformAuditAction.QUOTA_UPDATED,
              targetType: PlatformAuditTargetType.WORKSPACE,
              targetId: id,
              metadata: {
                oldQuotas: currentQuotas,
                newQuotas: updatedQuotas,
                diff: dto.quotas,
              },
              ipAddress: actor.ipAddress ?? null,
              userAgent: actor.userAgent ?? null,
            },
          });
        }
      });

      if (this.eventEmitter) {
        this.eventEmitter.emit('workspace.plan_updated', {
          workspaceId: id,
          billingPlan: dto.billingPlan ?? existing.billingPlan,
          quotas: updatedQuotas,
        });
      }
    }

    return this.getWorkspaceDetail(id);
  }

  /**
   * Suspends or activates a workspace with mandatory reason tracking and idempotency enforcement.
   * Emits workspace.suspended or workspace.activated events upon commit.
   */
  async toggleWorkspaceSuspension(
    id: string,
    dto: ToggleWorkspaceStatusDto,
    actor: ActorContext,
  ): Promise<PlatformWorkspaceDetailDto> {
    const client = this.prisma.getClient();
    const existing = await client.workspace.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'WORKSPACE_NOT_FOUND',
        message: `Workspace with id '${id}' not found`,
      });
    }

    if (existing.isSuspended === dto.isSuspended) {
      throw new BadRequestException({
        code: dto.isSuspended ? 'WORKSPACE_ALREADY_SUSPENDED' : 'WORKSPACE_ALREADY_ACTIVE',
        message: dto.isSuspended ? 'Workspace is already suspended' : 'Workspace is already active',
      });
    }

    const suspendedAt = dto.isSuspended ? new Date() : null;
    const suspendedReason = dto.isSuspended ? (dto.reason ?? null) : null;

    await this.prisma.runInTransaction(async ctx => {
      await ctx.tx.workspace.update({
        where: { id },
        data: {
          isSuspended: dto.isSuspended,
          suspendedReason,
          suspendedAt,
        },
      });

      await ctx.tx.platformAuditLog.create({
        data: {
          actorId: actor.userId,
          actorEmail: actor.email,
          action: dto.isSuspended
            ? PlatformAuditAction.WORKSPACE_SUSPENDED
            : PlatformAuditAction.WORKSPACE_ACTIVATED,
          targetType: PlatformAuditTargetType.WORKSPACE,
          targetId: id,
          metadata: {
            previousStatus: existing.isSuspended ? 'SUSPENDED' : 'ACTIVE',
            newStatus: dto.isSuspended ? 'SUSPENDED' : 'ACTIVE',
            reason: dto.reason ?? null,
            suspendedAt,
          },
          ipAddress: actor.ipAddress ?? null,
          userAgent: actor.userAgent ?? null,
        },
      });
    });

    if (this.eventEmitter) {
      this.eventEmitter.emit(dto.isSuspended ? 'workspace.suspended' : 'workspace.activated', {
        workspaceId: id,
        reason: dto.reason,
      });
    }

    return this.getWorkspaceDetail(id);
  }
}
