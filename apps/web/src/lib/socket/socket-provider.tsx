'use client';

import * as React from 'react';
import type { Socket } from 'socket.io-client';
import { refreshSessionAction } from '@/features/auth/actions';
import { disconnectSocketClient, getSocketClient } from './socket-client';
import type {
  RealtimeConnectedData,
  SocketConnectionStatus,
  SocketContextValue,
  SocketErrorPayload,
} from './socket-types';

export const SocketContext = React.createContext<SocketContextValue | null>(null);

export interface SocketProviderProps {
  children: React.ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const [socket, setSocket] = React.useState<Socket | null>(null);
  const [status, setStatus] = React.useState<SocketConnectionStatus>('idle');
  const [error, setError] = React.useState<SocketErrorPayload | Error | null>(null);
  const [connectedData, setConnectedData] = React.useState<RealtimeConnectedData | null>(null);

  const reconnect = React.useCallback(() => {
    if (socket) {
      setStatus('connecting');
      setError(null);
      socket.disconnect();
      socket.connect();
    }
  }, [socket]);

  React.useEffect(() => {
    const s = getSocketClient();
    setSocket(s);
    setStatus('connecting');

    const handleConnect = () => {
      setStatus('connected');
      setError(null);
    };

    const handleDisconnect = (_reason: string) => {
      // If manually disconnected or client-side navigation, don't mark as error
      setStatus('disconnected');
    };

    const handleConnectError = async (err: Error) => {
      setStatus('error');
      setError(err);

      // If authentication failed, attempt transparent refresh and reconnect
      const isAuthError =
        err.message?.includes('UNAUTHORIZED') ||
        err.message?.includes('jwt') ||
        err.message?.includes('token') ||
        err.message?.includes('unauthorized');

      if (isAuthError) {
        try {
          const newToken = await refreshSessionAction();
          if (newToken) {
            s.connect();
          }
        } catch {
          // Token refresh failure will be handled by auth guards/middleware
        }
      }
    };

    const handleRealtimeError = async (payload: SocketErrorPayload) => {
      setError(payload);
      if (payload?.code === 'UNAUTHORIZED') {
        setStatus('error');
        try {
          const newToken = await refreshSessionAction();
          if (newToken) {
            s.connect();
          }
        } catch {
          // Ignore refresh errors
        }
      }
    };

    const handleConnectedAck = (payload: RealtimeConnectedData) => {
      setConnectedData(payload);
      setStatus('connected');
      setError(null);
    };

    s.on('connect', handleConnect);
    s.on('disconnect', handleDisconnect);
    s.on('connect_error', handleConnectError);
    s.on('error', handleRealtimeError);
    s.on('connected', handleConnectedAck);

    if (!s.connected) {
      s.connect();
    } else {
      setStatus('connected');
    }

    return () => {
      s.off('connect', handleConnect);
      s.off('disconnect', handleDisconnect);
      s.off('connect_error', handleConnectError);
      s.off('error', handleRealtimeError);
      s.off('connected', handleConnectedAck);
      disconnectSocketClient();
      setSocket(null);
      setStatus('disconnected');
    };
  }, []);

  const value: SocketContextValue = React.useMemo(
    () => ({
      socket,
      status,
      isConnected: status === 'connected',
      isConnecting: status === 'connecting',
      error,
      connectedData,
      reconnect,
    }),
    [socket, status, error, connectedData, reconnect],
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}
