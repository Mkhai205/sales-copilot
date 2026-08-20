import { z } from 'zod';
import { ChannelType } from '../inboxes/enums';

export const createContactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phoneNumber: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  identifier: z.string().optional(),
  customAttributes: z.record(z.unknown()).optional(),
  additionalAttributes: z.record(z.unknown()).optional(),
});

export type CreateContactDto = z.infer<typeof createContactSchema>;

export const updateContactSchema = createContactSchema.partial();
export type UpdateContactDto = z.infer<typeof updateContactSchema>;

export interface ChannelIdentityDto {
  id: string;
  channelId: string;
  channelType?: ChannelType;
  externalContactId: string;
  username?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ContactResponseDto {
  id: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  avatarUrl?: string;
  identifier?: string;
  customAttributes: Record<string, unknown>;
  additionalAttributes: Record<string, unknown>;
  identities: ChannelIdentityDto[];
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
}

export const mergeContactsSchema = z.object({
  mergeeContactId: z.string().min(1),
});
export type MergeContactsDto = z.infer<typeof mergeContactsSchema>;

export interface ContactMergedPayload {
  primaryContactId: string;
  mergedContactId: string;
  mergedByUserId: string;
}
