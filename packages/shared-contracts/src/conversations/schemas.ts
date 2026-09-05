import { z } from 'zod';
import { ConversationStatus, ConversationPriority, Priority } from './enums';
import type { LabelDto } from '../labels';
import type { ContactDto } from '../contacts';
import type { MessageResponseDto } from '../messages';
import type { ChannelType } from '../inboxes';

// ==========================================
// 1. Request Validation Schemas
// ==========================================

export const createConversationSchema = z.object({
  contactId: z.string().uuid('Invalid contact ID'),
  inboxId: z.string().uuid('Invalid inbox ID'),
  channelIdentityId: z.string().uuid('Invalid channel identity ID').optional().nullable(),
  assigneeId: z.string().uuid('Invalid assignee ID').optional().nullable(),
  teamId: z.string().uuid('Invalid team ID').optional().nullable(),
  priority: z.nativeEnum(Priority).optional().default(Priority.MEDIUM),
  customAttributes: z.record(z.unknown()).optional(),
});
export type CreateConversationDto = z.input<typeof createConversationSchema>;

export const updateConversationStatusSchema = z.object({
  status: z.nativeEnum(ConversationStatus),
  snoozedUntil: z
    .string()
    .datetime({ message: 'snoozedUntil must be a valid ISO-8601 datetime' })
    .optional()
    .nullable(),
});
export type UpdateConversationStatusDto = z.input<typeof updateConversationStatusSchema>;

export const assignConversationSchema = z.object({
  assigneeId: z.string().uuid('Invalid assignee ID').optional().nullable(),
  teamId: z.string().uuid('Invalid team ID').optional().nullable(),
});
export type AssignConversationDto = z.input<typeof assignConversationSchema>;

export const updateConversationPrioritySchema = z.object({
  priority: z.nativeEnum(Priority),
});
export type UpdateConversationPriorityDto = z.input<typeof updateConversationPrioritySchema>;

export const assignLabelsSchema = z.object({
  labelIds: z
    .array(z.string().uuid('Invalid label ID'))
    .min(1, 'At least one label ID is required'),
});
export type AssignLabelsDto = z.input<typeof assignLabelsSchema>;

export const conversationSortBySchema = z.enum([
  'lastActivityAt',
  'createdAt',
  'priority',
  'unreadMessagesCount',
]);
export type ConversationSortBy = z.infer<typeof conversationSortBySchema>;

export const conversationListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.nativeEnum(ConversationStatus).optional(),
  inboxId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().or(z.literal('unassigned')).optional(),
  teamId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  labelId: z.string().uuid().optional(),
  priority: z.nativeEnum(Priority).optional(),
  q: z.string().optional(),
  sortBy: conversationSortBySchema.default('lastActivityAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type ConversationListQueryDto = z.input<typeof conversationListQuerySchema>;
export type ConversationListQueryOutput = z.output<typeof conversationListQuerySchema>;

export const conversationCountsQuerySchema = z.object({
  status: z.nativeEnum(ConversationStatus).optional(),
});
export type ConversationCountsQueryDto = z.input<typeof conversationCountsQuerySchema>;

export interface ConversationCountsResponseDto {
  mine: number;
  unassigned: number;
  all: number;
}

// ==========================================
// 2. Response DTOs
// ==========================================

export interface ConversationResponseDto {
  id: string;
  displayId: number;
  workspaceId: string;
  inboxId: string;
  contactId: string;
  channelIdentityId?: string | null;
  assigneeId?: string | null;
  teamId?: string | null;
  status: ConversationStatus;
  priority: ConversationPriority;
  unreadMessagesCount: number;
  lastActivityAt: string;
  waitingSince?: string | null;
  snoozedUntil?: string | null;
  firstReplyCreatedAt?: string | null;
  customAttributes?: Record<string, unknown>;
  labels?: {
    id: string;
    title: string;
    color: string;
  }[];
  contact?: ContactDto | null;
  inbox?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    channelType?: ChannelType | null;
  } | null;
  assignee?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  } | null;
  team?: {
    id: string;
    name: string;
  } | null;
  lastMessage?: MessageResponseDto | null;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// 3. Domain Events
// ==========================================

export interface ConversationCreatedEvent {
  workspaceId: string;
  conversation: ConversationResponseDto;
}

export interface ConversationStatusUpdatedEvent {
  workspaceId: string;
  conversationId: string;
  previousStatus: ConversationStatus;
  currentStatus: ConversationStatus;
  conversation: ConversationResponseDto;
}

export interface ConversationAssignedEvent {
  workspaceId?: string;
  conversationId: string;
  previousAssigneeId?: string | null;
  newAssigneeId?: string | null;
  teamId?: string | null;
  assignedByUserId?: string | null;
  conversation?: ConversationResponseDto;
}

// Kept for backward-compatibility
export type ConversationAssignedPayload = ConversationAssignedEvent;

export interface ConversationPriorityUpdatedEvent {
  workspaceId: string;
  conversationId: string;
  previousPriority: ConversationPriority;
  currentPriority: ConversationPriority;
  conversation: ConversationResponseDto;
}

export interface ConversationReopenedEvent {
  workspaceId: string;
  conversationId: string;
  triggeredBySenderType: string;
  conversation: ConversationResponseDto;
}

export interface ConversationLabelsUpdatedEvent {
  workspaceId: string;
  conversationId: string;
  labelIds: string[];
  labels: LabelDto[];
  conversation: ConversationResponseDto;
}
