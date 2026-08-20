import { z } from 'zod';
import { ConversationStatus, Priority } from './enums';

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
  labels?: {
    id: string;
    title: string;
    color: string;
  }[];
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationAssignedPayload {
  conversationId: string;
  previousAssigneeId?: string;
  newAssigneeId?: string;
  teamId?: string;
  assignedByUserId?: string;
}
