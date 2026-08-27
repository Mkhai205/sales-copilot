import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type {
  CreateMessageDto,
  MessageListQueryDto,
  MessageResponseDto,
  PaginationMeta,
  UpdateDeliveryStatusDto,
} from '@sales-copilot/shared-contracts';
import {
  ConversationStatus,
  DeliveryStatus,
  MessageContentType,
  MessageType,
  SenderType,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database';
import { AttachmentsService, UploadedFile } from './attachments.service';
import { mapMessageToDto, MessageWithRelations } from './messages.mapper';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  /**
   * Creates a new message within a conversation with polymorphic sender validation (BR-5.1),
   * content/attachments validation (BR-5.2), and conversation side effects inside a transaction.
   */
  async create(
    workspaceId: string,
    conversationId: string,
    dto: CreateMessageDto,
    files?: UploadedFile[],
    tx?: any,
    actorUserId?: string,
  ): Promise<MessageResponseDto> {
    const client = tx ?? this.prisma.getClient();

    // 1. Fetch conversation with tenant scope and contact info
    const conversation = await client.conversation.findFirst({
      where: { id: conversationId, workspaceId },
      include: {
        contact: true,
      },
    });

    if (!conversation) {
      throw new NotFoundException({
        code: 'CONVERSATION_NOT_FOUND',
        message: `Conversation with id '${conversationId}' not found in this workspace`,
      });
    }

    // 2. Validate Polymorphic Sender (BR-5.1)
    const senderType = dto.senderType ?? SenderType.USER;
    let resolvedSenderId: string | null = null;

    if (senderType === SenderType.CONTACT) {
      if (dto.senderId && dto.senderId !== conversation.contactId) {
        throw new BadRequestException({
          code: 'INVALID_SENDER',
          message: `Sender ID '${dto.senderId}' does not match the conversation contact '${conversation.contactId}'`,
        });
      }
      resolvedSenderId = conversation.contactId;
    } else if (senderType === SenderType.USER) {
      if (!dto.senderId) {
        throw new BadRequestException({
          code: 'INVALID_SENDER',
          message: 'Sender ID is required for USER sender type',
        });
      }

      if (actorUserId && dto.senderId !== actorUserId) {
        throw new ForbiddenException({
          code: 'SENDER_IMPERSONATION_DENIED',
          message: 'You cannot author messages or notes under another user identity',
        });
      }

      // Verify user is an active member of this workspace
      const member = await client.workspaceMember.findFirst({
        where: {
          workspaceId,
          userId: dto.senderId,
        },
      });

      if (!member) {
        throw new BadRequestException({
          code: 'INVALID_SENDER',
          message: 'Sender must be a valid member of this workspace',
        });
      }
      resolvedSenderId = dto.senderId;
    } else if (senderType === SenderType.SYSTEM) {
      if (dto.senderId) {
        throw new BadRequestException({
          code: 'INVALID_SENDER',
          message: 'Sender ID must be null for SYSTEM sender type',
        });
      }
      resolvedSenderId = null;
    }

    // 3. Validate Content / Attachment Invariant (BR-5.2)
    const trimmedContent = dto.content?.trim();
    const hasFiles = files && files.length > 0;
    const hasExternalAttachments = dto.attachments && dto.attachments.length > 0;
    const hasAttachments = hasFiles || hasExternalAttachments;

    if ((!trimmedContent || trimmedContent === '') && !hasAttachments) {
      throw new BadRequestException({
        code: 'MESSAGE_CONTENT_REQUIRED',
        message: 'Message must contain either text content or at least one attachment',
      });
    }

    // 4. Idempotency Check for externalId
    if (dto.externalId && dto.externalId.trim() !== '') {
      const existing = await client.message.findFirst({
        where: {
          conversationId,
          externalId: dto.externalId.trim(),
        },
        include: {
          attachments: true,
        },
      });

      if (existing) {
        this.logger.debug(
          `Idempotent duplicate ignored for message with externalId ${dto.externalId}`,
        );
        return this.enrichAndMapMessage(existing, workspaceId);
      }
    }

    // 5. Determine default messageType, contentType, deliveryStatus
    const messageType =
      dto.messageType ??
      (senderType === SenderType.CONTACT ? MessageType.INCOMING : MessageType.OUTGOING);

    let contentType = dto.contentType ?? MessageContentType.TEXT;
    if (hasAttachments && (!trimmedContent || trimmedContent === '')) {
      contentType = MessageContentType.FILE;
    }

    const deliveryStatus =
      senderType === SenderType.CONTACT ? DeliveryStatus.DELIVERED : DeliveryStatus.SENT;

    const isPrivate = dto.isPrivate ?? false;

    // 6. Execute Message Creation + Attachments + Conversation Side-effects
    const executeInTransaction = async (trx: any) => {
      // 6a. Insert Message record
      const message = await trx.message.create({
        data: {
          conversationId,
          workspaceId,
          senderType,
          senderId: resolvedSenderId,
          messageType,
          contentType,
          content: trimmedContent || null,
          isPrivate,
          deliveryStatus,
          externalId: dto.externalId ? dto.externalId.trim() : null,
          metadata: (dto.metadata as any) ?? {},
        },
      });

      // 6b. Process Uploaded Files
      if (hasFiles && files) {
        for (const file of files) {
          await this.attachmentsService.uploadAndCreate(workspaceId, message.id, file, trx);
        }
      }

      // 6c. Process External Attachments (if provided in DTO)
      if (hasExternalAttachments && dto.attachments) {
        for (const att of dto.attachments) {
          await this.attachmentsService.createFromExternalUrl(
            message.id,
            {
              fileName: att.fileName,
              fileType: att.fileType,
              fileSize: att.fileSize,
              storagePath: att.storagePath,
              contentType: att.contentType,
              fileUrl: att.fileUrl,
            },
            trx,
          );
        }
      }

      // 6d. Update Conversation Side-effects
      const now = new Date();
      const conversationUpdate: Record<string, unknown> = {
        lastActivityAt: now,
      };

      let reopened = false;

      if (senderType === SenderType.CONTACT) {
        conversationUpdate.unreadMessagesCount = { increment: 1 };

        // Auto-reopen if RESOLVED or SNOOZED
        if (
          conversation.status === ConversationStatus.RESOLVED ||
          conversation.status === ConversationStatus.SNOOZED
        ) {
          conversationUpdate.status = ConversationStatus.OPEN;
          conversationUpdate.snoozedUntil = null;
          reopened = true;
        }
      } else if (senderType === SenderType.USER) {
        if (!isPrivate) {
          conversationUpdate.unreadMessagesCount = 0;

          // Record first reply timestamp if not recorded yet
          if (conversation.firstReplyCreatedAt === null && messageType === MessageType.OUTGOING) {
            conversationUpdate.firstReplyCreatedAt = now;
          }

          // Transition from OPEN to PENDING on agent reply
          if (conversation.status === ConversationStatus.OPEN) {
            conversationUpdate.status = ConversationStatus.PENDING;
          }
        }
      }

      await trx.conversation.update({
        where: { id: conversationId },
        data: conversationUpdate,
      });

      // Fetch created message with attachments for response
      const createdWithAttachments = await trx.message.findFirst({
        where: { id: message.id },
        include: { attachments: true },
      });

      return {
        message: createdWithAttachments,
        reopened,
        statusChanged: conversationUpdate.status !== undefined,
        newStatus: conversationUpdate.status as ConversationStatus | undefined,
      };
    };

    const result = tx
      ? await executeInTransaction(tx)
      : await client.$transaction(executeInTransaction);

    // 7. Enrich with sender profile and emit domain events
    const responseDto = await this.enrichAndMapMessage(result.message, workspaceId);

    this.eventEmitter.emit('message.created', {
      workspaceId,
      conversationId,
      message: responseDto,
      isPrivate,
    });

    if (result.reopened) {
      this.eventEmitter.emit('conversation.reopened', {
        workspaceId,
        conversationId,
      });
    }

    if (result.statusChanged && result.newStatus) {
      this.eventEmitter.emit('conversation.status_updated', {
        workspaceId,
        conversationId,
        previousStatus: conversation.status,
        currentStatus: result.newStatus,
      });
    }

    this.logger.log(
      `Created message (${responseDto.id}) in conversation '${conversationId}', sender=${senderType}`,
    );

    return responseDto;
  }

  /**
   * Lists messages for a conversation with chronological sorting and pagination.
   */
  async list(
    workspaceId: string,
    conversationId: string,
    query?: MessageListQueryDto,
    isAgent: boolean = true,
  ): Promise<{ items: MessageResponseDto[]; meta: PaginationMeta }> {
    const client = this.prisma.getClient();

    // Verify conversation exists in workspace
    const conversation = await client.conversation.findFirst({
      where: { id: conversationId, workspaceId },
    });

    if (!conversation) {
      throw new NotFoundException({
        code: 'CONVERSATION_NOT_FOUND',
        message: `Conversation with id '${conversationId}' not found in this workspace`,
      });
    }

    const where: Record<string, unknown> = {
      conversationId,
      workspaceId,
    };

    // If caller is not an agent, hide internal private notes
    if (!isAgent) {
      where.isPrivate = false;
    }

    // Cursor pagination support
    if (query?.beforeId) {
      const beforeMsg = await client.message.findFirst({
        where: { id: query.beforeId, conversationId, workspaceId },
      });
      if (beforeMsg) {
        where.createdAt = { lt: beforeMsg.createdAt };
      }
    } else if (query?.afterId) {
      const afterMsg = await client.message.findFirst({
        where: { id: query.afterId, conversationId, workspaceId },
      });
      if (afterMsg) {
        where.createdAt = { gt: afterMsg.createdAt };
      }
    }

    const page = query?.page && query.page > 0 ? query.page : 1;
    const limit = query?.limit && query.limit > 0 ? query.limit : 50;
    const skip = (page - 1) * limit;

    const [total, messages] = await Promise.all([
      client.message.count({ where }),
      client.message.findMany({
        where,
        include: {
          attachments: true,
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    const items = await this.enrichAndMapMessagesBulk(messages, workspaceId);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Retrieves a single message by ID with tenant isolation and privacy enforcement.
   */
  async getById(
    workspaceId: string,
    messageId: string,
    isAgent: boolean = true,
  ): Promise<MessageResponseDto> {
    const client = this.prisma.getClient();

    const message = await client.message.findFirst({
      where: { id: messageId, workspaceId },
      include: {
        attachments: true,
      },
    });

    if (!message) {
      throw new NotFoundException({
        code: 'MESSAGE_NOT_FOUND',
        message: `Message with id '${messageId}' not found in this workspace`,
      });
    }

    if (message.isPrivate && !isAgent) {
      throw new ForbiddenException({
        code: 'PRIVATE_NOTE_ACCESS_DENIED',
        message: 'Access to private notes is restricted to workspace agents',
      });
    }

    return this.enrichAndMapMessage(message, workspaceId);
  }

  /**
   * Updates delivery status of a message.
   */
  async updateDeliveryStatus(
    workspaceId: string,
    messageId: string,
    dto: UpdateDeliveryStatusDto,
  ): Promise<MessageResponseDto> {
    const client = this.prisma.getClient();

    const message = await client.message.findFirst({
      where: { id: messageId, workspaceId },
      include: { attachments: true },
    });

    if (!message) {
      throw new NotFoundException({
        code: 'MESSAGE_NOT_FOUND',
        message: `Message with id '${messageId}' not found in this workspace`,
      });
    }

    const previousStatus = message.deliveryStatus;

    const updated = await client.message.update({
      where: { id: messageId },
      data: { deliveryStatus: dto.deliveryStatus },
      include: { attachments: true },
    });

    const responseDto = await this.enrichAndMapMessage(updated, workspaceId);

    this.eventEmitter.emit('message.delivery_status_updated', {
      workspaceId,
      conversationId: message.conversationId,
      messageId,
      previousStatus,
      currentStatus: dto.deliveryStatus,
      message: responseDto,
    });

    this.logger.debug(
      `Updated message ${messageId} delivery status: ${previousStatus} -> ${dto.deliveryStatus}`,
    );

    return responseDto;
  }

  /**
   * Deletes a message and its attached media files with tenant isolation.
   */
  async delete(workspaceId: string, messageId: string): Promise<{ success: true }> {
    const client = this.prisma.getClient();

    const message = await client.message.findFirst({
      where: { id: messageId, workspaceId },
    });

    if (!message) {
      throw new NotFoundException({
        code: 'MESSAGE_NOT_FOUND',
        message: `Message with id '${messageId}' not found in this workspace`,
      });
    }

    // Clean up S3 objects and attachment records
    await this.attachmentsService.deleteByMessageId(messageId);

    await client.message.delete({
      where: { id: messageId },
    });

    this.eventEmitter.emit('message.deleted', {
      workspaceId,
      conversationId: message.conversationId,
      messageId,
    });

    this.logger.log(`Deleted message '${messageId}' in workspace '${workspaceId}'`);

    return { success: true };
  }

  /**
   * Enriches a single message with sender details and maps to transport DTO.
   */
  private async enrichAndMapMessage(
    message: MessageWithRelations,
    workspaceId: string,
  ): Promise<MessageResponseDto> {
    const client = this.prisma.getClient();

    if (message.senderType === SenderType.USER && message.senderId) {
      const user = await client.user.findFirst({
        where: { id: message.senderId },
        select: { id: true, name: true, avatarUrl: true },
      });
      message.senderUser = user;
    } else if (message.senderType === SenderType.CONTACT && message.senderId) {
      const contact = await client.contact.findFirst({
        where: { id: message.senderId, workspaceId },
        select: { id: true, name: true, avatarUrl: true },
      });
      message.senderContact = contact;
    }

    return mapMessageToDto(message);
  }

  /**
   * Enriches messages in bulk to prevent N+1 queries during listing.
   */
  private async enrichAndMapMessagesBulk(
    messages: MessageWithRelations[],
    workspaceId: string,
  ): Promise<MessageResponseDto[]> {
    if (messages.length === 0) {
      return [];
    }

    const client = this.prisma.getClient();

    const userIds = Array.from(
      new Set(
        messages.filter(m => m.senderType === SenderType.USER && m.senderId).map(m => m.senderId!),
      ),
    );

    const contactIds = Array.from(
      new Set(
        messages
          .filter(m => m.senderType === SenderType.CONTACT && m.senderId)
          .map(m => m.senderId!),
      ),
    );

    const [users, contacts] = await Promise.all([
      userIds.length > 0
        ? client.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, avatarUrl: true },
          })
        : [],
      contactIds.length > 0
        ? client.contact.findMany({
            where: { id: { in: contactIds }, workspaceId },
            select: { id: true, name: true, avatarUrl: true },
          })
        : [],
    ]);

    const userMap = new Map(users.map(u => [u.id, u]));
    const contactMap = new Map(contacts.map(c => [c.id, c]));

    return messages.map(msg => {
      if (msg.senderType === SenderType.USER && msg.senderId) {
        msg.senderUser = userMap.get(msg.senderId) ?? null;
      } else if (msg.senderType === SenderType.CONTACT && msg.senderId) {
        msg.senderContact = contactMap.get(msg.senderId) ?? null;
      }
      return mapMessageToDto(msg);
    });
  }
}
