import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  type ChannelIdentityDto,
  type ContactDto,
  type ContactListQueryDto,
  type ContactMergedEvent,
  type ContactSearchQueryDto,
  type CreateChannelIdentityDto,
  type CreateContactDto,
  type PaginationMeta,
  type UpdateContactDto,
  ConversationStatus,
} from '@sales-copilot/shared-contracts';
import { Prisma } from '../../../infrastructure/database/generated/client';
import { PrismaService } from '../../../infrastructure/database';
import { mapContactToDto, mapIdentityToDto } from './contacts.mapper';

export interface MergeContactOptions {
  performedByUserId?: string | null;
  /** Pass an active Prisma.TransactionClient to join an existing transaction. */
  tx?: Prisma.TransactionClient;
}

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Creates a new Contact within a specific workspace.
   * Normalizes email to lowercase, converts empty strings to null,
   * and enforces uniqueness of identifier and email within the workspace.
   */
  async create(workspaceId: string, dto: CreateContactDto): Promise<ContactDto> {
    const client = this.prisma.getClient();

    const name = dto.name.trim();
    const email = dto.email && dto.email.trim() !== '' ? dto.email.trim().toLowerCase() : null;
    const phoneNumber =
      dto.phoneNumber && dto.phoneNumber.trim() !== '' ? dto.phoneNumber.trim() : null;
    const avatarUrl = dto.avatarUrl && dto.avatarUrl.trim() !== '' ? dto.avatarUrl.trim() : null;
    const identifier =
      dto.identifier && dto.identifier.trim() !== '' ? dto.identifier.trim() : null;

    // Check unique identifier collision in same workspace
    if (identifier) {
      const existingWithIdentifier = await client.contact.findFirst({
        where: { workspaceId, identifier },
      });
      if (existingWithIdentifier) {
        throw new ConflictException({
          code: 'IDENTIFIER_ALREADY_EXISTS',
          message: `IDENTIFIER_ALREADY_EXISTS: Contact with identifier '${identifier}' already exists in this workspace`,
        });
      }
    }

    // Check unique email collision in same workspace
    if (email) {
      const existingWithEmail = await client.contact.findFirst({
        where: { workspaceId, email },
      });
      if (existingWithEmail) {
        throw new ConflictException({
          code: 'EMAIL_ALREADY_EXISTS',
          message: `EMAIL_ALREADY_EXISTS: Contact with email '${email}' already exists in this workspace`,
        });
      }
    }

    try {
      const created = await client.contact.create({
        data: {
          workspaceId,
          name,
          email,
          phoneNumber,
          avatarUrl,
          identifier,
          customAttributes: (dto.customAttributes as any) ?? {},
          additionalAttributes: (dto.additionalAttributes as any) ?? {},
        },
        include: {
          identities: true,
        },
      });

      const contactDto = this.mapToDto(created);

      this.eventEmitter.emit('contact.created', {
        workspaceId,
        contact: contactDto,
      });

      this.logger.log(
        `Created contact '${contactDto.name}' (${contactDto.id}) in workspace '${workspaceId}'`,
      );

      return contactDto;
    } catch (err: any) {
      if (err?.code === 'P2002') {
        const target = err?.meta?.target;
        if (Array.isArray(target)) {
          if (target.includes('identifier')) {
            throw new ConflictException({
              code: 'IDENTIFIER_ALREADY_EXISTS',
              message: `Contact with identifier '${identifier}' already exists in this workspace`,
            });
          }
          if (target.includes('email')) {
            throw new ConflictException({
              code: 'EMAIL_ALREADY_EXISTS',
              message: `Contact with email '${email}' already exists in this workspace`,
            });
          }
        }
      }
      throw err;
    }
  }

  /**
   * Retrieves a paginated list of contacts in the workspace with optional search and sorting.
   */
  async findAll(
    workspaceId: string,
    query: ContactListQueryDto,
  ): Promise<{ items: ContactDto[]; meta: PaginationMeta }> {
    const client = this.prisma.getClient();

    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 20;
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    const where: any = { workspaceId };

    if (query.q && query.q.trim() !== '') {
      const search = query.q.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search, mode: 'insensitive' } },
        { identifier: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (query.channelType) {
      where.identities = {
        some: {
          channel: {
            channelType: query.channelType,
          },
        },
      };
    }

    const [total, contacts] = await Promise.all([
      client.contact.count({ where }),
      client.contact.findMany({
        where,
        include: {
          identities: {
            include: {
              channel: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      items: contacts.map(c => this.mapToDto(c)),
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  /**
   * Searches contacts matching query string across name, email, phone, and identifier.
   */
  async search(
    workspaceId: string,
    query: ContactSearchQueryDto,
  ): Promise<{ items: ContactDto[]; meta: PaginationMeta }> {
    return this.findAll(workspaceId, {
      page: query.page,
      limit: query.limit,
      q: query.q,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  }

  /**
   * Finds a single contact by ID within the workspace, including linked channel identities.
   */
  async findById(workspaceId: string, contactId: string): Promise<ContactDto> {
    const client = this.prisma.getClient();

    const contact = await client.contact.findFirst({
      where: { id: contactId, workspaceId },
      include: {
        identities: {
          include: {
            channel: true,
          },
        },
      },
    });

    if (!contact) {
      throw new NotFoundException({
        code: 'CONTACT_NOT_FOUND',
        message: `Contact with id '${contactId}' not found`,
      });
    }

    return this.mapToDto(contact);
  }

  /**
   * Updates an existing contact's details, performing a deep merge on customAttributes and additionalAttributes.
   */
  async update(workspaceId: string, contactId: string, dto: UpdateContactDto): Promise<ContactDto> {
    const client = this.prisma.getClient();

    const existing = await client.contact.findFirst({
      where: { id: contactId, workspaceId },
      include: { identities: true },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'CONTACT_NOT_FOUND',
        message: `Contact with id '${contactId}' not found`,
      });
    }

    // Process and validate email change
    let email: string | null | undefined = undefined;
    if (dto.email !== undefined) {
      email = dto.email && dto.email.trim() !== '' ? dto.email.trim().toLowerCase() : null;
      if (email && email !== existing.email) {
        const collision = await client.contact.findFirst({
          where: {
            workspaceId,
            email,
            id: { not: contactId },
          },
        });
        if (collision) {
          throw new ConflictException({
            code: 'EMAIL_ALREADY_EXISTS',
            message: `EMAIL_ALREADY_EXISTS: Contact with email '${email}' already exists in this workspace`,
          });
        }
      }
    }

    // Process and validate identifier change
    let identifier: string | null | undefined = undefined;
    if (dto.identifier !== undefined) {
      identifier = dto.identifier && dto.identifier.trim() !== '' ? dto.identifier.trim() : null;
      if (identifier && identifier !== existing.identifier) {
        const collision = await client.contact.findFirst({
          where: {
            workspaceId,
            identifier,
            id: { not: contactId },
          },
        });
        if (collision) {
          throw new ConflictException({
            code: 'IDENTIFIER_ALREADY_EXISTS',
            message: `IDENTIFIER_ALREADY_EXISTS: Contact with identifier '${identifier}' already exists in this workspace`,
          });
        }
      }
    }

    // Deep merge customAttributes
    let customAttributes: any = undefined;
    if (dto.customAttributes !== undefined) {
      const existingAttrs =
        typeof existing.customAttributes === 'object' && existing.customAttributes !== null
          ? (existing.customAttributes as Record<string, unknown>)
          : {};
      customAttributes = {
        ...existingAttrs,
        ...dto.customAttributes,
      };
    }

    // Deep merge additionalAttributes
    let additionalAttributes: any = undefined;
    if (dto.additionalAttributes !== undefined) {
      const existingAttrs =
        typeof existing.additionalAttributes === 'object' && existing.additionalAttributes !== null
          ? (existing.additionalAttributes as Record<string, unknown>)
          : {};
      additionalAttributes = {
        ...existingAttrs,
        ...dto.additionalAttributes,
      };
    }

    try {
      const updated = await client.contact.update({
        where: { workspaceId_id: { workspaceId, id: contactId } },
        data: {
          ...(dto.name !== undefined && { name: dto.name.trim() }),
          ...(email !== undefined && { email }),
          ...(dto.phoneNumber !== undefined && {
            phoneNumber:
              dto.phoneNumber && dto.phoneNumber.trim() !== '' ? dto.phoneNumber.trim() : null,
          }),
          ...(dto.avatarUrl !== undefined && {
            avatarUrl: dto.avatarUrl && dto.avatarUrl.trim() !== '' ? dto.avatarUrl.trim() : null,
          }),
          ...(identifier !== undefined && { identifier }),
          ...(customAttributes !== undefined && { customAttributes }),
          ...(additionalAttributes !== undefined && { additionalAttributes }),
        },
        include: {
          identities: true,
        },
      });

      const contactDto = this.mapToDto(updated);

      this.eventEmitter.emit('contact.updated', {
        workspaceId,
        contact: contactDto,
        previousAttributes: {
          customAttributes: existing.customAttributes as Record<string, unknown>,
          additionalAttributes: existing.additionalAttributes as Record<string, unknown>,
        },
      });

      this.logger.log(
        `Updated contact '${contactDto.name}' (${contactDto.id}) in workspace '${workspaceId}'`,
      );

      return contactDto;
    } catch (err: any) {
      if (err?.code === 'P2002') {
        const target = err?.meta?.target;
        if (Array.isArray(target)) {
          if (target.includes('identifier')) {
            throw new ConflictException({
              code: 'IDENTIFIER_ALREADY_EXISTS',
              message: `IDENTIFIER_ALREADY_EXISTS: Contact with identifier '${identifier}' already exists in this workspace`,
            });
          }
          if (target.includes('email')) {
            throw new ConflictException({
              code: 'EMAIL_ALREADY_EXISTS',
              message: `EMAIL_ALREADY_EXISTS: Contact with email '${email}' already exists in this workspace`,
            });
          }
        }
      }
      throw err;
    }
  }

  /**
   * Deletes a contact from the workspace. Associated channel identities are cascade-deleted by Prisma.
   */
  async delete(workspaceId: string, contactId: string): Promise<{ success: boolean }> {
    const client = this.prisma.getClient();

    const existing = await client.contact.findFirst({
      where: { id: contactId, workspaceId },
      include: { identities: true },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'CONTACT_NOT_FOUND',
        message: `Contact with id '${contactId}' not found`,
      });
    }

    // Security & Integrity Invariant: Prevent deleting contact with existing conversations or orders
    const [conversationCount, orderCount] = await Promise.all([
      client.conversation.count({
        where: { contactId, workspaceId },
      }),
      client.order.count({
        where: { contactId, workspaceId },
      }),
    ]);

    if (conversationCount > 0) {
      throw new BadRequestException({
        code: 'CONTACT_HAS_CONVERSATIONS',
        message: `CONTACT_HAS_CONVERSATIONS: Cannot delete contact '${contactId}' because it has ${conversationCount} linked conversation(s)`,
        details: { contactId, conversationCount },
      });
    }

    if (orderCount > 0) {
      throw new BadRequestException({
        code: 'CONTACT_HAS_ORDERS',
        message: `CONTACT_HAS_ORDERS: Cannot delete contact '${contactId}' because it has ${orderCount} linked order(s)`,
        details: { contactId, orderCount },
      });
    }

    const snapshot = this.mapToDto(existing);

    await client.contact.delete({
      where: { workspaceId_id: { workspaceId, id: contactId } },
    });

    this.eventEmitter.emit('contact.deleted', {
      workspaceId,
      contactId,
      contact: snapshot,
    });

    this.logger.log(
      `Deleted contact '${snapshot.name}' (${contactId}) from workspace '${workspaceId}'`,
    );

    return { success: true };
  }

  /**
   * Atomically merges a mergee contact into a base contact within the same workspace.
   * Transfers all ChannelIdentities, Conversations, and Messages from mergee to base.
   * Merges customAttributes and additionalAttributes (base attributes take precedence).
   * Deletes the mergee contact, records an AuditLog entry, and emits `contact.merged`.
   */
  async merge(
    workspaceId: string,
    baseContactId: string,
    mergeeContactId: string,
    options?: MergeContactOptions,
  ): Promise<ContactDto> {
    if (baseContactId === mergeeContactId) {
      // Self-merge is a no-op — always scope with workspaceId
      const client = options?.tx ?? this.prisma.getClient();
      const base = await client.contact.findFirst({
        where: { id: baseContactId, workspaceId },
        include: { identities: true },
      });
      if (!base) {
        throw new NotFoundException({
          code: 'CONTACT_NOT_FOUND',
          message: `Contact with id '${baseContactId}' not found`,
        });
      }
      return this.mapToDto(base);
    }

    const runInTx = async (tx: Prisma.TransactionClient): Promise<ContactDto> => {
      // 1. Validate both contacts exist and belong to the workspace (tenant-scoped findFirst)
      const [baseContact, mergeeContact] = await Promise.all([
        tx.contact.findFirst({
          where: { id: baseContactId, workspaceId },
          include: { identities: true },
        }),
        tx.contact.findFirst({
          where: { id: mergeeContactId, workspaceId },
          include: { identities: true },
        }),
      ]);

      if (!baseContact) {
        throw new NotFoundException({
          code: 'CONTACT_NOT_FOUND',
          message: `Base contact with id '${baseContactId}' not found`,
        });
      }

      if (!mergeeContact) {
        throw new NotFoundException({
          code: 'CONTACT_NOT_FOUND',
          message: `Mergee contact with id '${mergeeContactId}' not found`,
        });
      }

      // 2. Transfer ChannelIdentities from mergee to base
      await tx.channelIdentity.updateMany({
        where: { contactId: mergeeContactId, workspaceId },
        data: { contactId: baseContactId },
      });

      // 3. Resolve duplicate active conversations per inbox (Single Active Ticket Invariant)
      const activeBaseConversations = await tx.conversation.findMany({
        where: {
          contactId: baseContactId,
          workspaceId,
          status: { in: [ConversationStatus.OPEN, ConversationStatus.PENDING] },
        },
      });

      const activeMergeeConversations = await tx.conversation.findMany({
        where: {
          contactId: mergeeContactId,
          workspaceId,
          status: { in: [ConversationStatus.OPEN, ConversationStatus.PENDING] },
        },
      });

      for (const mergeeConv of activeMergeeConversations) {
        const baseConv = activeBaseConversations.find(c => c.inboxId === mergeeConv.inboxId);
        if (baseConv) {
          // Collision: resolve the older conversation to preserve single-active-ticket invariant
          const [older, newer] =
            new Date(mergeeConv.createdAt).getTime() < new Date(baseConv.createdAt).getTime()
              ? [mergeeConv, baseConv]
              : [baseConv, mergeeConv];

          await tx.conversation.update({
            where: {
              workspaceId_id: {
                workspaceId,
                id: older.id,
              },
            },
            data: {
              status: ConversationStatus.RESOLVED,
              unreadMessagesCount: 0,
              customAttributes: {
                ...(typeof older.customAttributes === 'object' && older.customAttributes !== null
                  ? (older.customAttributes as Record<string, unknown>)
                  : {}),
                resolvedReason: 'contact_merge_collision',
                mergedIntoConversationId: newer.id,
              },
            },
          });
        }
      }

      // Transfer Conversations from mergee to base
      await tx.conversation.updateMany({
        where: { contactId: mergeeContactId, workspaceId },
        data: { contactId: baseContactId },
      });

      // Transfer Orders from mergee to base
      await tx.order.updateMany({
        where: { contactId: mergeeContactId, workspaceId },
        data: { contactId: baseContactId },
      });

      // 4. Transfer Messages sent by mergee to base
      await tx.message.updateMany({
        where: {
          workspaceId,
          senderType: 'CONTACT',
          senderId: mergeeContactId,
        },
        data: { senderId: baseContactId },
      });

      // 5. Deep merge attributes: base attributes take precedence
      const mergeeCustom =
        typeof mergeeContact.customAttributes === 'object' &&
        mergeeContact.customAttributes !== null
          ? (mergeeContact.customAttributes as Record<string, unknown>)
          : {};
      const baseCustom =
        typeof baseContact.customAttributes === 'object' && baseContact.customAttributes !== null
          ? (baseContact.customAttributes as Record<string, unknown>)
          : {};

      const mergeeAdditional =
        typeof mergeeContact.additionalAttributes === 'object' &&
        mergeeContact.additionalAttributes !== null
          ? (mergeeContact.additionalAttributes as Record<string, unknown>)
          : {};
      const baseAdditional =
        typeof baseContact.additionalAttributes === 'object' &&
        baseContact.additionalAttributes !== null
          ? (baseContact.additionalAttributes as Record<string, unknown>)
          : {};

      const mergedCustomAttributes = { ...mergeeCustom, ...baseCustom };
      const mergedAdditionalAttributes = {
        ...mergeeAdditional,
        ...baseAdditional,
      };

      const mergedName = baseContact.name || mergeeContact.name;
      const mergedEmail = baseContact.email || mergeeContact.email;
      const mergedPhoneNumber = baseContact.phoneNumber || mergeeContact.phoneNumber;
      const mergedAvatarUrl = baseContact.avatarUrl || mergeeContact.avatarUrl;
      const mergedIdentifier = baseContact.identifier || mergeeContact.identifier;

      // 6. Delete mergee contact
      await tx.contact.delete({
        where: { workspaceId_id: { workspaceId, id: mergeeContactId } },
      });

      // 7. Update base contact with merged attributes
      const updatedBase = await tx.contact.update({
        where: { workspaceId_id: { workspaceId, id: baseContactId } },
        data: {
          name: mergedName,
          email: mergedEmail,
          phoneNumber: mergedPhoneNumber,
          avatarUrl: mergedAvatarUrl,
          identifier: mergedIdentifier,
          customAttributes: mergedCustomAttributes as Prisma.InputJsonValue,
          additionalAttributes: mergedAdditionalAttributes as Prisma.InputJsonValue,
        },
        include: {
          identities: true,
        },
      });

      // 8. Create AuditLog entry
      await tx.auditLog.create({
        data: {
          workspaceId,
          userId: options?.performedByUserId ?? null,
          action: 'CONTACT_MERGED',
          resourceType: 'Contact',
          resourceId: baseContactId,
          payload: {
            baseContactId,
            mergeeContactId,
            mergedAttributes: {
              name: mergedName,
              email: mergedEmail,
              phoneNumber: mergedPhoneNumber,
              identifier: mergedIdentifier,
            },
          },
        },
      });

      const contactDto = this.mapToDto(updatedBase);

      // 9. Emit event
      const eventPayload: ContactMergedEvent = {
        workspaceId,
        primaryContactId: baseContactId,
        mergedContactId: mergeeContactId,
        mergedByUserId: options?.performedByUserId ?? null,
        mergedAttributes: {
          name: mergedName,
          email: mergedEmail,
          phoneNumber: mergedPhoneNumber,
          identifier: mergedIdentifier,
        },
      };

      this.eventEmitter.emit('contact.merged', eventPayload);

      this.logger.log(
        `Merged contact '${mergeeContactId}' into base contact '${baseContactId}' in workspace '${workspaceId}'`,
      );

      return contactDto;
    };

    if (options?.tx) {
      return runInTx(options.tx);
    }

    return this.prisma.runInTransaction(ctx => runInTx(ctx.txClient));
  }

  // ---------------------------------------------------------------------------
  // Channel Identities Management (Controller Sub-Resources)
  // ---------------------------------------------------------------------------

  /**
   * Retrieves all channel identities linked to a specific contact.
   */
  async findIdentitiesByContactId(
    workspaceId: string,
    contactId: string,
  ): Promise<ChannelIdentityDto[]> {
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

    return identities.map(i => mapIdentityToDto(i));
  }

  /**
   * Explicitly creates and links a new ChannelIdentity to an existing contact.
   * Throws ConflictException if (channelId, externalContactId) is already mapped to another contact.
   */
  async linkIdentity(
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
        return mapIdentityToDto(existing);
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

    const identityDto = mapIdentityToDto(created);

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
   * Unlinks (deletes) a ChannelIdentity from a Contact.
   */
  async unlinkIdentity(
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

    const snapshot = mapIdentityToDto(existing);

    await client.channelIdentity.delete({
      where: { workspaceId_id: { workspaceId, id: identityId } },
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
   * Maps a Prisma Contact record (with optional identities) to a clean ContactDto.
   */
  private mapToDto(contact: any): ContactDto {
    return mapContactToDto(contact);
  }
}
