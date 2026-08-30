import { buildQueryString, fetchApi, workspaceHeaders } from './client';
import type {
  CreateMessageDto,
  MessageListQueryDto,
  MessageResponseDto,
  UpdateDeliveryStatusDto,
} from '@sales-copilot/shared-contracts';

export const messagesApi = {
  list: (workspaceId: string, conversationId: string, query?: MessageListQueryDto) =>
    fetchApi<MessageResponseDto[]>(
      `/conversations/${conversationId}/messages${buildQueryString(query)}`,
      {
        headers: workspaceHeaders(workspaceId),
      },
    ),

  create: (workspaceId: string, conversationId: string, payload: CreateMessageDto | FormData) => {
    const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData;
    return fetchApi<MessageResponseDto>(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
      body: isFormData ? payload : JSON.stringify(payload),
    });
  },

  get: (workspaceId: string, id: string) =>
    fetchApi<MessageResponseDto>(`/messages/${id}`, {
      headers: workspaceHeaders(workspaceId),
    }),

  updateDeliveryStatus: (workspaceId: string, id: string, dto: UpdateDeliveryStatusDto) =>
    fetchApi<MessageResponseDto>(`/messages/${id}/delivery-status`, {
      method: 'PATCH',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  delete: (workspaceId: string, id: string) =>
    fetchApi<{ success: true }>(`/messages/${id}`, {
      method: 'DELETE',
      headers: workspaceHeaders(workspaceId),
    }),
};
