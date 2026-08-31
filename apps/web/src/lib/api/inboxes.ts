import { fetchApi, workspaceHeaders } from './client';
import type {
  AddInboxMemberDto,
  CreateInboxDto,
  InboxDetailDto,
  InboxDto,
  InboxMemberDto,
  UpdateInboxDto,
} from '@sales-copilot/shared-contracts';

export const inboxesApi = {
  list: (workspaceId: string) =>
    fetchApi<InboxDto[]>('/inboxes', {
      headers: workspaceHeaders(workspaceId),
    }),

  getById: (workspaceId: string, id: string) =>
    fetchApi<InboxDetailDto>(`/inboxes/${id}`, {
      headers: workspaceHeaders(workspaceId),
    }),

  create: (workspaceId: string, dto: CreateInboxDto) =>
    fetchApi<InboxDetailDto>('/inboxes', {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  update: (workspaceId: string, id: string, dto: UpdateInboxDto) =>
    fetchApi<InboxDetailDto>(`/inboxes/${id}`, {
      method: 'PATCH',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  delete: (workspaceId: string, id: string) =>
    fetchApi<{ success: boolean; message: string }>(`/inboxes/${id}`, {
      method: 'DELETE',
      headers: workspaceHeaders(workspaceId),
    }),

  listMembers: (workspaceId: string, inboxId: string) =>
    fetchApi<InboxMemberDto[]>(`/inboxes/${inboxId}/members`, {
      headers: workspaceHeaders(workspaceId),
    }),

  addMember: (workspaceId: string, inboxId: string, userId: string) =>
    fetchApi<InboxMemberDto>(`/inboxes/${inboxId}/members`, {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify({ userId } as AddInboxMemberDto),
    }),

  removeMember: (workspaceId: string, inboxId: string, userId: string) =>
    fetchApi<{ success: boolean; message: string }>(`/inboxes/${inboxId}/members/${userId}`, {
      method: 'DELETE',
      headers: workspaceHeaders(workspaceId),
    }),
};
