import { fetchApi, workspaceHeaders } from '@/lib/api/client';
import type {
  CreateWorkspaceDto,
  UpdateWorkspaceDto,
  UserWorkspaceDto,
  WorkspaceDto,
} from '@sales-copilot/shared-contracts';

export const workspacesApi = {
  list: () => fetchApi<UserWorkspaceDto[]>('/workspaces'),

  create: (dto: CreateWorkspaceDto) =>
    fetchApi<WorkspaceDto>('/workspaces', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  getCurrent: (workspaceId: string) =>
    fetchApi<WorkspaceDto>('/workspaces/current', {
      headers: workspaceHeaders(workspaceId),
    }),

  updateCurrent: (workspaceId: string, dto: UpdateWorkspaceDto) =>
    fetchApi<WorkspaceDto>('/workspaces/current', {
      method: 'PATCH',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),
};
