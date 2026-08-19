import { z } from 'zod';
import {
  ConversationStatus,
  MessageContentType,
  MessageType,
  Priority,
  SenderType,
} from '@sales-copilot/shared';

export const createConversationSchema = z.object({
  contactId: z.string().min(1),
  inboxId: z.string().min(1),
  assigneeId: z.string().optional(),
  teamId: z.string().optional(),
  priority: z.nativeEnum(Priority).optional(),
});
export type CreateConversationDto = z.infer<typeof createConversationSchema>;

export const updateConversationStatusSchema = z.object({
  status: z.nativeEnum(ConversationStatus),
  snoozedUntil: z.string().datetime().optional(),
});
export type UpdateConversationStatusDto = z.infer<typeof updateConversationStatusSchema>;

export const sendMessageSchema = z.object({
  content: z.string().min(1),
  contentType: z.nativeEnum(MessageContentType).default(MessageContentType.TEXT),
  messageType: z.nativeEnum(MessageType).default(MessageType.OUTGOING),
  isPrivate: z.boolean().default(false),
  attachments: z
    .array(
      z.object({
        fileUrl: z.string().url(),
        fileName: z.string(),
        fileType: z.string(),
        fileSize: z.number(),
      }),
    )
    .optional(),
});
export type SendMessageDto = z.infer<typeof sendMessageSchema>;

export interface MessageResponseDto {
  id: string;
  conversationId: string;
  senderType: SenderType;
  senderId?: string;
  messageType: MessageType;
  contentType: MessageContentType;
  content: string;
  isPrivate: boolean;
  externalId?: string;
  attachments?: {
    id: string;
    fileUrl: string;
    fileName: string;
    fileType: string;
    fileSize: number;
  }[];
  createdAt: string;
}

export interface ConversationResponseDto {
  id: string;
  displayId: number;
  contactId: string;
  inboxId: string;
  assigneeId?: string;
  teamId?: string;
  status: ConversationStatus;
  priority: Priority;
  unreadMessagesCount: number;
  lastActivityAt: string;
  waitingSince?: string;
  snoozedUntil?: string;
  cachedLabels: string[];
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
}
