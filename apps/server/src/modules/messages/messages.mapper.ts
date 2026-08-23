import type {
  Attachment,
  Message,
  Contact,
  User,
} from '../../infrastructure/database/generated/client';
import type { MessageResponseDto } from '@sales-copilot/shared-contracts';
import {
  DeliveryStatus,
  MessageContentType,
  MessageType,
  SenderType,
} from '@sales-copilot/shared-contracts';
import { mapAttachmentToDto } from './attachments.mapper';

export interface MessageWithRelations extends Message {
  attachments?: Attachment[];
  senderUser?: Pick<User, 'id' | 'name' | 'avatarUrl'> | null;
  senderContact?: Pick<Contact, 'id' | 'name' | 'avatarUrl'> | null;
}

/**
 * Maps a Prisma Message entity with relations to a transport-safe MessageResponseDto.
 */
export function mapMessageToDto(
  message: MessageWithRelations,
  options?: {
    attachmentUrls?: Map<string, string>;
  },
): MessageResponseDto {
  let sender: MessageResponseDto['sender'] = null;

  if (message.senderType === SenderType.USER && message.senderUser) {
    sender = {
      id: message.senderUser.id,
      name: message.senderUser.name,
      avatarUrl: message.senderUser.avatarUrl,
      type: SenderType.USER,
    };
  } else if (message.senderType === SenderType.CONTACT && message.senderContact) {
    sender = {
      id: message.senderContact.id,
      name: message.senderContact.name,
      avatarUrl: message.senderContact.avatarUrl,
      type: SenderType.CONTACT,
    };
  } else if (message.senderType === SenderType.SYSTEM) {
    sender = {
      id: 'system',
      name: 'System',
      avatarUrl: null,
      type: SenderType.SYSTEM,
    };
  } else if (message.senderId) {
    sender = {
      id: message.senderId,
      name: message.senderType === SenderType.USER ? 'Agent' : 'Contact',
      avatarUrl: null,
      type: message.senderType as unknown as SenderType,
    };
  }

  const attachments = (message.attachments || []).map(att => {
    const fileUrl = options?.attachmentUrls?.get(att.id);
    return mapAttachmentToDto(att, fileUrl);
  });

  return {
    id: message.id,
    conversationId: message.conversationId,
    workspaceId: message.workspaceId,
    senderType: message.senderType as unknown as SenderType,
    senderId: message.senderId,
    messageType: message.messageType as unknown as MessageType,
    contentType: message.contentType as unknown as MessageContentType,
    content: message.content,
    isPrivate: message.isPrivate,
    deliveryStatus: message.deliveryStatus as unknown as DeliveryStatus,
    externalId: message.externalId,
    metadata: (message.metadata as Record<string, unknown>) ?? {},
    attachments,
    sender,
    createdAt:
      message.createdAt instanceof Date
        ? message.createdAt.toISOString()
        : String(message.createdAt),
    updatedAt:
      message.updatedAt instanceof Date
        ? message.updatedAt.toISOString()
        : message.updatedAt
          ? String(message.updatedAt)
          : undefined,
  };
}
