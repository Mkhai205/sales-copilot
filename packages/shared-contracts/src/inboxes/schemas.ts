import { z } from 'zod';
import { ChannelType } from './enums';

export const createInboxSchema = z.object({
  name: z.string().min(1).max(100),
  channelType: z.nativeEnum(ChannelType),
  greetingMessage: z.string().optional(),
  enableAutoAssignment: z.boolean().default(true),
  channelCredentials: z.record(z.unknown()).optional(),
});
export type CreateInboxDto = z.infer<typeof createInboxSchema>;

export const updateInboxSchema = createInboxSchema.partial();
export type UpdateInboxDto = z.infer<typeof updateInboxSchema>;

export interface InboxDto {
  id: string;
  workspaceId: string;
  name: string;
  channelType: ChannelType;
  channelId?: string;
  greetingMessage?: string;
  enableAutoAssignment: boolean;
  createdAt: string;
}

export interface ChannelDto {
  id: string;
  workspaceId: string;
  type: ChannelType;
  name: string;
  status: string;
  createdAt: string;
}

export interface InboundAttachmentDto {
  fileUrl: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  contentType: string;
}

export interface InboundSenderInfoDto {
  name?: string;
  avatarUrl?: string;
  username?: string;
  phoneNumber?: string;
  email?: string;
}

export interface InboundMessagePayloadDto {
  externalContactId: string;
  externalMessageId: string;
  content?: string;
  contentType: string;
  attachments?: InboundAttachmentDto[];
  senderInfo?: InboundSenderInfoDto;
  timestamp: string;
  rawPayload?: Record<string, unknown>;
}

export interface OutboundMessagePayloadDto {
  recipientExternalId: string;
  content?: string;
  contentType?: string;
  attachments?: {
    fileUrl: string;
    fileName?: string;
    fileType?: string;
    fileSize?: number;
  }[];
  externalConversationId?: string;
  metadata?: Record<string, unknown>;
}

export interface SendMessageResultDto {
  externalMessageId: string;
  deliveryStatus: string;
  rawResponse?: unknown;
}

export interface ChannelInfoDto {
  providerAccountId?: string;
  name: string;
  avatarUrl?: string;
  metadata?: Record<string, unknown>;
}
