import { z } from 'zod';
import { ChannelType } from './enums';
import { WorkspaceRole } from '../auth/enums';

export const createInboxSchema = z.object({
  name: z.string().min(1, 'Inbox name is required').max(100),
  channelType: z.nativeEnum(ChannelType),
  avatarUrl: z.string().url().optional().nullable(),
  greetingMessage: z.string().optional(),
  isAutoAssignmentEnabled: z.boolean().optional().default(false),
  settings: z.record(z.unknown()).optional(),
  channelCredentials: z.record(z.unknown()).optional(),
  channelSettings: z.record(z.unknown()).optional(),
  providerAccountId: z.string().optional().nullable(),
});
export type CreateInboxDto = z.input<typeof createInboxSchema>;

export const updateInboxSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().optional().nullable(),
  greetingMessage: z.string().optional(),
  isAutoAssignmentEnabled: z.boolean().optional(),
  settings: z.record(z.unknown()).optional(),
  channelCredentials: z.record(z.unknown()).optional(),
  channelSettings: z.record(z.unknown()).optional(),
  providerAccountId: z.string().optional().nullable(),
  isConnected: z.boolean().optional(),
});
export type UpdateInboxDto = z.infer<typeof updateInboxSchema>;

export const addInboxMemberSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
});
export type AddInboxMemberDto = z.infer<typeof addInboxMemberSchema>;

export interface InboxMemberDto {
  id: string;
  inboxId: string;
  userId: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string | null;
    role?: WorkspaceRole;
  };
  createdAt: string;
}

export interface ChannelSummaryDto {
  id: string;
  workspaceId: string;
  inboxId: string;
  channelType: ChannelType;
  providerAccountId?: string | null;
  settings: Record<string, unknown>;
  isConnected: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChannelDetailDto extends ChannelSummaryDto {
  credentials?: Record<string, unknown>;
}

export interface InboxDto {
  id: string;
  workspaceId: string;
  name: string;
  avatarUrl?: string | null;
  channelType: ChannelType;
  greetingMessage?: string;
  settings: Record<string, unknown>;
  isAutoAssignmentEnabled: boolean;
  memberCount: number;
  channel?: ChannelSummaryDto | null;
  createdAt: string;
  updatedAt: string;
}

export interface InboxDetailDto extends Omit<InboxDto, 'channel'> {
  channel?: ChannelDetailDto | null;
}

// Backward compatibility aliases
export type ChannelDto = ChannelSummaryDto;

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
