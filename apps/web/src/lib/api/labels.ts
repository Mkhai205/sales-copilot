import { buildQueryString, fetchApi, workspaceHeaders } from './client';
import type {
  CreateLabelDto,
  LabelDto,
  LabelListQueryDto,
  UpdateLabelDto,
} from '@sales-copilot/shared-contracts';

export const labelsApi = {
  list: (workspaceId: string, query?: LabelListQueryDto) =>
    fetchApi<LabelDto[]>(`/labels${buildQueryString(query)}`, {
      headers: workspaceHeaders(workspaceId),
    }),

  get: (workspaceId: string, id: string) =>
    fetchApi<LabelDto>(`/labels/${id}`, {
      headers: workspaceHeaders(workspaceId),
    }),

  create: (workspaceId: string, dto: CreateLabelDto) =>
    fetchApi<LabelDto>('/labels', {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  update: (workspaceId: string, id: string, dto: UpdateLabelDto) =>
    fetchApi<LabelDto>(`/labels/${id}`, {
      method: 'PATCH',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  delete: (workspaceId: string, id: string) =>
    fetchApi<{ success: true }>(`/labels/${id}`, {
      method: 'DELETE',
      headers: workspaceHeaders(workspaceId),
    }),
};
