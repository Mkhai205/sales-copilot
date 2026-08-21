import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { ContactDto, ContactMergedEvent } from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database';

export interface MergeContactOptions {
  performedByUserId?: string | null;
  tx?: any;
}

@Injectable()
export class ContactMergeService {
  private readonly logger = new Logger(ContactMergeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

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
      // Self-merge is a no-op
      const client = options?.tx || this.prisma.getClient();
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

    const runInTx = async (tx: any): Promise<ContactDto> => {
      // 1. Validate both contacts exist and belong to the workspace
      const [baseContact, mergeeContact] = await Promise.all([
        tx.contact.findUnique({
          where: { id: baseContactId },
          include: { identities: true },
        }),
        tx.contact.findUnique({
          where: { id: mergeeContactId },
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

      if (baseContact.workspaceId !== workspaceId || mergeeContact.workspaceId !== workspaceId) {
        throw new BadRequestException({
          code: 'CROSS_WORKSPACE_MERGE_PROHIBITED',
          message: 'Cannot merge contacts from different workspaces',
        });
      }

      // 2. Transfer ChannelIdentities from mergee to base
      await tx.channelIdentity.updateMany({
        where: { contactId: mergeeContactId, workspaceId },
        data: { contactId: baseContactId },
      });

      // 3. Transfer Conversations from mergee to base
      await tx.conversation.updateMany({
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
        where: { id: mergeeContactId },
      });

      // 7. Update base contact with merged attributes
      const updatedBase = await tx.contact.update({
        where: { id: baseContactId },
        data: {
          name: mergedName,
          email: mergedEmail,
          phoneNumber: mergedPhoneNumber,
          avatarUrl: mergedAvatarUrl,
          identifier: mergedIdentifier,
          customAttributes: mergedCustomAttributes,
          additionalAttributes: mergedAdditionalAttributes,
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

    return this.prisma.runInTransaction(async (ctx: any) => {
      return runInTx(ctx.tx || ctx.txClient || this.prisma.getClient());
    });
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
