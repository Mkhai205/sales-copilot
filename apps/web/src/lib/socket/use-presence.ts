'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PresenceStatus,
  WsClientEvent,
  WsServerEvent,
  type PresenceEntry,
  type PresenceUpdatedEvent,
} from '@sales-copilot/shared-contracts';
import { presenceApi } from '@/lib/api/presence';
import { useWorkspaces } from '@/features/workspaces/use-workspaces';
import { useSocket, useSocketEvent } from './use-socket';

export interface UseWorkspacePresenceOptions {
  workspaceId?: string;
  workspaceSlug?: string;
}

/**
 * Hook to retrieve and subscribe to all presence updates across a workspace.
 * Automatically manages 30s heartbeat interval and TanStack Query cache updates.
 */
export function useWorkspacePresence(options?: UseWorkspacePresenceOptions) {
  const { workspaceId: explicitWorkspaceId, workspaceSlug } = options || {};
  const { data: workspaces } = useWorkspaces();
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();

  // Resolve target workspace ID
  const resolvedWorkspaceId =
    explicitWorkspaceId ||
    (workspaceSlug ? workspaces?.find(w => w.slug === workspaceSlug)?.id : undefined) ||
    workspaces?.[0]?.id;

  // 1. Initial fetch of presence list from REST API
  const query = useQuery<PresenceEntry[]>({
    queryKey: ['presence', resolvedWorkspaceId],
    queryFn: async () => {
      if (!resolvedWorkspaceId) return [];
      const res = await presenceApi.getWorkspacePresence(resolvedWorkspaceId, {
        includeOffline: true,
      });
      return res.data;
    },
    enabled: Boolean(resolvedWorkspaceId),
    staleTime: 60 * 1000, // 1 minute
  });

  // 2. Real-time presence updates via WebSocket
  useSocketEvent<
    PresenceUpdatedEvent | { userId: string; status: PresenceStatus; lastSeenAt?: string }
  >(
    WsServerEvent.PRESENCE_UPDATED,
    data => {
      if (!resolvedWorkspaceId || !data?.userId) return;

      queryClient.setQueryData<PresenceEntry[]>(['presence', resolvedWorkspaceId], (old = []) => {
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
    [resolvedWorkspaceId],
  );

  // 3. Periodic heartbeat every 30s to keep agent's own presence TTL alive
  React.useEffect(() => {
    if (!socket || !isConnected) return;

    // Send immediate heartbeat on connect/mount
    socket.emit(WsClientEvent.HEARTBEAT);

    const interval = setInterval(() => {
      socket.emit(WsClientEvent.HEARTBEAT);
    }, 30_000);

    return () => clearInterval(interval);
  }, [socket, isConnected]);

  // Derived presence map for O(1) status lookups
  const presenceMap = React.useMemo(() => {
    const map = new Map<string, PresenceStatus>();
    (query.data || []).forEach(entry => {
      map.set(entry.userId, entry.status);
    });
    return map;
  }, [query.data]);

  const onlineUserIds = React.useMemo(() => {
    return (query.data || [])
      .filter(entry => entry.status === PresenceStatus.ONLINE)
      .map(entry => entry.userId);
  }, [query.data]);

  const isOnline = React.useCallback(
    (userId?: string | null): boolean => {
      if (!userId) return false;
      return presenceMap.get(userId) === PresenceStatus.ONLINE;
    },
    [presenceMap],
  );

  const getStatus = React.useCallback(
    (userId?: string | null): PresenceStatus => {
      if (!userId) return PresenceStatus.OFFLINE;
      return presenceMap.get(userId) || PresenceStatus.OFFLINE;
    },
    [presenceMap],
  );

  return {
    presenceList: query.data || [],
    presenceMap,
    onlineUserIds,
    isLoading: query.isLoading,
    isOnline,
    getStatus,
  };
}

/**
 * Convenience hook to check presence for a specific user.
 */
export function useUserPresence(userId?: string | null, options?: UseWorkspacePresenceOptions) {
  const { getStatus, isOnline, isLoading } = useWorkspacePresence(options);

  return {
    status: getStatus(userId),
    isOnline: isOnline(userId),
    isLoading,
  };
}
