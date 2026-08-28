import { fetchApi } from './client';
import type {
  AddWorkspaceMemberDto,
  CreateWorkspaceDto,
  UpdateWorkspaceDto,
  UpdateWorkspaceMemberRoleDto,
  UserWorkspaceDto,
  WorkspaceDto,
  WorkspaceMemberDto,
} from '@sales-copilot/shared-contracts';

function workspaceHeaders(workspaceId?: string): HeadersInit {
  return workspaceId ? { 'X-Workspace-Id': workspaceId } : {};
}

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

  listMembers: (workspaceId: string) =>
    fetchApi<WorkspaceMemberDto[]>('/workspaces/current/members', {
      headers: workspaceHeaders(workspaceId),
    }),

  addMember: (workspaceId: string, dto: AddWorkspaceMemberDto) =>
    fetchApi<WorkspaceMemberDto>('/workspaces/current/members', {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  updateMemberRole: (workspaceId: string, memberId: string, dto: UpdateWorkspaceMemberRoleDto) =>
    fetchApi<WorkspaceMemberDto>(`/workspaces/current/members/${memberId}`, {
      method: 'PATCH',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  removeMember: (workspaceId: string, memberId: string) =>
    fetchApi<{ success: boolean }>(`/workspaces/current/members/${memberId}`, {
      method: 'DELETE',
      headers: workspaceHeaders(workspaceId),
    }),
};
