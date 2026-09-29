'use client';

import { useQuery } from '@tanstack/react-query';
import { cannedResponsesApi } from '@/features/settings/canned-responses/api/canned-responses';
import { useWorkspaceContext } from '@/providers/workspace-provider';
import type { CannedResponseDto } from '@sales-copilot/shared-contracts';
import { cannedResponseKeys } from '@/lib/query-keys';

export interface UseCannedResponsesOptions {
  workspaceId?: string;
  search?: string;
  enabled?: boolean;
}

export function useCannedResponses(options?: UseCannedResponsesOptions) {
  const { workspaceId: explicitWorkspaceId, search, enabled = true } = options || {};
  const { workspaceId: contextWorkspaceId } = useWorkspaceContext();
  const resolvedWorkspaceId = explicitWorkspaceId || contextWorkspaceId || undefined;

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
