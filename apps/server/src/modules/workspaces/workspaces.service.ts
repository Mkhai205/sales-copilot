import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Workspace } from '../../infrastructure/database';
import {
  BillingPlanType,
  CreateWorkspaceDto,
  UpdateWorkspaceDto,
  UserWorkspaceDto,
  WorkspaceDto,
  WorkspaceRole,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database';
import { generateSlug } from './utils/slug.util';

@Injectable()
export class WorkspacesService {
  private readonly logger = new Logger(WorkspacesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Provisions a new Workspace and assigns the creating user as OWNER atomically.
   * Handles slug uniqueness collisions by catching DB unique constraint errors (P2002)
   * and retrying with a timestamp-based suffix — avoids pre-check race conditions.
   */
  async createWorkspace(userId: string, dto: CreateWorkspaceDto): Promise<WorkspaceDto> {
    const baseSlug = dto.slug ? generateSlug(dto.slug) : generateSlug(dto.name);

    const created = await this.prisma.txManager.runInTransaction(async () => {
      const client = this.prisma.getClient();

      const workspace = await this.createWorkspaceWithUniqueSlug(client, {
        name: dto.name,
        baseSlug,
        timezone: dto.timezone ?? 'Asia/Ho_Chi_Minh',
        defaultLanguage: dto.defaultLanguage ?? 'vi',
      });

      await client.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId,
          role: WorkspaceRole.OWNER,
        },
      });

      return workspace;
    });

    this.logger.log(
      `Created workspace '${created.name}' (${created.id}) for user '${userId}' with slug '${created.slug}'`,
    );
    return this.mapToDto(created);
  }

  /**
   * Retrieves all workspaces that the user is an active member of, with their role.
   */
  async findWorkspacesByUserId(userId: string): Promise<UserWorkspaceDto[]> {
    const client = this.prisma.getClient();
    const members = await client.workspaceMember.findMany({
      where: { userId },
      include: { workspace: true },
      orderBy: { createdAt: 'asc' },
    });

    return members.map(m => ({
      ...this.mapToDto(m.workspace),
      role: m.role as WorkspaceRole,
    }));
  }

  /**
   * Finds a workspace membership record for tenant validation.
   * Used by WorkspaceGuard to verify the caller belongs to the requested workspace.
   * Returns null when membership does not exist (caller should throw ForbiddenException).
   */
  async findMember(
    workspaceId: string,
    userId: string,
  ): Promise<{ id: string; role: WorkspaceRole; workspace: Workspace } | null> {
    const client = this.prisma.getClient();
    const member = await client.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      include: { workspace: true },
    });

    if (!member) return null;

    return {
      id: member.id,
      role: member.role as WorkspaceRole,
      workspace: member.workspace,
    };
  }

  /**
   * Updates workspace settings (name, timezone, defaultLanguage, settings).
   *
   * @precondition Caller MUST have already passed WorkspaceGuard and verified
   * that the authenticated user holds OWNER or ADMIN role for this workspace.
   * This method does NOT perform role authorization — that is enforced at the
   * controller layer via WorkspaceGuard + explicit role check in the controller.
   */
  async updateWorkspace(workspaceId: string, dto: UpdateWorkspaceDto): Promise<WorkspaceDto> {
    const client = this.prisma.getClient();
    const existing = await client.workspace.findUnique({ where: { id: workspaceId } });

    if (!existing) {
      throw new NotFoundException({
        code: 'WORKSPACE_NOT_FOUND',
        message: `Workspace with id '${workspaceId}' not found`,
      });
    }

    const updated = await client.workspace.update({
      where: { id: workspaceId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.timezone !== undefined && { timezone: dto.timezone }),
        ...(dto.defaultLanguage !== undefined && { defaultLanguage: dto.defaultLanguage }),
        ...(dto.settings !== undefined && { settings: dto.settings as any }),
      },
    });

    return this.mapToDto(updated);
  }

  /**
   * Internal method: returns workspace details by ID without any membership check.
   * Only safe to call after WorkspaceGuard has already verified that the requesting
   * user is a member of this workspace (i.e., the workspaceId comes from WorkspaceContext).
   */
  private async getWorkspaceByIdInternal(workspaceId: string): Promise<WorkspaceDto> {
    const client = this.prisma.getClient();
    const workspace = await client.workspace.findUnique({ where: { id: workspaceId } });

    if (!workspace) {
      throw new NotFoundException({
        code: 'WORKSPACE_NOT_FOUND',
        message: `Workspace with id '${workspaceId}' not found`,
      });
    }

    return this.mapToDto(workspace);
  }

  /**
   * Public accessor used by the controller after WorkspaceGuard has verified membership.
   * Delegates to the internal method — kept separate so callers are explicit about
   * preconditions being met.
   */
  async getWorkspaceForContext(workspaceId: string): Promise<WorkspaceDto> {
    return this.getWorkspaceByIdInternal(workspaceId);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Creates a workspace with a unique slug, retrying on P2002 unique constraint
   * violations instead of using a pre-check loop (which is vulnerable to race conditions).
   */
  private async createWorkspaceWithUniqueSlug(
    client: ReturnType<PrismaService['getClient']>,
    data: { name: string; baseSlug: string; timezone: string; defaultLanguage: string },
  ): Promise<Workspace> {
    const { name, baseSlug, timezone, defaultLanguage } = data;

    const attemptCreate = (slug: string) =>
      client.workspace.create({
        data: { name, slug, timezone, defaultLanguage, billingPlan: BillingPlanType.FREE },
      });

    // First attempt with the clean slug
    try {
      return await attemptCreate(baseSlug);
    } catch (err: any) {
      if (err?.code !== 'P2002') throw err;
    }

    // Collision: retry up to 19 times with incrementing numeric suffix
    for (let i = 2; i <= 20; i++) {
      try {
        return await attemptCreate(`${baseSlug}-${i}`);
      } catch (err: any) {
        if (err?.code !== 'P2002') throw err;
      }
    }

    // Final fallback: timestamp-based suffix guarantees uniqueness
    return attemptCreate(`${baseSlug}-${Date.now().toString(36)}`);
  }

  /**
   * Maps a Prisma Workspace model to a clean WorkspaceDto.
   */
  private mapToDto(workspace: Workspace): WorkspaceDto {
    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      billingPlan: workspace.billingPlan as BillingPlanType,
      timezone: workspace.timezone,
      defaultLanguage: workspace.defaultLanguage,
      settings: workspace.settings as Record<string, unknown> | null,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    };
  }
}
