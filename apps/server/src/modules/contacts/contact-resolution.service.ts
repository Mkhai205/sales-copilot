import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type {
  ChannelIdentityDto,
  ContactDto,
  IdentifyContactDto,
  ResolvedContactResultDto,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database';
import { ChannelIdentityService } from './channel-identity.service';
import { ContactIdentifyService } from './contact-identify.service';

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
  ) {}

  /**
   * Resolves or provisions a Contact and ChannelIdentity for an inbound channel event.
   * 1. If ChannelIdentity already exists, returns the contact (and enriches if contactInfo provided).
   * 2. If ChannelIdentity does not exist, checks if contactInfo matches an existing Contact in the workspace;
   *    if matched, links identity to existing contact; otherwise creates a new Contact and links identity.
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
          contact: this.mapToDto(existingContact),
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
        resolvedContact = this.mapToDto(matchedContact);
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

    // 5. Create new Contact + ChannelIdentity
    const newContactName = info?.name?.trim() || params.username?.trim() || 'Unknown Contact';
    const newEmail =
      info?.email && info.email.trim() !== '' ? info.email.trim().toLowerCase() : null;
    const newPhone =
      info?.phoneNumber && info.phoneNumber.trim() !== '' ? info.phoneNumber.trim() : null;
    const newAvatarUrl =
      info?.avatarUrl && info.avatarUrl.trim() !== '' ? info.avatarUrl.trim() : null;
    const newIdentifier =
      info?.identifier && info.identifier.trim() !== '' ? info.identifier.trim() : null;

    const createdContact = await client.contact.create({
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

    const channelIdentity = await this.channelIdentityService.findOrCreate({
      workspaceId: params.workspaceId,
      channelId: params.channelId,
      externalContactId,
      contactId: createdContact.id,
      username: params.username || info?.name || null,
      metadata: params.metadata,
    });

    const contactDto = this.mapToDto(createdContact);

    this.logger.log(
      `Created new contact '${contactDto.id}' and linked identity '${externalContactId}' on channel '${params.channelId}' in workspace '${params.workspaceId}'`,
    );

    return {
      contact: contactDto,
      channelIdentity,
      isNewContact: true,
    };
  }

  private mapToDto(contact: any): ContactDto {
    return {
      id: contact.id,
      workspaceId: contact.workspaceId,
      name: contact.name,
      email: contact.email ?? null,
      phoneNumber: contact.phoneNumber ?? null,
      avatarUrl: contact.avatarUrl ?? null,
      identifier: contact.identifier ?? null,
      customAttributes:
        typeof contact.customAttributes === 'object' && contact.customAttributes !== null
          ? (contact.customAttributes as Record<string, unknown>)
          : {},
      additionalAttributes:
        typeof contact.additionalAttributes === 'object' && contact.additionalAttributes !== null
          ? (contact.additionalAttributes as Record<string, unknown>)
          : {},
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
      identities: Array.isArray(contact.identities)
        ? contact.identities.map((identity: any) => ({
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
          }))
        : undefined,
    };
  }
}
