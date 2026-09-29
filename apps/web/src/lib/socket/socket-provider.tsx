'use client';

import * as React from 'react';
import type { Socket } from 'socket.io-client';
import { refreshSessionAction } from '@/features/auth/actions/auth-actions';
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

let disconnectTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Consecutive auth-failure refreshes before giving up. Reset whenever the
 * socket reaches 'connected'. Prevents an unbounded refresh→connect→
 * UNAUTHORIZED→refresh cycle when refresh tokens are valid but rejected by
 * the gateway (clock skew, revoked sessions, ...).
 */
const MAX_CONSECUTIVE_AUTH_REFRESHES = 2;

export function SocketProvider({ children }: SocketProviderProps) {
  const [socket, setSocket] = React.useState<Socket | null>(null);
  const [status, setStatus] = React.useState<SocketConnectionStatus>('idle');
  const [error, setError] = React.useState<SocketErrorPayload | Error | null>(null);
  const [connectedData, setConnectedData] = React.useState<RealtimeConnectedData | null>(null);
  const authRefreshesRef = React.useRef(0);

  const reconnect = React.useCallback(() => {
    if (socket) {
      authRefreshesRef.current = 0;
      setStatus('connecting');
      setError(null);
      socket.disconnect();
      socket.connect();
    }
  }, [socket]);

  React.useEffect(() => {
    if (disconnectTimeout) {
      clearTimeout(disconnectTimeout);
      disconnectTimeout = null;
    }

    const s = getSocketClient();
    setSocket(s);
    setStatus('connecting');

    const handleConnect = () => {
      authRefreshesRef.current = 0;
      setStatus('connected');
      setError(null);
    };

    const handleDisconnect = (_reason: string) => {
      // If manually disconnected or client-side navigation, don't mark as error
      setStatus('disconnected');
    };

    // socket.io connect_error fires for transport/handshake issues. Auth
    // failures are NOT delivered here — the gateway emits a custom `error`
    // event with code UNAUTHORIZED and force-disconnects (see
    // realtime.gateway.ts handleConnection).
    const handleConnectError = (err: Error) => {
      setStatus('error');
      setError(err);
    };

    const handleRealtimeError = async (payload: SocketErrorPayload) => {
      setError(payload);
      if (payload?.code === 'UNAUTHORIZED') {
        setStatus('error');
        // Transparent refresh + reconnect, capped to avoid an unbounded loop
        if (authRefreshesRef.current >= MAX_CONSECUTIVE_AUTH_REFRESHES) {
          return;
        }
        authRefreshesRef.current += 1;
        try {
          const newToken = await refreshSessionAction();
          if (newToken) {
            s.connect();
          }
        } catch {
          // Ignore refresh errors — auth guards/proxy handle recovery
        }
      }
    };

    const handleConnectedAck = (payload: RealtimeConnectedData) => {
      authRefreshesRef.current = 0;
      setConnectedData(payload);
      setStatus('connected');
      setError(null);
    };

    // Revive the socket when the tab becomes visible again or the network
    // comes back — socket.io gives up after `reconnectionAttempts` and stays
    // silent otherwise. The auth-refresh cap in handleRealtimeError still
    // applies: a capped-out session is only revived by a manual reconnect().
    const handleRevive = () => {
      if (!s.disconnected) return;
      setStatus('connecting');
      s.connect();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') handleRevive();
    };
    const handleReconnectFailed = () => {
      setStatus('error');
      setError({ code: 'RECONNECT_FAILED', message: 'Realtime connection lost' });
    };
    const handleOnline = () => handleRevive();

    s.on('connect', handleConnect);
    s.on('disconnect', handleDisconnect);
    s.on('connect_error', handleConnectError);
    s.on('error', handleRealtimeError);
    s.on('connected', handleConnectedAck);
    s.on('reconnect_failed', handleReconnectFailed);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

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
      s.off('reconnect_failed', handleReconnectFailed);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      disconnectTimeout = setTimeout(() => {
        disconnectSocketClient();
        setSocket(null);
        setStatus('disconnected');
      }, 200);
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
