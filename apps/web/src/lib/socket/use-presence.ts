'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { PresenceStatus, type PresenceEntry } from '@sales-copilot/shared-contracts';
import { presenceApi } from '@/features/conversations/api/presence';
import { useWorkspaceContext } from '@/providers/workspace-provider';
import { presenceKeys } from '@/lib/query-keys';

export interface UseWorkspacePresenceOptions {
  workspaceId?: string;
}

/**
 * Fine-grained hook to check presence for a specific user.
 * Uses TanStack Query's `select` option to prevent re-renders when other users' presence changes.
 */
export function useUserPresence(userId?: string | null, options?: UseWorkspacePresenceOptions) {
  const { workspaceId: explicitWorkspaceId } = options || {};
  const { workspaceId: contextWorkspaceId } = useWorkspaceContext();

  const resolvedWorkspaceId = explicitWorkspaceId || contextWorkspaceId || undefined;

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
