import { buildQueryString, fetchApi, workspaceHeaders } from './client';
import type {
  CannedResponseDto,
  CannedResponseListQueryDto,
  CreateCannedResponseDto,
  UpdateCannedResponseDto,
} from './types';

export const cannedResponsesApi = {
  list: (workspaceId: string, query?: CannedResponseListQueryDto) =>
    fetchApi<CannedResponseDto[]>(`/canned-responses${buildQueryString(query)}`, {
      headers: workspaceHeaders(workspaceId),
    }),

  getById: (workspaceId: string, id: string) =>
    fetchApi<CannedResponseDto>(`/canned-responses/${id}`, {
      headers: workspaceHeaders(workspaceId),
    }),

  create: (workspaceId: string, dto: CreateCannedResponseDto) =>
    fetchApi<CannedResponseDto>('/canned-responses', {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  update: (workspaceId: string, id: string, dto: UpdateCannedResponseDto) =>
    fetchApi<CannedResponseDto>(`/canned-responses/${id}`, {
      method: 'PATCH',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  delete: (workspaceId: string, id: string) =>
    fetchApi<{ success: true }>(`/canned-responses/${id}`, {
      method: 'DELETE',
      headers: workspaceHeaders(workspaceId),
    }),
};
