import { z } from 'zod';
import { ChannelType } from '../inboxes/enums';
import type { PaginationMeta } from '../common';

export const createContactSchema = z.object({
  name: z.string().trim().min(1, 'Contact name is required'),
  email: z.string().trim().email('Invalid email format').or(z.literal('')).optional().nullable(),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{1,14}$/, 'Invalid phone number format (E.164 expected)')
    .or(z.literal(''))
    .optional()
    .nullable(),
  avatarUrl: z.string().trim().url('Invalid avatar URL').or(z.literal('')).optional().nullable(),
  identifier: z.string().trim().min(1).or(z.literal('')).optional().nullable(),
  customAttributes: z.record(z.unknown()).optional(),
  additionalAttributes: z.record(z.unknown()).optional(),
});

export type CreateContactDto = z.input<typeof createContactSchema>;

export const updateContactSchema = createContactSchema.partial();
export type UpdateContactDto = z.input<typeof updateContactSchema>;

export const contactSortBySchema = z.enum(['createdAt', 'name', 'updatedAt']);
export type ContactSortBy = z.infer<typeof contactSortBySchema>;

export const sortOrderSchema = z.enum(['asc', 'desc']);
export type SortOrder = z.infer<typeof sortOrderSchema>;

export const contactListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  q: z.string().optional(),
  sortBy: contactSortBySchema.default('createdAt'),
  sortOrder: sortOrderSchema.default('desc'),
});

export type ContactListQueryDto = z.input<typeof contactListQuerySchema>;
export type ContactListQueryOutput = z.output<typeof contactListQuerySchema>;

export const contactSearchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Search query q is required'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type ContactSearchQueryDto = z.input<typeof contactSearchQuerySchema>;
export type ContactSearchQueryOutput = z.output<typeof contactSearchQuerySchema>;

export interface ChannelIdentityDto {
  id: string;
  contactId?: string;
  workspaceId?: string;
  channelId: string;
  channelType?: ChannelType;
  externalContactId: string;
  username?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: Date | string;
  updatedAt?: Date | string;
}

export interface ContactDto {
  id: string;
  workspaceId: string;
  name: string;
  email: string | null;
  phoneNumber: string | null;
  avatarUrl: string | null;
  identifier: string | null;
  customAttributes: Record<string, unknown>;
  additionalAttributes: Record<string, unknown>;
  createdAt: Date | string;
  updatedAt: Date | string;
  identities?: ChannelIdentityDto[];
}

export type ContactResponseDto = ContactDto;

export interface PaginatedContactsDto {
  items: ContactDto[];
  meta: PaginationMeta;
}

export const mergeContactsSchema = z.object({
  baseContactId: z.string().uuid(),
  mergeeContactId: z.string().uuid(),
});
export type MergeContactsDto = z.infer<typeof mergeContactsSchema>;

export interface ContactMergedPayload {
  primaryContactId: string;
  mergedContactId: string;
  mergedByUserId: string;
}

export interface ContactCreatedEvent {
  workspaceId: string;
  contact: ContactDto;
}

export interface ContactUpdatedEvent {
  workspaceId: string;
  contact: ContactDto;
  previousAttributes?: {
    customAttributes?: Record<string, unknown>;
    additionalAttributes?: Record<string, unknown>;
  };
}

export interface ContactDeletedEvent {
  workspaceId: string;
  contactId: string;
  contact: ContactDto;
}
