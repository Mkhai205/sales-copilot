import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Workspace, WorkspaceMember } from '../../infrastructure/database';
import {
  AddWorkspaceMemberDto,
  BillingPlanType,
  CreateWorkspaceDto,
  UpdateWorkspaceDto,
  UpdateWorkspaceMemberRoleDto,
  UserWorkspaceDto,
  WorkspaceDto,
  WorkspaceMemberDto,
  WorkspaceRole,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database';
import { generateSlug } from './utils/slug.util';

@Injectable()
export class WorkspacesService {
  private readonly logger = new Logger(WorkspacesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly eventEmitter?: EventEmitter2,
  ) {}

  /**
   * Provisions a new Workspace and assigns the creating user as OWNER atomically.
   * Handles slug uniqueness collisions by catching DB unique constraint errors (P2002)
   * and retrying with a timestamp-based suffix — avoids pre-check race conditions.
   */
  async createWorkspace(userId: string, dto: CreateWorkspaceDto): Promise<WorkspaceDto> {
    const rawBaseSlug = dto.slug ? generateSlug(dto.slug) : generateSlug(dto.name);
    let baseSlug = rawBaseSlug;

    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const candidateSlug = await this.resolveAvailableSlug(baseSlug);

        const created = await this.prisma.runInTransaction(async () => {
          const client = this.prisma.client;

          const workspace = await client.workspace.create({
            data: {
              name: dto.name,
              slug: candidateSlug,
              timezone: dto.timezone ?? 'Asia/Ho_Chi_Minh',
              defaultLanguage: dto.defaultLanguage ?? 'vi',
              billingPlan: BillingPlanType.FREE,
            },
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
      } catch (err: any) {
        if (err?.code === 'P2002' && attempt < maxRetries) {
          baseSlug = `${rawBaseSlug}-${Math.random().toString(36).slice(2, 6)}`;
          continue;
        }
        throw err;
      }
    }

    throw new ConflictException({
      code: 'WORKSPACE_SLUG_COLLISION',
      message: 'Could not allocate a unique slug for workspace',
    });
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
  // Workspace Members Management Logic (Feature F-1.1.3)
  // ---------------------------------------------------------------------------

  /**
   * Checks whether a user is an active member of a workspace.
   */
  async isMember(workspaceId: string, userId: string): Promise<boolean> {
    const member = await this.prisma.getClient().workspaceMember.findFirst({
      where: { workspaceId, userId },
      select: { id: true },
    });
    return Boolean(member);
  }

  /**
   * Verifies that a user is an active member of a workspace, throwing ForbiddenException if not.
   */
  async verifyMembership(workspaceId: string, userId: string): Promise<void> {
    const isMember = await this.isMember(workspaceId, userId);
    if (!isMember) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You do not have access to this workspace',
      });
    }
  }

  /**
   * Retrieves all members of a workspace, including user profile details.
   */
  async findMembersByWorkspaceId(workspaceId: string): Promise<WorkspaceMemberDto[]> {
    const client = this.prisma.getClient();
    const members = await client.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            isActive: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return members.map(m => this.mapMemberToDto(m));
  }

  /**
   * Adds an existing user to the workspace by their email address.
   */
  async addMemberByEmail(
    workspaceId: string,
    actorUserId: string,
    actorRole: WorkspaceRole,
    dto: AddWorkspaceMemberDto,
  ): Promise<WorkspaceMemberDto> {
    const client = this.prisma.getClient();

    // 1. Verify target user exists
    const user = await client.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: `User with email '${dto.email}' does not exist`,
      });
    }

    if (!user.isActive) {
      throw new BadRequestException({
        code: 'USER_INACTIVE',
        message: 'Cannot add deactivated user to workspace',
      });
    }

    // 2. Check if already a member
    const existing = await client.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
    });

    if (existing) {
      throw new ConflictException({
        code: 'MEMBER_ALREADY_EXISTS',
        message: `User with email '${dto.email}' is already a member of this workspace`,
      });
    }

    // 3. Create membership
    const created = await client.workspaceMember.create({
      data: {
        workspaceId,
        userId: user.id,
        role: dto.role,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            isActive: true,
          },
        },
      },
    });

    this.logger.log(
      `User '${actorUserId}' (${actorRole}) added user '${user.id}' (${dto.email}) with role '${dto.role}' to workspace '${workspaceId}'`,
    );

    if (this.eventEmitter) {
      this.eventEmitter.emit('workspace_member.added', {
        workspaceId,
        memberId: created.id,
        userId: user.id,
        email: user.email,
        role: dto.role,
        performedByUserId: actorUserId,
      });
    }

    return this.mapMemberToDto(created);
  }

  /**
   * Updates the role of an existing workspace member.
   */
  async updateMemberRole(
    workspaceId: string,
    memberId: string,
    actorUserId: string,
    actorRole: WorkspaceRole,
    dto: UpdateWorkspaceMemberRoleDto,
  ): Promise<WorkspaceMemberDto> {
    const client = this.prisma.getClient();

    // 1. Verify target member exists in this workspace
    const member = await client.workspaceMember.findFirst({
      where: { id: memberId, workspaceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            isActive: true,
          },
        },
      },
    });

    if (!member) {
      throw new NotFoundException({
        code: 'MEMBER_NOT_FOUND',
        message: `Workspace member with id '${memberId}' not found`,
      });
    }

    // 2. Invariant: Admin cannot modify an Owner
    if (actorRole === WorkspaceRole.ADMIN && member.role === WorkspaceRole.OWNER) {
      throw new ForbiddenException({
        code: 'CANNOT_MODIFY_OWNER',
        message: 'Only workspace owners can modify owner roles',
      });
    }

    // 3. Invariant: Cannot demote the only OWNER in workspace
    if (member.role === WorkspaceRole.OWNER) {
      const ownerCount = await client.workspaceMember.count({
        where: { workspaceId, role: WorkspaceRole.OWNER },
      });

      if (ownerCount <= 1) {
        throw new BadRequestException({
          code: 'CANNOT_DEMOTE_LAST_OWNER',
          message: 'Cannot demote the only owner of the workspace',
        });
      }
    }

    // 4. Update member role
    const updated = await client.workspaceMember.update({
      where: { id: memberId },
      data: { role: dto.role },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            isActive: true,
          },
        },
      },
    });

    this.logger.log(
      `User '${actorUserId}' updated member '${memberId}' role from '${member.role}' to '${dto.role}' in workspace '${workspaceId}'`,
    );

    if (this.eventEmitter) {
      this.eventEmitter.emit('workspace_member.role_updated', {
        workspaceId,
        memberId,
        userId: member.userId,
        oldRole: member.role,
        newRole: dto.role,
        performedByUserId: actorUserId,
      });
    }

    return this.mapMemberToDto(updated);
  }

  /**
   * Removes a member from the workspace.
   */
  async removeMember(
    workspaceId: string,
    memberId: string,
    actorUserId: string,
    actorRole: WorkspaceRole,
  ): Promise<{ success: boolean }> {
    const client = this.prisma.getClient();

    // 1. Verify target member exists in this workspace
    const member = await client.workspaceMember.findFirst({
      where: { id: memberId, workspaceId },
    });

    if (!member) {
      throw new NotFoundException({
        code: 'MEMBER_NOT_FOUND',
        message: `Workspace member with id '${memberId}' not found`,
      });
    }

    // 2. Invariant: Admin cannot remove an Owner
    if (actorRole === WorkspaceRole.ADMIN && member.role === WorkspaceRole.OWNER) {
      throw new ForbiddenException({
        code: 'CANNOT_REMOVE_OWNER',
        message: 'Only workspace owners can remove another owner',
      });
    }

    // 3. Invariant: Cannot remove the only OWNER in workspace
    if (member.role === WorkspaceRole.OWNER) {
      const ownerCount = await client.workspaceMember.count({
        where: { workspaceId, role: WorkspaceRole.OWNER },
      });

      if (ownerCount <= 1) {
        throw new BadRequestException({
          code: 'CANNOT_REMOVE_LAST_OWNER',
          message: 'Cannot remove the only owner of the workspace',
        });
      }
    }

    // 4. Delete member
    await client.workspaceMember.delete({
      where: { id: memberId },
    });

    this.logger.log(
      `User '${actorUserId}' removed member '${memberId}' (${member.role}) from workspace '${workspaceId}'`,
    );

    if (this.eventEmitter) {
      this.eventEmitter.emit('workspace_member.removed', {
        workspaceId,
        memberId,
        userId: member.userId,
        role: member.role,
        performedByUserId: actorUserId,
      });
    }

    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Resolves an available, unique slug candidate by querying the database outside
   * of transaction blocks to prevent PostgreSQL transaction aborts (25P02).
   */
  private async resolveAvailableSlug(baseSlug: string): Promise<string> {
    const client = this.prisma.getClient();
    const existing = await client.workspace.findUnique({ where: { slug: baseSlug } });
    if (!existing) return baseSlug;

    // Collision: check up to 20 incrementing numeric suffixes
    for (let i = 2; i <= 20; i++) {
      const candidate = `${baseSlug}-${i}`;
      const found = await client.workspace.findUnique({ where: { slug: candidate } });
      if (!found) return candidate;
    }

    // Final fallback: timestamp-based suffix guarantees uniqueness
    return `${baseSlug}-${Date.now().toString(36)}`;
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

  /**
   * Maps a Prisma WorkspaceMember model to a clean WorkspaceMemberDto.
   */
  private mapMemberToDto(
    member: WorkspaceMember & {
      user?: {
        id: string;
        email: string;
        name: string;
        avatarUrl?: string | null;
        isActive?: boolean;
      } | null;
    },
  ): WorkspaceMemberDto {
    return {
      id: member.id,
      workspaceId: member.workspaceId,
      userId: member.userId,
      role: member.role as WorkspaceRole,
      user: member.user
        ? {
            id: member.user.id,
            email: member.user.email,
            name: member.user.name,
            avatarUrl: member.user.avatarUrl ?? null,
            isActive: member.user.isActive,
          }
        : undefined,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
    };
  }
}
