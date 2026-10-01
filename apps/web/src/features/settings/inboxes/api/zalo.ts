import { buildQueryString, fetchApi, workspaceHeaders } from '@/lib/api/client';

export interface ConnectZaloOaResponse {
  inboxId: string;
  channelId: string;
  oaId: string;
  oaName: string;
}

export interface ConnectZaloOaDto {
  sessionId: string;
  oaSecretKey?: string;
  memberUserIds?: string[];
  assignAllMembers?: boolean;
}

export const zaloApi = {
  getConnectConfig: (workspaceId: string) =>
    fetchApi<{ redirectUri: string }>('/integrations/zalo/config', {
      headers: workspaceHeaders(workspaceId),
    }),

  getAuthUrl: (workspaceId: string, origin?: string, returnUrl?: string, channelId?: string) =>
    fetchApi<{ authUrl: string }>(
      `/integrations/zalo/auth-url${buildQueryString({ origin, returnUrl, channelId })}`,
      {
        headers: workspaceHeaders(workspaceId),
      },
    ),

  getSessionInfo: (workspaceId: string, sessionId: string) =>
    fetchApi<{ oaId: string; oaName: string; oaAvatar?: string }>(
      `/integrations/zalo/session${buildQueryString({ sessionId })}`,
      {
        headers: workspaceHeaders(workspaceId),
      },
    ),

  connect: (workspaceId: string, dto: ConnectZaloOaDto) =>
    fetchApi<ConnectZaloOaResponse>('/integrations/zalo/connect', {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),
};
