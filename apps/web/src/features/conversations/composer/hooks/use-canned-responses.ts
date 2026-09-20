'use client';

import { useQuery } from '@tanstack/react-query';
import { cannedResponsesApi, useWorkspaces } from '@/features/settings';
import type { CannedResponseDto } from '@sales-copilot/shared-contracts';
import { cannedResponseKeys } from '@/lib/query-keys';

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
    queryKey: cannedResponseKeys.list(resolvedWorkspaceId, search || ''),
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
