'use client';

import * as React from 'react';
import { WsClientEvent } from '@sales-copilot/shared-contracts';
import { useSocket } from './use-socket';

/**
 * Hook that joins a specific conversation room on connect/reconnect and leaves on unmount or conversation switch.
 */
export function useConversationRoom(conversationId?: string | null): void {
  const { socket, isConnected } = useSocket();

  React.useEffect(() => {
    if (!socket || !isConnected || !conversationId) {
      return;
    }

    // Join conversation room
    socket.emit(WsClientEvent.JOIN_CONVERSATION, { conversationId });

    // Handle reconnect: re-join conversation when socket reconnects
    const handleReconnect = () => {
      socket.emit(WsClientEvent.JOIN_CONVERSATION, { conversationId });
    };

    socket.on('connect', handleReconnect);

    return () => {
      socket.off('connect', handleReconnect);
      socket.emit(WsClientEvent.LEAVE_CONVERSATION, { conversationId });
    };
  }, [socket, isConnected, conversationId]);
}
