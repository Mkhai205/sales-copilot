import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type {
  ChannelIdentityDto,
  ContactDto,
  IdentifyContactDto,
  ResolvedContactResultDto,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database';
import { ChannelIdentityService } from './channel-identity.service';
import { ContactIdentifyService } from './contact-identify.service';
import { mapContactToDto, mapIdentityToDto } from './contacts.mapper';

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
    private readonly channelIdentityService: ChannelIdentityService,
    private readonly contactIdentifyService: ContactIdentifyService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

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
    const existingIdentity = await this.channelIdentityService.findByChannelAndExternalId(
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
          const updatedContact = await this.contactIdentifyService.identify(
            params.workspaceId,
            existingContact,
            params.contactInfo,
          );

          const latestIdentity =
            (await this.channelIdentityService.findByChannelAndExternalId(
              params.channelId,
              externalContactId,
            )) || existingIdentity;

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
        resolvedContact = await this.contactIdentifyService.identify(
          params.workspaceId,
          matchedContact,
          info,
        );
      } else {
        resolvedContact = mapContactToDto(matchedContact);
      }

      // Link ChannelIdentity
      const channelIdentity = await this.channelIdentityService.findOrCreate({
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
    //    to avoid orphaned contacts if identity creation fails.
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

    // Post-transaction: emit events (outside tx so they only fire on commit)
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
