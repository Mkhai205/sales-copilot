import { buildQueryString, fetchApi, workspaceHeaders } from './client';

export interface FacebookPageInfo {
  pageId: string;
  pageName: string;
  avatarUrl?: string;
  category?: string;
  isAlreadyConnected: boolean;
}

export interface ConnectFacebookPageDto {
  pageId: string;
  pageName: string;
  pageAccessToken?: string;
  userAccessToken?: string;
  inboxName?: string;
  memberUserIds?: string[];
}

export interface ConnectFacebookPagesBatchDto {
  pageIds: string[];
  sessionId: string;
  memberUserIds?: string[];
  assignAllMembers?: boolean;
}

export const facebookApi = {
  getAuthUrl: (workspaceId: string, origin?: string, returnUrl?: string) =>
    fetchApi<{ authUrl: string }>(
      `/integrations/facebook/auth-url${buildQueryString({ origin, returnUrl })}`,
      {
        headers: workspaceHeaders(workspaceId),
      },
    ),

  discoverPages: (workspaceId: string, sessionId: string) =>
    fetchApi<FacebookPageInfo[]>(`/integrations/facebook/pages${buildQueryString({ sessionId })}`, {
      headers: workspaceHeaders(workspaceId),
    }),

  connectPage: (workspaceId: string, dto: ConnectFacebookPageDto, sessionId?: string) =>
    fetchApi<{ inboxId: string; channelId: string }>(
      `/integrations/facebook/connect${buildQueryString({ sessionId })}`,
      {
        method: 'POST',
        headers: workspaceHeaders(workspaceId),
        body: JSON.stringify(dto),
      },
    ),

  connectPagesBatch: (workspaceId: string, dto: ConnectFacebookPagesBatchDto) =>
    fetchApi<{
      inboxes: Array<{ inboxId: string; channelId: string; pageId: string; pageName: string }>;
    }>('/integrations/facebook/connect-batch', {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  reauthorizePage: (workspaceId: string, channelId: string, omniAuthToken: string) =>
    fetchApi<{ success: boolean }>(`/integrations/facebook/reauthorize/${channelId}`, {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify({ omniAuthToken }),
    }),

  disconnectPage: (workspaceId: string, channelId: string) =>
    fetchApi<{ success: boolean }>(`/integrations/facebook/disconnect/${channelId}`, {
      method: 'DELETE',
      headers: workspaceHeaders(workspaceId),
    }),
};
