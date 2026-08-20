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
