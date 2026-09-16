import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type {
  ChannelIdentityDto,
  ContactDto,
  IdentifyContactDto,
  ResolvedContactResultDto,
} from '@sales-copilot/shared-contracts';
import { Prisma } from '../../../infrastructure/database/generated/client';
import { PrismaService } from '../../../infrastructure/database';
import { ContactsService } from './contacts.service';
import { mapContactToDto, mapIdentityToDto } from './contacts.mapper';

export interface IdentifyOptions {
  /** When true, the original base contact name is preserved after merge (not overwritten by params.name). */
  retainOriginalContactName?: boolean;
  performedByUserId?: string | null;
  /** Pass an active Prisma.TransactionClient to join an existing transaction. */
  tx?: Prisma.TransactionClient;
}

export interface ResolveFromChannelParams {
  workspaceId: string;
  channelId: string;
  externalContactId: string;
  contactInfo?: IdentifyContactDto;
  metadata?: Record<string, unknown>;
  username?: string | null;
}

@Injectable()
export class ContactResolutionService {
  private readonly logger = new Logger(ContactResolutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contactsService: ContactsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Fast lookup of a ChannelIdentity by channelId and externalContactId.
   */
  async findIdentityByChannelAndExternalId(
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

    return mapIdentityToDto(identity);
  }

  /**
   * Idempotently finds or creates a ChannelIdentity.
   */
  async findOrCreateIdentity(params: {
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
      return mapIdentityToDto(existing);
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

      this.eventEmitter.emit('contact.created', {
        workspaceId: params.workspaceId,
        contact: mapContactToDto(newContact),
      });
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

      const identityDto = mapIdentityToDto(created);

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
          return mapIdentityToDto(raceExisting);
        }
      }
      throw err;
    }
  }

  /**
   * Identifies and reconciles a contact within a workspace using the 3-tier priority chain:
   * 1. Identifier -> merge if existing contact with same identifier found.
   * 2. Email -> merge if existing contact with same email found (unless identifier conflict).
   * 3. PhoneNumber -> merge if existing contact with same phone found (unless identifier/email conflict).
   * 4. Updates remaining valid fields and deep merges customAttributes/additionalAttributes.
   */
  async identify(
    workspaceId: string,
    currentContact: { id: string },
    params: IdentifyContactDto,
    options?: IdentifyOptions,
  ): Promise<ContactDto> {
    const runInTx = async (tx: Prisma.TransactionClient): Promise<ContactDto> => {
      let activeContact: any = await tx.contact.findFirst({
        where: { id: currentContact.id, workspaceId },
        include: { identities: true },
      });

      if (!activeContact) {
        throw new NotFoundException({
          code: 'CONTACT_NOT_FOUND',
          message: `Contact with id '${currentContact.id}' not found in workspace`,
        });
      }

      const initialSnapshot = activeContact;

      // Clean/normalize parameters
      const cleanIdentifier =
        params.identifier && params.identifier.trim() !== '' ? params.identifier.trim() : null;
      const cleanEmail =
        params.email && params.email.trim() !== '' ? params.email.trim().toLowerCase() : null;
      const cleanPhone =
        params.phoneNumber && params.phoneNumber.trim() !== '' ? params.phoneNumber.trim() : null;
      const cleanName = params.name && params.name.trim() !== '' ? params.name.trim() : null;
      const cleanAvatarUrl =
        params.avatarUrl && params.avatarUrl.trim() !== '' ? params.avatarUrl.trim() : null;

      const attributesToUpdate = {
        name: true,
        email: true,
        phoneNumber: true,
        identifier: true,
        avatarUrl: true,
      };

      // Step 1: Identifier priority check
      if (cleanIdentifier) {
        const existingIdentifiedContact = await tx.contact.findFirst({
          where: { workspaceId, identifier: cleanIdentifier },
          include: { identities: true },
        });

        if (existingIdentifiedContact && existingIdentifiedContact.id !== activeContact.id) {
          activeContact = await this.contactsService.merge(
            workspaceId,
            existingIdentifiedContact.id,
            activeContact.id,
            { tx, performedByUserId: options?.performedByUserId },
          );

          if (options?.retainOriginalContactName) {
            attributesToUpdate.name = false;
          }
        }
      }

      // Step 2: Email priority check
      if (cleanEmail) {
        const existingEmailContact = await tx.contact.findFirst({
          where: { workspaceId, email: cleanEmail },
          include: { identities: true },
        });

        if (existingEmailContact && existingEmailContact.id !== activeContact.id) {
          const hasIdentifierConflict =
            existingEmailContact.identifier &&
            cleanIdentifier &&
            existingEmailContact.identifier !== cleanIdentifier;

          if (hasIdentifierConflict) {
            attributesToUpdate.email = false;
            this.logger.warn(
              `Identifier conflict detected when matching email '${cleanEmail}' for contact '${activeContact.id}' against existing '${existingEmailContact.id}'`,
            );
          } else {
            activeContact = await this.contactsService.merge(
              workspaceId,
              existingEmailContact.id,
              activeContact.id,
              { tx, performedByUserId: options?.performedByUserId },
            );

            if (options?.retainOriginalContactName) {
              attributesToUpdate.name = false;
            }
          }
        }
      }

      // Step 3: Phone number priority check
      if (cleanPhone) {
        const existingPhoneContact = await tx.contact.findFirst({
          where: { workspaceId, phoneNumber: cleanPhone },
          include: { identities: true },
        });

        if (existingPhoneContact && existingPhoneContact.id !== activeContact.id) {
          const hasIdentifierConflict =
            existingPhoneContact.identifier &&
            cleanIdentifier &&
            existingPhoneContact.identifier !== cleanIdentifier;

          const hasEmailConflict =
            existingPhoneContact.email &&
            cleanEmail &&
            existingPhoneContact.email.toLowerCase() !== cleanEmail.toLowerCase();

          if (hasIdentifierConflict || hasEmailConflict) {
            attributesToUpdate.phoneNumber = false;
            this.logger.warn(
              `Conflict detected when matching phone '${cleanPhone}' for contact '${activeContact.id}' against existing '${existingPhoneContact.id}' (idConflict=${!!hasIdentifierConflict}, emailConflict=${!!hasEmailConflict})`,
            );
          } else {
            activeContact = await this.contactsService.merge(
              workspaceId,
              existingPhoneContact.id,
              activeContact.id,
              { tx, performedByUserId: options?.performedByUserId },
            );

            if (options?.retainOriginalContactName) {
              attributesToUpdate.name = false;
            }
          }
        }
      }

      // Step 4: Deep merge customAttributes & additionalAttributes and update contact
      const existingCustom =
        typeof activeContact.customAttributes === 'object' &&
        activeContact.customAttributes !== null
          ? (activeContact.customAttributes as Record<string, unknown>)
          : {};
      const newCustom = params.customAttributes
        ? { ...existingCustom, ...params.customAttributes }
        : existingCustom;

      const existingAdditional =
        typeof activeContact.additionalAttributes === 'object' &&
        activeContact.additionalAttributes !== null
          ? (activeContact.additionalAttributes as Record<string, unknown>)
          : {};
      const newAdditional = params.additionalAttributes
        ? { ...existingAdditional, ...params.additionalAttributes }
        : existingAdditional;

      const updateData: Record<string, unknown> = {
        customAttributes: newCustom,
        additionalAttributes: newAdditional,
      };

      if (attributesToUpdate.name && cleanName) {
        updateData.name = cleanName;
      }
      if (attributesToUpdate.email && cleanEmail) {
        updateData.email = cleanEmail;
      }
      if (attributesToUpdate.phoneNumber && cleanPhone) {
        updateData.phoneNumber = cleanPhone;
      }
      if (attributesToUpdate.identifier && cleanIdentifier) {
        updateData.identifier = cleanIdentifier;
      }
      if (attributesToUpdate.avatarUrl && cleanAvatarUrl) {
        updateData.avatarUrl = cleanAvatarUrl;
      }

      const updated = await tx.contact.update({
        where: { id: activeContact.id },
        data: updateData,
        include: { identities: true },
      });

      const contactDto = mapContactToDto(updated);

      this.eventEmitter.emit('contact.updated', {
        workspaceId,
        contact: contactDto,
        previousAttributes: {
          customAttributes: initialSnapshot.customAttributes,
          additionalAttributes: initialSnapshot.additionalAttributes,
        },
      });

      this.logger.log(
        `Identified/reconciled contact '${contactDto.id}' in workspace '${workspaceId}'`,
      );

      return contactDto;
    };

    if (options?.tx) {
      return runInTx(options.tx);
    }

    return this.prisma.runInTransaction(ctx => runInTx(ctx.txClient));
  }

  /**
   * Resolves or provisions a Contact and ChannelIdentity for an inbound channel event.
   * 1. If ChannelIdentity already exists, returns the contact (and enriches if contactInfo provided).
   * 2. If ChannelIdentity does not exist, checks if contactInfo matches an existing Contact in the workspace;
   *    if matched, links identity to existing contact; otherwise creates a new Contact and links identity
   *    atomically within a single transaction.
   */
  async resolveFromChannel(params: ResolveFromChannelParams): Promise<ResolvedContactResultDto> {
    const client = this.prisma.getClient();
    const externalContactId = params.externalContactId.trim();

    // 1. Check existing ChannelIdentity
    const existingIdentity = await this.findIdentityByChannelAndExternalId(
      params.channelId,
      externalContactId,
    );

    if (existingIdentity && existingIdentity.contactId) {
      const existingContact = await client.contact.findFirst({
        where: {
          id: existingIdentity.contactId,
          workspaceId: params.workspaceId,
        },
        include: { identities: true },
      });

      if (existingContact) {
        const hasInfo =
          params.contactInfo &&
          Object.values(params.contactInfo).some(
            val => val !== undefined && val !== null && val !== '',
          );

        if (hasInfo && params.contactInfo) {
          const updatedContact = await this.identify(
            params.workspaceId,
            existingContact,
            params.contactInfo,
          );

          const latestIdentity =
            (await this.findIdentityByChannelAndExternalId(params.channelId, externalContactId)) ||
            existingIdentity;

          return {
            contact: updatedContact,
            channelIdentity: latestIdentity,
            isNewContact: false,
          };
        }

        return {
          contact: mapContactToDto(existingContact),
          channelIdentity: existingIdentity,
          isNewContact: false,
        };
      }
    }

    // 2. Validate channel belongs to the workspace
    const channel = await client.channel.findFirst({
      where: { id: params.channelId, workspaceId: params.workspaceId },
    });

    if (!channel) {
      throw new NotFoundException({
        code: 'CHANNEL_NOT_FOUND',
        message: `Channel with id '${params.channelId}' not found in workspace`,
      });
    }

    // 3. Search for potential existing contact matching contactInfo in workspace
    let matchedContact: any = null;
    const info = params.contactInfo;

    if (info?.identifier && info.identifier.trim() !== '') {
      matchedContact = await client.contact.findFirst({
        where: {
          workspaceId: params.workspaceId,
          identifier: info.identifier.trim(),
        },
        include: { identities: true },
      });
    }

    if (!matchedContact && info?.email && info.email.trim() !== '') {
      const email = info.email.trim().toLowerCase();
      const emailCandidate = await client.contact.findFirst({
        where: { workspaceId: params.workspaceId, email },
        include: { identities: true },
      });

      if (emailCandidate) {
        const hasIdentifierConflict =
          emailCandidate.identifier &&
          info.identifier &&
          emailCandidate.identifier !== info.identifier.trim();
        if (!hasIdentifierConflict) {
          matchedContact = emailCandidate;
        }
      }
    }

    if (!matchedContact && info?.phoneNumber && info.phoneNumber.trim() !== '') {
      const phone = info.phoneNumber.trim();
      const phoneCandidate = await client.contact.findFirst({
        where: { workspaceId: params.workspaceId, phoneNumber: phone },
        include: { identities: true },
      });

      if (phoneCandidate) {
        const hasIdentifierConflict =
          phoneCandidate.identifier &&
          info.identifier &&
          phoneCandidate.identifier !== info.identifier.trim();
        const hasEmailConflict =
          phoneCandidate.email &&
          info.email &&
          phoneCandidate.email.toLowerCase() !== info.email.trim().toLowerCase();

        if (!hasIdentifierConflict && !hasEmailConflict) {
          matchedContact = phoneCandidate;
        }
      }
    }

    // 4. Link or Create Contact
    if (matchedContact) {
      // Existing contact matched - enrich info if provided
      let resolvedContact: ContactDto;
      if (info) {
        resolvedContact = await this.identify(params.workspaceId, matchedContact, info);
      } else {
        resolvedContact = mapContactToDto(matchedContact);
      }

      // Link ChannelIdentity
      const channelIdentity = await this.findOrCreateIdentity({
        workspaceId: params.workspaceId,
        channelId: params.channelId,
        externalContactId,
        contactId: resolvedContact.id,
        username: params.username || info?.name || null,
        metadata: params.metadata,
      });

      this.logger.log(
        `Resolved channel message to existing contact '${resolvedContact.id}' and linked identity '${externalContactId}'`,
      );

      return {
        contact: resolvedContact,
        channelIdentity,
        isNewContact: false,
      };
    }

    // 5. Atomically create new Contact + ChannelIdentity within a single transaction
    const newContactName = info?.name?.trim() || params.username?.trim() || 'Unknown Contact';
    const newEmail =
      info?.email && info.email.trim() !== '' ? info.email.trim().toLowerCase() : null;
    const newPhone =
      info?.phoneNumber && info.phoneNumber.trim() !== '' ? info.phoneNumber.trim() : null;
    const newAvatarUrl =
      info?.avatarUrl && info.avatarUrl.trim() !== '' ? info.avatarUrl.trim() : null;
    const newIdentifier =
      info?.identifier && info.identifier.trim() !== '' ? info.identifier.trim() : null;

    let createdContactDto: ContactDto;
    let channelIdentity: ChannelIdentityDto;

    try {
      await this.prisma.runInTransaction(async ctx => {
        const tx = ctx.txClient;

        const createdContact = await tx.contact.create({
          data: {
            workspaceId: params.workspaceId,
            name: newContactName,
            email: newEmail,
            phoneNumber: newPhone,
            avatarUrl: newAvatarUrl,
            identifier: newIdentifier,
            customAttributes: (info?.customAttributes as any) ?? {},
            additionalAttributes: (info?.additionalAttributes as any) ?? {},
          },
          include: {
            identities: true,
          },
        });

        createdContactDto = mapContactToDto(createdContact);

        // Create ChannelIdentity within the same transaction to ensure atomicity
        const createdIdentity = await tx.channelIdentity.create({
          data: {
            workspaceId: params.workspaceId,
            contactId: createdContact.id,
            channelId: params.channelId,
            externalContactId,
            username: (params.username || info?.name)?.trim() || null,
            metadata: (params.metadata as any) ?? {},
          },
          include: { channel: true },
        });

        channelIdentity = mapIdentityToDto(createdIdentity);
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        // Race condition: concurrent message created identity first
        const raceIdentity = await this.findIdentityByChannelAndExternalId(
          params.channelId,
          externalContactId,
        );
        if (raceIdentity && raceIdentity.contactId) {
          const existingContact = await client.contact.findFirst({
            where: { id: raceIdentity.contactId, workspaceId: params.workspaceId },
            include: { identities: true },
          });
          if (existingContact) {
            return {
              contact: mapContactToDto(existingContact),
              channelIdentity: raceIdentity,
              isNewContact: false,
            };
          }
        }
      }
      throw err;
    }

    // Post-transaction: emit events
    this.eventEmitter.emit('contact.created', {
      workspaceId: params.workspaceId,
      contact: createdContactDto!,
    });

    this.eventEmitter.emit('channel_identity.created', {
      workspaceId: params.workspaceId,
      identity: channelIdentity!,
    });

    this.logger.log(
      `Created new contact '${createdContactDto!.id}' and linked identity '${externalContactId}' on channel '${params.channelId}' in workspace '${params.workspaceId}'`,
    );

    return {
      contact: createdContactDto!,
      channelIdentity: channelIdentity!,
      isNewContact: true,
    };
  }
}
