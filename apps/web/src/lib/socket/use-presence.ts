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
