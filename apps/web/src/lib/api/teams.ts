import { fetchApi, workspaceHeaders } from './client';
import type { CreateTeamDto, TeamDto, UpdateTeamDto } from '@sales-copilot/shared-contracts';

export const teamsApi = {
  list: (workspaceId: string) =>
    fetchApi<TeamDto[]>('/teams', {
      headers: workspaceHeaders(workspaceId),
    }),

  get: (workspaceId: string, id: string) =>
    fetchApi<TeamDto>(`/teams/${id}`, {
      headers: workspaceHeaders(workspaceId),
    }),

  create: (workspaceId: string, dto: CreateTeamDto) =>
    fetchApi<TeamDto>('/teams', {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  update: (workspaceId: string, id: string, dto: UpdateTeamDto) =>
    fetchApi<TeamDto>(`/teams/${id}`, {
      method: 'PATCH',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  delete: (workspaceId: string, id: string) =>
    fetchApi<{ success: boolean }>(`/teams/${id}`, {
      method: 'DELETE',
      headers: workspaceHeaders(workspaceId),
    }),
};
