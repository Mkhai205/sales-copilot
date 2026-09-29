'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  PresenceStatus,
  WsClientEvent,
  WsServerEvent,
  type PresenceEntry,
  type PresenceUpdatedEvent,
} from '@sales-copilot/shared-contracts';
import { useWorkspaceContext } from '@/providers/workspace-provider';
import { useSocket, useSocketEvent, useWorkspaceRoom } from './use-socket';
import { presenceKeys } from '@/lib/query-keys';

/**
 * Headless synchronization component that resolves workspace ID from slug,
 * binds the socket to the workspace room, maintains the singleton 30s heartbeat,
 * and handles workspace-level presence updates.
 */
export function WorkspaceSocketSync() {
  const { workspaceId } = useWorkspaceContext();
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();

  useWorkspaceRoom(workspaceId);

  // 1. Maintain singleton 30s heartbeat interval for the active workspace
  React.useEffect(() => {
    if (!socket || !isConnected || !workspaceId) return;

    socket.emit(WsClientEvent.HEARTBEAT);

    const interval = setInterval(() => {
      socket.emit(WsClientEvent.HEARTBEAT);
    }, 30_000);

    return () => clearInterval(interval);
  }, [socket, isConnected, workspaceId]);

  // 2. Real-time presence updates via WebSocket (singleton listener)
  useSocketEvent<
    PresenceUpdatedEvent | { userId: string; status: PresenceStatus; lastSeenAt?: string }
  >(
    WsServerEvent.PRESENCE_UPDATED,
    data => {
      if (!workspaceId || !data?.userId) return;

      queryClient.setQueryData<PresenceEntry[]>(presenceKeys.list(workspaceId), (old = []) => {
        const existingIndex = old.findIndex(p => p.userId === data.userId);
        const updatedEntry: PresenceEntry = {
          userId: data.userId,
          status: data.status,
          lastSeenAt: data.lastSeenAt || new Date().toISOString(),
        };

        if (existingIndex >= 0) {
          const updated = [...old];
          updated[existingIndex] = updatedEntry;
          return updated;
        }
        return [...old, updatedEntry];
      });
    },
    [workspaceId],
  );

  return null;
}
