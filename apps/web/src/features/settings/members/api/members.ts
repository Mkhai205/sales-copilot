import { fetchApi, workspaceHeaders } from '@/lib/api/client';
import type {
  AddWorkspaceMemberDto,
  UpdateWorkspaceMemberRoleDto,
  WorkspaceMemberDto,
} from '@sales-copilot/shared-contracts';

export const membersApi = {
  list: (workspaceId: string) =>
    fetchApi<WorkspaceMemberDto[]>('/workspaces/current/members', {
      headers: workspaceHeaders(workspaceId),
    }),

  add: (workspaceId: string, dto: AddWorkspaceMemberDto) =>
    fetchApi<WorkspaceMemberDto>('/workspaces/current/members', {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  updateRole: (workspaceId: string, memberId: string, dto: UpdateWorkspaceMemberRoleDto) =>
    fetchApi<WorkspaceMemberDto>(`/workspaces/current/members/${memberId}`, {
      method: 'PATCH',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  remove: (workspaceId: string, memberId: string) =>
    fetchApi<{ success: boolean }>(`/workspaces/current/members/${memberId}`, {
      method: 'DELETE',
      headers: workspaceHeaders(workspaceId),
    }),
};
