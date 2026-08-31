'use client';

import * as React from 'react';
import { WsClientEvent, type WsServerEvent } from '@sales-copilot/shared-contracts';
import { SocketContext } from './socket-provider';
import type { SocketContextValue } from './socket-types';

/**
 * Hook to access the current Socket.io connection instance and state.
 */
export function useSocket(): SocketContextValue {
  const context = React.useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a <SocketProvider>');
  }
  return context;
}

/**
 * Type-safe hook to listen to specific realtime server events on the active socket.
 * Automatically unpacks envelope `{ event, data }` and cleans up listeners on unmount.
 */
export function useSocketEvent<T = unknown>(
  event: WsServerEvent | string,
  handler: (data: T) => void,
  deps: React.DependencyList = [],
): void {
  const { socket } = useSocket();
  const handlerRef = React.useRef(handler);

  React.useEffect(() => {
    handlerRef.current = handler;
  });

  React.useEffect(() => {
    if (!socket) return;

    const listener = (payload: any) => {
      // Backend may send { event, data } envelope or raw payload
      const eventData =
        payload && typeof payload === 'object' && 'data' in payload
          ? (payload as { data: T }).data
          : (payload as T);

      handlerRef.current(eventData);
    };

    socket.on(event, listener);

    return () => {
      socket.off(event, listener);
    };
  }, [socket, event, ...deps]);
}

/**
 * Hook that joins a workspace room on connect/reconnect and leaves on unmount or workspace switch.
 */
export function useWorkspaceRoom(workspaceId?: string | null): void {
  const { socket, isConnected } = useSocket();

  React.useEffect(() => {
    if (!socket || !isConnected || !workspaceId) {
      return;
    }

    // Join workspace room
    socket.emit(WsClientEvent.JOIN_WORKSPACE, { workspaceId });

    // Handle reconnect: re-join workspace when connection is re-established
    const handleReconnect = () => {
      socket.emit(WsClientEvent.JOIN_WORKSPACE, { workspaceId });
    };

    socket.on('connect', handleReconnect);

    return () => {
      socket.off('connect', handleReconnect);
      socket.emit(WsClientEvent.LEAVE_WORKSPACE, { workspaceId });
    };
  }, [socket, isConnected, workspaceId]);
}
