'use client';

import * as React from 'react';
import { WsServerEvent, type TypingEventPayload } from '@sales-copilot/shared-contracts';
import { useCurrentUser } from '@/features/auth/use-current-user';
import { useSocketEvent } from '@/lib/socket';

export interface TypingUserEntry {
  userId: string;
  userName?: string;
  email?: string;
  timestamp: number;
}

export interface TypingServerData {
  conversationId: string;
  userId?: string;
  userName?: string;
  name?: string;
  email?: string;
  isTyping?: boolean;
}

export function useTypingUsers(conversationId?: string | null) {
  const { data: currentUser } = useCurrentUser();
  const [typingMap, setTypingMap] = React.useState<Map<string, TypingUserEntry>>(new Map());

  // Handle typing.start
  useSocketEvent<TypingServerData | TypingEventPayload>(
    WsServerEvent.TYPING_START,
    data => {
      if (!conversationId || !data) return;
      if (data.conversationId !== conversationId) return;

      const targetUserId = data.userId;
      if (!targetUserId || targetUserId === currentUser?.id) return;

      const name =
        (data as TypingServerData).userName ||
        (data as TypingServerData).name ||
        (data as TypingServerData).email?.split('@')[0] ||
        'Someone';

      setTypingMap(prev => {
        const next = new Map(prev);
        next.set(targetUserId, {
          userId: targetUserId,
          userName: name,
          email: (data as TypingServerData).email,
          timestamp: Date.now(),
        });
        return next;
      });
    },
    [conversationId, currentUser?.id],
  );

  // Handle typing.stop
  useSocketEvent<TypingServerData | TypingEventPayload>(
    WsServerEvent.TYPING_STOP,
    data => {
      if (!conversationId || !data) return;
      if (data.conversationId !== conversationId) return;

      const targetUserId = data.userId;
      if (!targetUserId) return;

      setTypingMap(prev => {
        if (!prev.has(targetUserId)) return prev;
        const next = new Map(prev);
        next.delete(targetUserId);
        return next;
      });
    },
    [conversationId],
  );

  // Fallback cleanup interval: clear entries older than 4 seconds
  React.useEffect(() => {
    if (!conversationId) return;

    const interval = setInterval(() => {
      const now = Date.now();
      setTypingMap(prev => {
        let hasExpired = false;
        const next = new Map(prev);

        for (const [key, entry] of prev.entries()) {
          if (now - entry.timestamp > 4000) {
            next.delete(key);
            hasExpired = true;
          }
        }

        return hasExpired ? next : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [conversationId]);

  // Reset typing map when switching conversation
  React.useEffect(() => {
    setTypingMap(new Map());
  }, [conversationId]);

  const typingUsers = React.useMemo(() => {
    return Array.from(typingMap.values());
  }, [typingMap]);

  const typingLabel = React.useMemo(() => {
    if (typingUsers.length === 0) return '';
    if (typingUsers.length === 1) {
      return `${typingUsers[0].userName || 'Someone'} is typing...`;
    }
    if (typingUsers.length === 2) {
      return `${typingUsers[0].userName} and ${typingUsers[1].userName} are typing...`;
    }
    return 'Several agents are typing...';
  }, [typingUsers]);

  return {
    typingUsers,
    isTyping: typingUsers.length > 0,
    typingLabel,
  };
}
