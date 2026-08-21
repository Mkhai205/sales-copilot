import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { TeamMember } from '../../infrastructure/database';
import {
  CreateTeamDto,
  TeamDto,
  TeamMemberDto,
  UpdateTeamDto,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database';

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lists all teams within a workspace with their member count.
   */
  async listTeams(workspaceId: string): Promise<TeamDto[]> {
    const client = this.prisma.getClient();
    const teams = await client.team.findMany({
      where: { workspaceId },
      include: {
        _count: {
          select: { members: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return teams.map(t => ({
      id: t.id,
      workspaceId: t.workspaceId,
      name: t.name,
      description: t.description,
      memberCount: t._count.members,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
  }

  /**
   * Retrieves a single team by ID within a workspace, including its members.
   */
  async getTeamById(workspaceId: string, teamId: string): Promise<TeamDto> {
    const client = this.prisma.getClient();
    const team = await client.team.findFirst({
      where: { id: teamId, workspaceId },
      include: {
        _count: {
          select: { members: true },
        },
        members: {
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
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!team) {
      throw new NotFoundException({
        code: 'TEAM_NOT_FOUND',
        message: `Team with id '${teamId}' not found in this workspace`,
      });
    }

    return {
      id: team.id,
      workspaceId: team.workspaceId,
      name: team.name,
      description: team.description,
      memberCount: team._count.members,
      members: team.members.map(m => this.mapTeamMemberToDto(m)),
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
    };
  }

  /**
   * Creates a new team in the workspace.
   * Enforces name uniqueness within the same workspace.
   */
  async createTeam(workspaceId: string, dto: CreateTeamDto): Promise<TeamDto> {
    const client = this.prisma.getClient();

    // Check if team name already exists in this workspace
    const existing = await client.team.findUnique({
      where: {
        workspaceId_name: {
          workspaceId,
          name: dto.name,
        },
      },
    });

    if (existing) {
      throw new ConflictException({
        code: 'TEAM_NAME_ALREADY_EXISTS',
        message: `A team named '${dto.name}' already exists in this workspace`,
      });
    }

    const created = await client.team.create({
      data: {
        workspaceId,
        name: dto.name,
        description: dto.description ?? null,
      },
    });

    this.logger.log(`Created team '${created.name}' (${created.id}) in workspace '${workspaceId}'`);

    return {
      id: created.id,
      workspaceId: created.workspaceId,
      name: created.name,
      description: created.description,
      memberCount: 0,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  /**
   * Updates team information (name, description).
   */
  async updateTeam(workspaceId: string, teamId: string, dto: UpdateTeamDto): Promise<TeamDto> {
    const client = this.prisma.getClient();

    const existing = await client.team.findFirst({
      where: { id: teamId, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'TEAM_NOT_FOUND',
        message: `Team with id '${teamId}' not found in this workspace`,
      });
    }

    // If changing name, check uniqueness
    if (dto.name && dto.name !== existing.name) {
      const nameConflict = await client.team.findUnique({
        where: {
          workspaceId_name: {
            workspaceId,
            name: dto.name,
          },
        },
      });

      if (nameConflict) {
        throw new ConflictException({
          code: 'TEAM_NAME_ALREADY_EXISTS',
          message: `A team named '${dto.name}' already exists in this workspace`,
        });
      }
    }

    const updated = await client.team.update({
      where: { id: teamId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    this.logger.log(`Updated team '${updated.id}' in workspace '${workspaceId}'`);

    return {
      id: updated.id,
      workspaceId: updated.workspaceId,
      name: updated.name,
      description: updated.description,
      memberCount: updated._count.members,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Deletes a team and cascades member relations.
   */
  async deleteTeam(workspaceId: string, teamId: string): Promise<{ success: boolean }> {
    const client = this.prisma.getClient();

    const existing = await client.team.findFirst({
      where: { id: teamId, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'TEAM_NOT_FOUND',
        message: `Team with id '${teamId}' not found in this workspace`,
      });
    }

    await client.team.delete({
      where: { id: teamId },
    });

    this.logger.log(`Deleted team '${teamId}' from workspace '${workspaceId}'`);
    return { success: true };
  }

  /**
   * Lists all members of a specific team.
   */
  async listTeamMembers(workspaceId: string, teamId: string): Promise<TeamMemberDto[]> {
    const client = this.prisma.getClient();

    const team = await client.team.findFirst({
      where: { id: teamId, workspaceId },
    });

    if (!team) {
      throw new NotFoundException({
        code: 'TEAM_NOT_FOUND',
        message: `Team with id '${teamId}' not found in this workspace`,
      });
    }

    const members = await client.teamMember.findMany({
      where: { teamId },
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
      orderBy: { createdAt: 'asc' },
    });

    return members.map(m => this.mapTeamMemberToDto(m));
  }

  /**
   * Adds user(s) to a team.
   * INVARIANT: All users must be existing members of the workspace.
   */
  async addTeamMembers(
    workspaceId: string,
    teamId: string,
    userIds: string[],
  ): Promise<TeamMemberDto[]> {
    const client = this.prisma.getClient();

    // 1. Verify team exists in workspace
    const team = await client.team.findFirst({
      where: { id: teamId, workspaceId },
    });

    if (!team) {
      throw new NotFoundException({
        code: 'TEAM_NOT_FOUND',
        message: `Team with id '${teamId}' not found in this workspace`,
      });
    }

    // 2. Invariant: Check that all userIds are WorkspaceMembers of this workspace
    const workspaceMembers = await client.workspaceMember.findMany({
      where: {
        workspaceId,
        userId: { in: userIds },
      },
      select: { userId: true },
    });

    const validUserIds = new Set(workspaceMembers.map(wm => wm.userId));
    const invalidUserIds = userIds.filter(id => !validUserIds.has(id));

    if (invalidUserIds.length > 0) {
      throw new BadRequestException({
        code: 'INVALID_TEAM_MEMBERS',
        message: 'All team members must be active members of the workspace',
        details: { invalidUserIds },
      });
    }

    // 3. Add members (skip duplicates)
    for (const userId of userIds) {
      try {
        await client.teamMember.create({
          data: {
            teamId,
            userId,
          },
        });
      } catch (err: any) {
        // P2002: unique constraint failed on [teamId, userId] -> skip already added
        if (err?.code !== 'P2002') throw err;
      }
    }

    this.logger.log(`Added members [${userIds.join(', ')}] to team '${teamId}'`);
    return this.listTeamMembers(workspaceId, teamId);
  }

  /**
   * Removes member(s) from a team.
   */
  async removeTeamMembers(
    workspaceId: string,
    teamId: string,
    userIds: string[],
  ): Promise<{ success: boolean }> {
    const client = this.prisma.getClient();

    const team = await client.team.findFirst({
      where: { id: teamId, workspaceId },
    });

    if (!team) {
      throw new NotFoundException({
        code: 'TEAM_NOT_FOUND',
        message: `Team with id '${teamId}' not found in this workspace`,
      });
    }

    await client.teamMember.deleteMany({
      where: {
        teamId,
        userId: { in: userIds },
      },
    });

    this.logger.log(`Removed members [${userIds.join(', ')}] from team '${teamId}'`);
    return { success: true };
  }

  private mapTeamMemberToDto(
    member: TeamMember & {
      user?: {
        id: string;
        email: string;
        name: string;
        avatarUrl?: string | null;
      } | null;
    },
  ): TeamMemberDto {
    return {
      id: member.id,
      teamId: member.teamId,
      userId: member.userId,
      user: member.user
        ? {
            id: member.user.id,
            email: member.user.email,
            name: member.user.name,
            avatarUrl: member.user.avatarUrl ?? null,
          }
        : undefined,
      createdAt: member.createdAt,
    };
  }
}
