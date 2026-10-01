import { fetchApi, workspaceHeaders } from '@/lib/api/client';

export interface ConnectZaloPersonalResponse {
  inboxId: string;
  channelId: string;
  ownId: string;
  zaloName: string;
}

export interface ConnectZaloPersonalDto {
  sessionId: string;
  memberUserIds?: string[];
  assignAllMembers?: boolean;
}

export interface ZaloPersonalSessionStatus {
  status: 'pending' | 'qr_ready' | 'scanned' | 'connected' | 'failed' | 'expired';
  qrImage?: string;
  profileName?: string;
  ownId?: string;
  error?: string;
}

export const zaloPersonalApi = {
  createConnectSession: (workspaceId: string, channelId?: string) =>
    fetchApi<{ sessionId: string; expiresInMs: number }>(
      '/integrations/zalo-personal/connect-session',
      {
        method: 'POST',
        headers: workspaceHeaders(workspaceId),
        body: JSON.stringify({ channelId }),
      },
    ),

  getConnectSessionStatus: (workspaceId: string, sessionId: string) =>
    fetchApi<ZaloPersonalSessionStatus>(
      `/integrations/zalo-personal/connect-session/${sessionId}/status`,
      {
        headers: workspaceHeaders(workspaceId),
      },
    ),

  connect: (workspaceId: string, dto: ConnectZaloPersonalDto) =>
    fetchApi<ConnectZaloPersonalResponse>('/integrations/zalo-personal/connect', {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  createReauthorizeSession: (workspaceId: string, channelId: string) =>
    fetchApi<{ sessionId: string; expiresInMs: number }>(
      `/integrations/zalo-personal/reauthorize/${channelId}`,
      {
        method: 'POST',
        headers: workspaceHeaders(workspaceId),
      },
    ),

  completeReauthorize: (workspaceId: string, channelId: string, sessionId: string) =>
    fetchApi<{ success: boolean }>(
      `/integrations/zalo-personal/reauthorize/${channelId}/complete`,
      {
        method: 'POST',
        headers: workspaceHeaders(workspaceId),
        body: JSON.stringify({ sessionId }),
      },
    ),
};
