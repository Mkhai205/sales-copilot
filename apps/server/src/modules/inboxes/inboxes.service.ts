import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ChannelDetailDto,
  ChannelSummaryDto,
  ChannelType,
  CreateInboxDto,
  InboxDetailDto,
  InboxDto,
  InboxMemberDto,
  UpdateInboxDto,
  WorkspaceRole,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database';
import { ChannelCredentialService } from './channel-credential.service';

@Injectable()
export class InboxesService {
  private readonly logger = new Logger(InboxesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credentialService: ChannelCredentialService,
  ) {}

  /**
   * Helper to safely decrypt channel credentials stored at rest.
   */
  private decryptCredentials(rawCredentials: unknown): Record<string, unknown> {
    if (!rawCredentials) return {};

    if (typeof rawCredentials === 'object' && rawCredentials !== null) {
      const credsObj = rawCredentials as Record<string, any>;
      if (credsObj.encrypted && typeof credsObj.encrypted === 'string') {
        try {
          return this.credentialService.decrypt(credsObj.encrypted);
        } catch {
          this.logger.warn('Failed to decrypt channel credentials');
          return {};
        }
      }
    } else if (typeof rawCredentials === 'string' && rawCredentials.includes(':')) {
      try {
        return this.credentialService.decrypt(rawCredentials);
      } catch {
        this.logger.warn('Failed to decrypt channel credentials string');
        return {};
      }
    }

    return {};
  }

  /**
   * Formats a channel database entity into a summary DTO (omitting credentials).
   */
  private mapChannelSummary(channel: any): ChannelSummaryDto | null {
    if (!channel) return null;
    return {
      id: channel.id,
      workspaceId: channel.workspaceId,
      inboxId: channel.inboxId,
      channelType: channel.channelType as ChannelType,
      providerAccountId: channel.providerAccountId,
      settings: (channel.settings as Record<string, unknown>) || {},
      isConnected: channel.isConnected,
      createdAt: channel.createdAt.toISOString(),
      updatedAt: channel.updatedAt.toISOString(),
    };
  }

  /**
   * Formats a channel database entity into a detailed DTO (including decrypted credentials).
   */
  private mapChannelDetail(channel: any): ChannelDetailDto | null {
    if (!channel) return null;
    const summary = this.mapChannelSummary(channel);
    if (!summary) return null;

    return {
      ...summary,
      credentials: this.decryptCredentials(channel.credentials),
    };
  }

  /**
   * Creates an Inbox and linked Channel (1:1) in a single database transaction.
   * Credentials are encrypted using AES-256-GCM before database insertion.
   */
  async createInbox(workspaceId: string, dto: CreateInboxDto): Promise<InboxDetailDto> {
    const client = this.prisma.getClient();

    // Check providerAccountId conflict if supplied
    if (dto.providerAccountId) {
      const existingChannel = await client.channel.findFirst({
        where: {
          workspaceId,
          channelType: dto.channelType as any,
          providerAccountId: dto.providerAccountId,
        },
      });

      if (existingChannel) {
        throw new ConflictException({
          code: 'CHANNEL_ALREADY_EXISTS',
          message: `A channel for ${dto.channelType} with provider account ID '${dto.providerAccountId}' already exists in this workspace`,
          details: { channelType: dto.channelType, providerAccountId: dto.providerAccountId },
        });
      }
    }

    // Encrypt credentials if provided
    let encryptedCredentials: Record<string, unknown> = {};
    if (dto.channelCredentials && Object.keys(dto.channelCredentials).length > 0) {
      const encryptedString = this.credentialService.encrypt(dto.channelCredentials);
      encryptedCredentials = { encrypted: encryptedString };
    }

    const inboxSettings = {
      ...(dto.settings ?? {}),
      ...(dto.greetingMessage !== undefined ? { greetingMessage: dto.greetingMessage } : {}),
    };

    return this.prisma.runInTransaction(async txCtx => {
      const tx = txCtx.tx;

      const inbox = await tx.inbox.create({
        data: {
          workspaceId,
          name: dto.name,
          avatarUrl: dto.avatarUrl ?? null,
          isAutoAssignmentEnabled: dto.isAutoAssignmentEnabled ?? false,
          settings: inboxSettings as any,
        },
      });

      const channel = await tx.channel.create({
        data: {
          workspaceId,
          inboxId: inbox.id,
          channelType: dto.channelType as any,
          providerAccountId: dto.providerAccountId ?? null,
          credentials: encryptedCredentials as any,
          settings: (dto.channelSettings as any) ?? {},
          isConnected: Object.keys(dto.channelCredentials ?? {}).length > 0,
        },
      });

      this.logger.log(
        `Created inbox '${inbox.name}' (${inbox.id}) with channel ${channel.channelType} in workspace ${workspaceId}`,
      );

      const settingsObj = (inbox.settings as Record<string, unknown>) || {};
      return {
        id: inbox.id,
        workspaceId: inbox.workspaceId,
        name: inbox.name,
        avatarUrl: inbox.avatarUrl,
        channelType: channel.channelType as ChannelType,
        greetingMessage: settingsObj.greetingMessage as string | undefined,
        settings: settingsObj,
        isAutoAssignmentEnabled: inbox.isAutoAssignmentEnabled,
        memberCount: 0,
        channel: this.mapChannelDetail(channel),
        createdAt: inbox.createdAt.toISOString(),
        updatedAt: inbox.updatedAt.toISOString(),
      };
    });
  }

  /**
   * Lists all inboxes in a workspace.
   * Security Invariant: Credentials MUST be omitted from channel objects in list responses.
   */
  async listInboxes(workspaceId: string): Promise<InboxDto[]> {
    const client = this.prisma.getClient();

    const inboxes = await client.inbox.findMany({
      where: { workspaceId },
      include: {
        channel: true,
        _count: {
          select: { members: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return inboxes.map(inbox => {
      const settingsObj = (inbox.settings as Record<string, unknown>) || {};
      return {
        id: inbox.id,
        workspaceId: inbox.workspaceId,
        name: inbox.name,
        avatarUrl: inbox.avatarUrl,
        channelType: (inbox.channel?.channelType as ChannelType) || ChannelType.WEB_CHAT,
        greetingMessage: settingsObj.greetingMessage as string | undefined,
        settings: settingsObj,
        isAutoAssignmentEnabled: inbox.isAutoAssignmentEnabled,
        memberCount: inbox._count.members,
        channel: this.mapChannelSummary(inbox.channel),
        createdAt: inbox.createdAt.toISOString(),
        updatedAt: inbox.updatedAt.toISOString(),
      };
    });
  }

  /**
   * Retrieves full inbox details by ID within a workspace, including decrypted channel credentials.
   */
  async getInboxById(workspaceId: string, inboxId: string): Promise<InboxDetailDto> {
    const client = this.prisma.getClient();

    const inbox = await client.inbox.findFirst({
      where: { id: inboxId, workspaceId },
      include: {
        channel: true,
        _count: {
          select: { members: true },
        },
      },
    });

    if (!inbox) {
      throw new NotFoundException({
        code: 'INBOX_NOT_FOUND',
        message: `Inbox with ID '${inboxId}' not found in this workspace`,
        details: { inboxId, workspaceId },
      });
    }

    const settingsObj = (inbox.settings as Record<string, unknown>) || {};
    return {
      id: inbox.id,
      workspaceId: inbox.workspaceId,
      name: inbox.name,
      avatarUrl: inbox.avatarUrl,
      channelType: (inbox.channel?.channelType as ChannelType) || ChannelType.WEB_CHAT,
      greetingMessage: settingsObj.greetingMessage as string | undefined,
      settings: settingsObj,
      isAutoAssignmentEnabled: inbox.isAutoAssignmentEnabled,
      memberCount: inbox._count.members,
      channel: this.mapChannelDetail(inbox.channel),
      createdAt: inbox.createdAt.toISOString(),
      updatedAt: inbox.updatedAt.toISOString(),
    };
  }

  /**
   * Updates inbox and channel configuration.
   * Re-encrypts channel credentials if provided.
   */
  async updateInbox(
    workspaceId: string,
    inboxId: string,
    dto: UpdateInboxDto,
  ): Promise<InboxDetailDto> {
    const client = this.prisma.getClient();

    const existing = await client.inbox.findFirst({
      where: { id: inboxId, workspaceId },
      include: { channel: true },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'INBOX_NOT_FOUND',
        message: `Inbox with ID '${inboxId}' not found in this workspace`,
        details: { inboxId, workspaceId },
      });
    }

    // Check providerAccountId conflict if changing providerAccountId
    if (dto.providerAccountId && existing.channel) {
      const conflict = await client.channel.findFirst({
        where: {
          workspaceId,
          channelType: existing.channel.channelType,
          providerAccountId: dto.providerAccountId,
          NOT: { id: existing.channel.id },
        },
      });

      if (conflict) {
        throw new ConflictException({
          code: 'CHANNEL_ALREADY_EXISTS',
          message: `A channel for ${existing.channel.channelType} with provider account ID '${dto.providerAccountId}' already exists in this workspace`,
          details: {
            channelType: existing.channel.channelType,
            providerAccountId: dto.providerAccountId,
          },
        });
      }
    }

    let encryptedCredentials: Record<string, unknown> | undefined;
    if (dto.channelCredentials !== undefined) {
      if (Object.keys(dto.channelCredentials).length > 0) {
        const encryptedString = this.credentialService.encrypt(dto.channelCredentials);
        encryptedCredentials = { encrypted: encryptedString };
      } else {
        encryptedCredentials = {};
      }
    }

    const existingSettings = (existing.settings as Record<string, unknown>) || {};
    const updatedSettings = {
      ...existingSettings,
      ...(dto.settings ?? {}),
      ...(dto.greetingMessage !== undefined ? { greetingMessage: dto.greetingMessage } : {}),
    };

    return this.prisma.runInTransaction(async txCtx => {
      const tx = txCtx.tx;

      await tx.inbox.update({
        where: { id: inboxId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
          ...(dto.isAutoAssignmentEnabled !== undefined
            ? { isAutoAssignmentEnabled: dto.isAutoAssignmentEnabled }
            : {}),
          settings: updatedSettings as any,
        },
      });

      if (existing.channel) {
        const existingChannelSettings =
          (existing.channel.settings as Record<string, unknown>) || {};
        const updatedChannelSettings = {
          ...existingChannelSettings,
          ...(dto.channelSettings ?? {}),
        };

        await tx.channel.update({
          where: { id: existing.channel.id },
          data: {
            ...(dto.providerAccountId !== undefined
              ? { providerAccountId: dto.providerAccountId }
              : {}),
            ...(dto.isConnected !== undefined ? { isConnected: dto.isConnected } : {}),
            ...(dto.channelSettings !== undefined
              ? { settings: updatedChannelSettings as any }
              : {}),
            ...(encryptedCredentials !== undefined
              ? { credentials: encryptedCredentials as any }
              : {}),
          },
        });
      }

      this.logger.log(`Updated inbox '${inboxId}' in workspace ${workspaceId}`);

      return this.getInboxById(workspaceId, inboxId);
    });
  }

  /**
   * Deletes an inbox and cascades deletion to linked channel and members.
   */
  async deleteInbox(
    workspaceId: string,
    inboxId: string,
  ): Promise<{ success: boolean; message: string }> {
    const client = this.prisma.getClient();

    const existing = await client.inbox.findFirst({
      where: { id: inboxId, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'INBOX_NOT_FOUND',
        message: `Inbox with ID '${inboxId}' not found in this workspace`,
        details: { inboxId, workspaceId },
      });
    }

    await client.inbox.delete({
      where: { id: inboxId },
    });

    this.logger.log(`Deleted inbox '${inboxId}' from workspace ${workspaceId}`);
    return { success: true, message: 'Inbox deleted successfully' };
  }

  /**
   * Lists all members of a specific inbox along with user profile and workspace role.
   */
  async listMembers(workspaceId: string, inboxId: string): Promise<InboxMemberDto[]> {
    const client = this.prisma.getClient();

    const inbox = await client.inbox.findFirst({
      where: { id: inboxId, workspaceId },
    });

    if (!inbox) {
      throw new NotFoundException({
        code: 'INBOX_NOT_FOUND',
        message: `Inbox with ID '${inboxId}' not found in this workspace`,
        details: { inboxId, workspaceId },
      });
    }

    const members = await client.inboxMember.findMany({
      where: { inboxId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            workspaceMembers: {
              where: { workspaceId },
              select: { role: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return members.map(m => ({
      id: m.id,
      inboxId: m.inboxId,
      userId: m.userId,
      user: {
        id: m.user.id,
        email: m.user.email,
        name: m.user.name,
        avatarUrl: m.user.avatarUrl,
        role: (m.user.workspaceMembers[0]?.role as WorkspaceRole) || WorkspaceRole.AGENT,
      },
      createdAt: m.createdAt.toISOString(),
    }));
  }

  /**
   * Adds a user to an inbox.
   * Business Rule BR-1.3: User must already be an active WorkspaceMember in the same workspace.
   */
  async addMember(workspaceId: string, inboxId: string, userId: string): Promise<InboxMemberDto> {
    const client = this.prisma.getClient();

    // 1. Verify inbox belongs to workspace
    const inbox = await client.inbox.findFirst({
      where: { id: inboxId, workspaceId },
    });

    if (!inbox) {
      throw new NotFoundException({
        code: 'INBOX_NOT_FOUND',
        message: `Inbox with ID '${inboxId}' not found in this workspace`,
        details: { inboxId, workspaceId },
      });
    }

    // 2. Invariant BR-1.3: Verify user is a member of this workspace
    const workspaceMember = await client.workspaceMember.findFirst({
      where: { workspaceId, userId },
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

    if (!workspaceMember) {
      throw new BadRequestException({
        code: 'INVALID_INBOX_MEMBER',
        message: `User '${userId}' is not a member of this workspace`,
        details: { userId, workspaceId },
      });
    }

    // 3. Check duplicate member
    const existing = await client.inboxMember.findFirst({
      where: { inboxId, userId },
    });

    if (existing) {
      throw new ConflictException({
        code: 'INBOX_MEMBER_ALREADY_EXISTS',
        message: `User '${userId}' is already a member of this inbox`,
        details: { userId, inboxId },
      });
    }

    // 4. Create InboxMember
    const newMember = await client.inboxMember.create({
      data: {
        inboxId,
        userId,
      },
    });

    this.logger.log(`Added user '${userId}' to inbox '${inboxId}' in workspace '${workspaceId}'`);

    return {
      id: newMember.id,
      inboxId: newMember.inboxId,
      userId: newMember.userId,
      user: {
        id: workspaceMember.user.id,
        email: workspaceMember.user.email,
        name: workspaceMember.user.name,
        avatarUrl: workspaceMember.user.avatarUrl,
        role: workspaceMember.role as WorkspaceRole,
      },
      createdAt: newMember.createdAt.toISOString(),
    };
  }

  /**
   * Removes a user from an inbox.
   */
  async removeMember(
    workspaceId: string,
    inboxId: string,
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    const client = this.prisma.getClient();

    // 1. Verify inbox belongs to workspace
    const inbox = await client.inbox.findFirst({
      where: { id: inboxId, workspaceId },
    });

    if (!inbox) {
      throw new NotFoundException({
        code: 'INBOX_NOT_FOUND',
        message: `Inbox with ID '${inboxId}' not found in this workspace`,
        details: { inboxId, workspaceId },
      });
    }

    // 2. Verify membership in inbox
    const existing = await client.inboxMember.findFirst({
      where: { inboxId, userId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'INBOX_MEMBER_NOT_FOUND',
        message: `User '${userId}' is not a member of this inbox`,
        details: { userId, inboxId },
      });
    }

    await client.inboxMember.delete({
      where: { id: existing.id },
    });

    this.logger.log(
      `Removed user '${userId}' from inbox '${inboxId}' in workspace '${workspaceId}'`,
    );
    return { success: true, message: 'Member removed from inbox successfully' };
  }
}
