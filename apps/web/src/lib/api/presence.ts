import { buildQueryString, fetchApi, workspaceHeaders } from './client';
import type { PresenceEntry } from './types';

export interface WorkspacePresenceQueryDto {
  includeOffline?: boolean;
}

export const presenceApi = {
  getWorkspacePresence: (workspaceId: string, query?: WorkspacePresenceQueryDto) =>
    fetchApi<PresenceEntry[]>(`/workspaces/${workspaceId}/presence${buildQueryString(query)}`, {
      headers: workspaceHeaders(workspaceId),
    }),

  getUserPresence: (workspaceId: string, userId: string) =>
    fetchApi<PresenceEntry>(`/workspaces/${workspaceId}/presence/${userId}`, {
      headers: workspaceHeaders(workspaceId),
    }),
};
