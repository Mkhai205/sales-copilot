'use client';

import * as React from 'react';
import { WsClientEvent } from '@sales-copilot/shared-contracts';
import { useSocket } from '@/lib/socket';

export interface UseTypingIndicatorOptions {
  conversationId: string;
  disabled?: boolean;
}

/**
 * Hook to emit typing status events (start_typing / stop_typing) over WebSocket
 * with automatic 3-second debounce timeout.
 */
export function useTypingIndicator({
  conversationId,
  disabled = false,
}: UseTypingIndicatorOptions) {
  const { socket, isConnected } = useSocket();
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = React.useRef(false);

  const stopTyping = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (isTypingRef.current && socket && isConnected && conversationId) {
      socket.emit(WsClientEvent.STOP_TYPING, {
        conversationId,
        isTyping: false,
      });
      isTypingRef.current = false;
    }
  }, [socket, isConnected, conversationId]);

  const startTyping = React.useCallback(() => {
    if (disabled || !socket || !isConnected || !conversationId) return;

    // If not currently marked as typing, emit start_typing
    if (!isTypingRef.current) {
      socket.emit(WsClientEvent.START_TYPING, {
        conversationId,
        isTyping: true,
      });
      isTypingRef.current = true;
    }

    // Reset 3-second auto-stop timer
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  }, [disabled, socket, isConnected, conversationId, stopTyping]);

  // Clean up when unmounting or switching conversation
  React.useEffect(() => {
    return () => {
      stopTyping();
    };
  }, [conversationId, stopTyping]);

  return {
    startTyping,
    stopTyping,
  };
}
