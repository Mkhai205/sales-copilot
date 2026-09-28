import { buildQueryString, fetchApi, workspaceHeaders } from '@/lib/api/client';
import type { PresenceEntry } from '@sales-copilot/shared-contracts';

export interface WorkspacePresenceQueryDto {
  includeOffline?: boolean;
}

export const presenceApi = {
  getWorkspacePresence: (workspaceId: string, query?: WorkspacePresenceQueryDto) =>
    fetchApi<PresenceEntry[]>(`/presence${buildQueryString(query)}`, {
      headers: workspaceHeaders(workspaceId),
    }),

  getUserPresence: (workspaceId: string, userId: string) =>
    fetchApi<PresenceEntry>(`/presence/${userId}`, {
      headers: workspaceHeaders(workspaceId),
    }),
};
