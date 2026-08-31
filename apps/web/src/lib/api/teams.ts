import { fetchApi, workspaceHeaders } from './client';
import type {
  AddTeamMembersDto,
  CreateTeamDto,
  RemoveTeamMembersDto,
  TeamDto,
  TeamMemberDto,
  UpdateTeamDto,
} from '@sales-copilot/shared-contracts';

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

  listMembers: (workspaceId: string, teamId: string) =>
    fetchApi<TeamMemberDto[]>(`/teams/${teamId}/members`, {
      headers: workspaceHeaders(workspaceId),
    }),

  addMembers: (workspaceId: string, teamId: string, userIds: string[]) =>
    fetchApi<TeamMemberDto[]>(`/teams/${teamId}/members`, {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify({ userIds } as AddTeamMembersDto),
    }),

  removeMember: (workspaceId: string, teamId: string, userId: string) =>
    fetchApi<{ success: boolean }>(`/teams/${teamId}/members/${userId}`, {
      method: 'DELETE',
      headers: workspaceHeaders(workspaceId),
    }),

  removeMembers: (workspaceId: string, teamId: string, userIds: string[]) =>
    fetchApi<{ success: boolean }>(`/teams/${teamId}/members`, {
      method: 'DELETE',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify({ userIds } as RemoveTeamMembersDto),
    }),
};
