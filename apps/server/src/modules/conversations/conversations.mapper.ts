import type { ConversationResponseDto } from '@sales-copilot/shared-contracts';
import { mapContactToDto } from '../contacts/contacts.mapper';

/**
 * Maps a Prisma Conversation record with optional includes to a transport-safe ConversationResponseDto.
 */
export function mapConversationToDto(conv: any): ConversationResponseDto {
  const result: ConversationResponseDto = {
    id: conv.id,
    displayId: conv.displayId,
    workspaceId: conv.workspaceId,
    inboxId: conv.inboxId,
    contactId: conv.contactId,
    channelIdentityId: conv.channelIdentityId ?? null,
    assigneeId: conv.assigneeId ?? null,
    teamId: conv.teamId ?? null,
    status: conv.status,
    priority: conv.priority,
    unreadMessagesCount: conv.unreadMessagesCount ?? 0,
    lastActivityAt:
      conv.lastActivityAt instanceof Date ? conv.lastActivityAt.toISOString() : conv.lastActivityAt,
    waitingSince: conv.waitingSince
      ? conv.waitingSince instanceof Date
        ? conv.waitingSince.toISOString()
        : conv.waitingSince
      : null,
    snoozedUntil: conv.snoozedUntil
      ? conv.snoozedUntil instanceof Date
        ? conv.snoozedUntil.toISOString()
        : conv.snoozedUntil
      : null,
    firstReplyCreatedAt: conv.firstReplyCreatedAt
      ? conv.firstReplyCreatedAt instanceof Date
        ? conv.firstReplyCreatedAt.toISOString()
        : conv.firstReplyCreatedAt
      : null,
    customAttributes: conv.customAttributes ?? {},
    createdAt: conv.createdAt instanceof Date ? conv.createdAt.toISOString() : conv.createdAt,
    updatedAt: conv.updatedAt instanceof Date ? conv.updatedAt.toISOString() : conv.updatedAt,
  };

  if (conv.labels && Array.isArray(conv.labels)) {
    result.labels = conv.labels.map((cl: any) => {
      const label = cl.label || cl;
      return {
        id: label.id,
        title: label.title,
        color: label.color,
      };
    });
  }

  if (conv.contact) {
    result.contact = mapContactToDto(conv.contact);
  }

  if (conv.inbox) {
    result.inbox = {
      id: conv.inbox.id,
      name: conv.inbox.name,
      avatarUrl: conv.inbox.avatarUrl ?? null,
    };
  }

  if (conv.assignee) {
    result.assignee = {
      id: conv.assignee.id,
      name: conv.assignee.name,
      email: conv.assignee.email,
      avatarUrl: conv.assignee.avatarUrl ?? null,
    };
  }

  if (conv.team) {
    result.team = {
      id: conv.team.id,
      name: conv.team.name,
    };
  }

  if (conv.messages && Array.isArray(conv.messages) && conv.messages.length > 0) {
    const lastMsg = conv.messages[0];
    result.lastMessage = {
      id: lastMsg.id,
      conversationId: lastMsg.conversationId,
      workspaceId: lastMsg.workspaceId,
      senderType: lastMsg.senderType,
      senderId: lastMsg.senderId ?? null,
      messageType: lastMsg.messageType,
      contentType: lastMsg.contentType,
      content: lastMsg.content ?? null,
      isPrivate: lastMsg.isPrivate,
      deliveryStatus: lastMsg.deliveryStatus,
      externalId: lastMsg.externalId ?? null,
      metadata: lastMsg.metadata ?? {},
      createdAt:
        lastMsg.createdAt instanceof Date ? lastMsg.createdAt.toISOString() : lastMsg.createdAt,
      updatedAt:
        lastMsg.updatedAt instanceof Date ? lastMsg.updatedAt.toISOString() : lastMsg.updatedAt,
    };
  }

  return result;
}
