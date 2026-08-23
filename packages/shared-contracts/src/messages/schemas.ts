import { z } from 'zod';
import { DeliveryStatus, FileType, MessageContentType, MessageType, SenderType } from './enums';

// ==========================================
// 1. Attachment Validation & DTOs
// ==========================================

export const createAttachmentInputSchema = z.object({
  fileName: z.string().trim().min(1, 'File name is required'),
  fileType: z.nativeEnum(FileType),
  fileSize: z.number().int().positive('File size must be positive'),
  storagePath: z.string().trim().min(1, 'Storage path is required'),
  contentType: z.string().trim().min(1, 'Content type is required'),
  fileUrl: z.string().url().optional(),
});
export type CreateAttachmentInputDto = z.input<typeof createAttachmentInputSchema>;

export interface AttachmentDto {
  id: string;
  messageId: string;
  fileType: FileType;
  fileName: string;
  fileSize: number;
  storagePath: string;
  contentType: string;
  fileUrl?: string;
  createdAt: string;
}

// ==========================================
// 2. Message Request Validation Schemas
// ==========================================

export const createMessageSchema = z.object({
  content: z.string().trim().optional().nullable(),
  senderType: z.nativeEnum(SenderType).default(SenderType.USER),
  senderId: z.string().uuid('Invalid sender ID').optional().nullable(),
  messageType: z.nativeEnum(MessageType).default(MessageType.OUTGOING),
  contentType: z.nativeEnum(MessageContentType).default(MessageContentType.TEXT),
  isPrivate: z.boolean().default(false),
  externalId: z.string().trim().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
  attachments: z.array(createAttachmentInputSchema).optional(),
});
export type CreateMessageDto = z.input<typeof createMessageSchema>;

// Specialized schema for agent UI sending outbound message
export const sendMessageSchema = z.object({
  content: z.string().trim().optional().nullable(),
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

export const updateDeliveryStatusSchema = z.object({
  deliveryStatus: z.nativeEnum(DeliveryStatus),
});
export type UpdateDeliveryStatusDto = z.input<typeof updateDeliveryStatusSchema>;

export const messageListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  beforeId: z.string().uuid().optional(),
  afterId: z.string().uuid().optional(),
});
export type MessageListQueryDto = z.input<typeof messageListQuerySchema>;
export type MessageListQueryOutput = z.output<typeof messageListQuerySchema>;

// ==========================================
// 3. Message Response DTOs
// ==========================================

export interface MessageResponseDto {
  id: string;
  conversationId: string;
  workspaceId: string;
  senderType: SenderType;
  senderId?: string | null;
  messageType: MessageType;
  contentType: MessageContentType;
  content?: string | null;
  isPrivate: boolean;
  deliveryStatus: DeliveryStatus;
  externalId?: string | null;
  metadata?: Record<string, unknown>;
  attachments?: AttachmentDto[];
  sender?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    type: SenderType;
  } | null;
  createdAt: string;
  updatedAt?: string;
}

// ==========================================
// 4. Domain Events & Payloads
// ==========================================

export interface MessageCreatedEvent {
  workspaceId: string;
  conversationId: string;
  message: MessageResponseDto;
  isPrivate: boolean;
}

export interface MessageDeliveryStatusUpdatedEvent {
  workspaceId: string;
  conversationId: string;
  messageId: string;
  previousStatus: DeliveryStatus;
  currentStatus: DeliveryStatus;
  message: MessageResponseDto;
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
