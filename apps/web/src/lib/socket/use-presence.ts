'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { PresenceStatus, type PresenceEntry } from '@sales-copilot/shared-contracts';
import { presenceApi } from '@/features/conversations/api/presence';
import { useWorkspaces } from '@/features/settings/general/hooks/use-workspaces';
import { presenceKeys } from '@/lib/query-keys';

export interface UseWorkspacePresenceOptions {
  workspaceId?: string;
  workspaceSlug?: string;
}

/**
 * Hook to retrieve and subscribe to all presence updates across a workspace.
 * Realtime updates and heartbeat are managed centrally by <WorkspaceSocketSync>.
 */
export function useWorkspacePresence(options?: UseWorkspacePresenceOptions) {
  const { workspaceId: explicitWorkspaceId, workspaceSlug } = options || {};
  const { data: workspaces } = useWorkspaces();

  // Resolve target workspace ID
  const resolvedWorkspaceId =
    explicitWorkspaceId ||
    (workspaceSlug ? workspaces?.find(w => w.slug === workspaceSlug)?.id : undefined) ||
    workspaces?.[0]?.id;

  // 1. Fetch presence list from REST API / cache
  const query = useQuery<PresenceEntry[]>({
    queryKey: presenceKeys.list(resolvedWorkspaceId),
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
 * Fine-grained hook to check presence for a specific user.
 * Uses TanStack Query's `select` option to prevent re-renders when other users' presence changes.
 */
export function useUserPresence(userId?: string | null, options?: UseWorkspacePresenceOptions) {
  const { workspaceId: explicitWorkspaceId, workspaceSlug } = options || {};
  const { data: workspaces } = useWorkspaces();

  const resolvedWorkspaceId =
    explicitWorkspaceId ||
    (workspaceSlug ? workspaces?.find(w => w.slug === workspaceSlug)?.id : undefined) ||
    workspaces?.[0]?.id;

  const query = useQuery({
    queryKey: presenceKeys.list(resolvedWorkspaceId),
    queryFn: async () => {
      if (!resolvedWorkspaceId) return [];
      const res = await presenceApi.getWorkspacePresence(resolvedWorkspaceId, {
        includeOffline: true,
      });
      return res.data;
    },
    select: React.useCallback(
      (list: PresenceEntry[]) =>
        list.find(p => p.userId === userId)?.status ?? PresenceStatus.OFFLINE,
      [userId],
    ),
    enabled: Boolean(resolvedWorkspaceId && userId),
    staleTime: 60 * 1000,
  });

  return {
    status: query.data ?? PresenceStatus.OFFLINE,
    isOnline: query.data === PresenceStatus.ONLINE,
    isLoading: query.isLoading,
  };
}
