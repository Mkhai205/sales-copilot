import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ContactDto,
  ContactMergedEvent,
  ConversationStatus,
} from '@sales-copilot/shared-contracts';
import { Prisma } from '../../infrastructure/database/generated/client';
import { PrismaService } from '../../infrastructure/database';
import { mapContactToDto } from './contacts.mapper';

export interface MergeContactOptions {
  performedByUserId?: string | null;
  /** Pass an active Prisma.TransactionClient to join an existing transaction. */
  tx?: Prisma.TransactionClient;
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
      return mapContactToDto(base);
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
            where: { id: older.id },
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

      const contactDto = mapContactToDto(updatedBase);

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
}
