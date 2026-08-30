'use client';

import { useQuery } from '@tanstack/react-query';
import { cannedResponsesApi } from '@/lib/api/canned-responses';
import type { CannedResponseDto } from '@/lib/api/types';
import { useWorkspaces } from '@/features/workspaces/use-workspaces';

export interface UseCannedResponsesOptions {
  workspaceId?: string;
  workspaceSlug?: string;
  search?: string;
  enabled?: boolean;
}

export function useCannedResponses(options?: UseCannedResponsesOptions) {
  const { workspaceId: explicitWorkspaceId, workspaceSlug, search, enabled = true } = options || {};
  const { data: workspaces } = useWorkspaces();

  // Resolve target workspace ID
  const resolvedWorkspaceId =
    explicitWorkspaceId ||
    (workspaceSlug ? workspaces?.find(w => w.slug === workspaceSlug)?.id : undefined) ||
    workspaces?.[0]?.id;

  const isQueryEnabled = Boolean(enabled && resolvedWorkspaceId);

  return useQuery<CannedResponseDto[]>({
    queryKey: ['canned-responses', resolvedWorkspaceId, search || ''],
    queryFn: async () => {
      if (!resolvedWorkspaceId) {
        throw new Error('Workspace ID is required to fetch canned responses');
      }
      const res = await cannedResponsesApi.list(resolvedWorkspaceId, {
        search: search || undefined,
      });
      return res.data;
    },
    enabled: isQueryEnabled,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });
}
