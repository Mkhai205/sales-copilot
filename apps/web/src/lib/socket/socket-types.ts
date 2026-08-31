import type { Socket } from 'socket.io-client';

export type SocketConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

export interface SocketErrorPayload {
  code?: string;
  message: string;
  details?: unknown;
}

export interface RealtimeConnectedData {
  userId: string;
  email: string;
  role: string;
  availableWorkspaceIds: string[];
  connectedAt: string;
}

export interface SocketContextValue {
  socket: Socket | null;
  status: SocketConnectionStatus;
  isConnected: boolean;
  isConnecting: boolean;
  error: SocketErrorPayload | Error | null;
  connectedData: RealtimeConnectedData | null;
  reconnect: () => void;
}
