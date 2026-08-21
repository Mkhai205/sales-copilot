import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { ChannelIdentityDto, CreateChannelIdentityDto } from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database';

@Injectable()
export class ChannelIdentityService {
  private readonly logger = new Logger(ChannelIdentityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Idempotently finds or creates a ChannelIdentity.
   * If identity already exists, returns existing record.
   * If not, verifies channel/workspace scope, resolves/creates Contact, and stores new ChannelIdentity.
   */
  async findOrCreate(params: {
    workspaceId: string;
    channelId: string;
    externalContactId: string;
    contactId?: string;
    username?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<ChannelIdentityDto> {
    const client = this.prisma.getClient();
    const externalContactId = params.externalContactId.trim();

    // 1. Check existing identity
    const existing = await client.channelIdentity.findUnique({
      where: {
        channelId_externalContactId: {
          channelId: params.channelId,
          externalContactId,
        },
      },
      include: {
        channel: true,
      },
    });

    if (existing) {
      return this.mapToDto(existing);
    }

    // 2. Validate channel belongs to workspace
    const channel = await client.channel.findFirst({
      where: { id: params.channelId, workspaceId: params.workspaceId },
    });

    if (!channel) {
      throw new NotFoundException({
        code: 'CHANNEL_NOT_FOUND',
        message: `Channel with id '${params.channelId}' not found in workspace`,
      });
    }

    // 3. Resolve target contact
    let targetContactId = params.contactId;
    if (targetContactId) {
      const contact = await client.contact.findFirst({
        where: { id: targetContactId, workspaceId: params.workspaceId },
      });

      if (!contact) {
        throw new NotFoundException({
          code: 'CONTACT_NOT_FOUND',
          message: `Contact with id '${targetContactId}' not found in workspace`,
        });
      }
    } else {
      const newContact = await client.contact.create({
        data: {
          workspaceId: params.workspaceId,
          name: params.username?.trim() || 'Unknown Contact',
          customAttributes: {},
          additionalAttributes: {},
        },
      });
      targetContactId = newContact.id;
    }

    // 4. Create channel identity (handle possible race condition via P2002)
    try {
      const created = await client.channelIdentity.create({
        data: {
          workspaceId: params.workspaceId,
          contactId: targetContactId,
          channelId: params.channelId,
          externalContactId,
          username: params.username?.trim() || null,
          metadata: (params.metadata as any) ?? {},
        },
        include: {
          channel: true,
        },
      });

      const identityDto = this.mapToDto(created);

      this.eventEmitter.emit('channel_identity.created', {
        workspaceId: params.workspaceId,
        identity: identityDto,
      });

      this.logger.log(
        `Created channel identity '${externalContactId}' on channel '${params.channelId}' for contact '${targetContactId}' in workspace '${params.workspaceId}'`,
      );

      return identityDto;
    } catch (err: any) {
      if (err?.code === 'P2002') {
        const raceExisting = await client.channelIdentity.findUnique({
          where: {
            channelId_externalContactId: {
              channelId: params.channelId,
              externalContactId,
            },
          },
          include: {
            channel: true,
          },
        });
        if (raceExisting) {
          return this.mapToDto(raceExisting);
        }
      }
      throw err;
    }
  }

  /**
   * Fast lookup of a ChannelIdentity by channelId and externalContactId (used during inbound webhook routing).
   */
  async findByChannelAndExternalId(
    channelId: string,
    externalContactId: string,
  ): Promise<ChannelIdentityDto | null> {
    const client = this.prisma.getClient();

    const identity = await client.channelIdentity.findUnique({
      where: {
        channelId_externalContactId: {
          channelId,
          externalContactId: externalContactId.trim(),
        },
      },
      include: {
        channel: true,
      },
    });

    if (!identity) {
      return null;
    }

    return this.mapToDto(identity);
  }

  /**
   * Retrieves all channel identities linked to a specific contact.
   */
  async findByContactId(workspaceId: string, contactId: string): Promise<ChannelIdentityDto[]> {
    const client = this.prisma.getClient();

    // Verify contact belongs to workspace
    const contact = await client.contact.findFirst({
      where: { id: contactId, workspaceId },
    });

    if (!contact) {
      throw new NotFoundException({
        code: 'CONTACT_NOT_FOUND',
        message: `Contact with id '${contactId}' not found in workspace`,
      });
    }

    const identities = await client.channelIdentity.findMany({
      where: { contactId, workspaceId },
      include: {
        channel: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return identities.map(i => this.mapToDto(i));
  }

  /**
   * Explicitly creates and links a new ChannelIdentity to an existing contact.
   * Throws ConflictException if (channelId, externalContactId) is already mapped to another contact.
   */
  async createForContact(
    workspaceId: string,
    contactId: string,
    dto: CreateChannelIdentityDto,
  ): Promise<ChannelIdentityDto> {
    const client = this.prisma.getClient();
    const externalContactId = dto.externalContactId.trim();

    // Verify contact belongs to workspace
    const contact = await client.contact.findFirst({
      where: { id: contactId, workspaceId },
    });

    if (!contact) {
      throw new NotFoundException({
        code: 'CONTACT_NOT_FOUND',
        message: `Contact with id '${contactId}' not found in workspace`,
      });
    }

    // Verify channel belongs to workspace
    const channel = await client.channel.findFirst({
      where: { id: dto.channelId, workspaceId },
    });

    if (!channel) {
      throw new NotFoundException({
        code: 'CHANNEL_NOT_FOUND',
        message: `Channel with id '${dto.channelId}' not found in workspace`,
      });
    }

    // Check collision on (channelId, externalContactId)
    const existing = await client.channelIdentity.findUnique({
      where: {
        channelId_externalContactId: {
          channelId: dto.channelId,
          externalContactId,
        },
      },
      include: {
        channel: true,
      },
    });

    if (existing) {
      if (existing.contactId === contactId) {
        return this.mapToDto(existing);
      }
      throw new ConflictException({
        code: 'CHANNEL_IDENTITY_ALREADY_EXISTS',
        message: `External contact ID '${externalContactId}' is already linked to another contact on this channel`,
      });
    }

    const created = await client.channelIdentity.create({
      data: {
        workspaceId,
        contactId,
        channelId: dto.channelId,
        externalContactId,
        username: dto.username?.trim() || null,
        metadata: (dto.metadata as any) ?? {},
      },
      include: {
        channel: true,
      },
    });

    const identityDto = this.mapToDto(created);

    this.eventEmitter.emit('channel_identity.created', {
      workspaceId,
      identity: identityDto,
    });

    this.logger.log(
      `Linked channel identity '${externalContactId}' on channel '${dto.channelId}' to contact '${contactId}' in workspace '${workspaceId}'`,
    );

    return identityDto;
  }

  /**
   * Unlinks (deletes) a ChannelIdentity from a Contact. Does not delete the Contact.
   */
  async delete(
    workspaceId: string,
    contactId: string,
    identityId: string,
  ): Promise<{ success: boolean }> {
    const client = this.prisma.getClient();

    const existing = await client.channelIdentity.findFirst({
      where: {
        id: identityId,
        contactId,
        workspaceId,
      },
      include: {
        channel: true,
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'CHANNEL_IDENTITY_NOT_FOUND',
        message: `Channel identity with id '${identityId}' not found for this contact`,
      });
    }

    const snapshot = this.mapToDto(existing);

    await client.channelIdentity.delete({
      where: { id: identityId },
    });

    this.eventEmitter.emit('channel_identity.deleted', {
      workspaceId,
      identityId,
      contactId,
      identity: snapshot,
    });

    this.logger.log(
      `Unlinked channel identity '${identityId}' from contact '${contactId}' in workspace '${workspaceId}'`,
    );

    return { success: true };
  }

  /**
   * Transfers a batch of channel identities to a target contact (used in Contact Merge operations).
   */
  async transferToContact(
    identityIds: string[],
    targetContactId: string,
    tx?: ReturnType<PrismaService['getClient']>,
  ): Promise<{ count: number }> {
    if (identityIds.length === 0) {
      return { count: 0 };
    }

    const client = tx || this.prisma.getClient();

    const result = await client.channelIdentity.updateMany({
      where: {
        id: { in: identityIds },
      },
      data: {
        contactId: targetContactId,
      },
    });

    return { count: result.count };
  }

  /**
   * Maps a Prisma ChannelIdentity record to ChannelIdentityDto.
   */
  private mapToDto(identity: any): ChannelIdentityDto {
    return {
      id: identity.id,
      contactId: identity.contactId,
      workspaceId: identity.workspaceId,
      channelId: identity.channelId,
      channelType: identity.channel?.channelType,
      externalContactId: identity.externalContactId,
      username: identity.username ?? null,
      metadata:
        typeof identity.metadata === 'object' && identity.metadata !== null
          ? (identity.metadata as Record<string, unknown>)
          : {},
      createdAt: identity.createdAt,
      updatedAt: identity.updatedAt,
    };
  }
}
