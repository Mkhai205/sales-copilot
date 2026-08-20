import { z } from 'zod';
import { DeliveryStatus, FileType, MessageContentType, MessageType, SenderType } from './enums';

export const sendMessageSchema = z.object({
  content: z.string().optional(),
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
  content?: string;
  isPrivate: boolean;
  externalId?: string;
  deliveryStatus?: DeliveryStatus;
  attachments?: {
    id: string;
    fileUrl: string;
    fileName: string;
    fileType: string;
    fileSize: number;
  }[];
  createdAt: string;
}

export interface MessageReceivedPayload {
  messageId: string;
  conversationId: string;
  contactId: string;
  inboxId: string;
  content: string;
  senderType: string;
  channelType: string;
}
