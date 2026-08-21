import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type {
  ContactDto,
  ContactListQueryDto,
  ContactSearchQueryDto,
  CreateContactDto,
  PaginationMeta,
  UpdateContactDto,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database';
import { mapContactToDto } from './contacts.mapper';

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
          message: `Contact with identifier '${identifier}' already exists in this workspace`,
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
          message: `Contact with email '${email}' already exists in this workspace`,
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
   * Retrieves a paginated list of contacts in the workspace with optional ILIKE search and sorting.
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

    const [total, contacts] = await Promise.all([
      client.contact.count({ where }),
      client.contact.findMany({
        where,
        include: { identities: true },
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
      include: { identities: true },
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
            message: `Contact with email '${email}' already exists in this workspace`,
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
            message: `Contact with identifier '${identifier}' already exists in this workspace`,
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
        where: { id: contactId },
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
        if (Array.isArray(target) && target.includes('identifier')) {
          throw new ConflictException({
            code: 'IDENTIFIER_ALREADY_EXISTS',
            message: `Contact with identifier '${identifier}' already exists in this workspace`,
          });
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

    const snapshot = this.mapToDto(existing);

    await client.contact.delete({
      where: { id: contactId },
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
   * Maps a Prisma Contact record (with optional identities) to a clean ContactDto.
   */
  private mapToDto(contact: any): ContactDto {
    return mapContactToDto(contact);
  }
}
