import { buildQueryString, fetchApi, workspaceHeaders } from './client';
import type {
  AssignConversationDto,
  AssignLabelsDto,
  ConversationListQueryDto,
  ConversationCountsResponseDto,
  ConversationResponseDto,
  ConversationStatus,
  CreateConversationDto,
  LabelDto,
  UpdateConversationPriorityDto,
  UpdateConversationStatusDto,
} from '@sales-copilot/shared-contracts';

export const conversationsApi = {
  list: (workspaceId: string, query?: ConversationListQueryDto) =>
    fetchApi<ConversationResponseDto[]>(`/conversations${buildQueryString(query)}`, {
      headers: workspaceHeaders(workspaceId),
    }),

  getCounts: (workspaceId: string, status?: ConversationStatus) =>
    fetchApi<ConversationCountsResponseDto>(
      `/conversations/counts${buildQueryString(status ? { status } : undefined)}`,
      {
        headers: workspaceHeaders(workspaceId),
      },
    ),

  get: (workspaceId: string, id: string) =>
    fetchApi<ConversationResponseDto>(`/conversations/${id}`, {
      headers: workspaceHeaders(workspaceId),
    }),

  create: (workspaceId: string, dto: CreateConversationDto) =>
    fetchApi<ConversationResponseDto>('/conversations', {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  updateStatus: (workspaceId: string, id: string, dto: UpdateConversationStatusDto) =>
    fetchApi<ConversationResponseDto>(`/conversations/${id}/status`, {
      method: 'PATCH',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  assign: (workspaceId: string, id: string, dto: AssignConversationDto) =>
    fetchApi<ConversationResponseDto>(`/conversations/${id}/assign`, {
      method: 'PATCH',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  updatePriority: (workspaceId: string, id: string, dto: UpdateConversationPriorityDto) =>
    fetchApi<ConversationResponseDto>(`/conversations/${id}/priority`, {
      method: 'PATCH',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  resetUnread: (workspaceId: string, id: string) =>
    fetchApi<ConversationResponseDto>(`/conversations/${id}/reset-unread`, {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
    }),

  getLabels: (workspaceId: string, id: string) =>
    fetchApi<LabelDto[]>(`/conversations/${id}/labels`, {
      headers: workspaceHeaders(workspaceId),
    }),

  assignLabels: (workspaceId: string, id: string, dto: AssignLabelsDto) =>
    fetchApi<LabelDto[]>(`/conversations/${id}/labels`, {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  removeLabel: (workspaceId: string, id: string, labelId: string) =>
    fetchApi<{ success: true }>(`/conversations/${id}/labels/${labelId}`, {
      method: 'DELETE',
      headers: workspaceHeaders(workspaceId),
    }),
};
