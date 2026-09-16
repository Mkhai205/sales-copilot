'use client';

import { useQuery } from '@tanstack/react-query';
import { conversationsApi } from '../api/conversations';
import type {
  ConversationStatus,
  ConversationCountsResponseDto,
} from '@sales-copilot/shared-contracts';
import { useWorkspaces } from '@/features/identity';

interface UseConversationCountsOptions {
  workspaceSlug?: string;
  workspaceId?: string;
  status?: ConversationStatus;
  enabled?: boolean;
}

export function useConversationCounts({
  workspaceSlug,
  workspaceId: explicitWorkspaceId,
  status,
  enabled = true,
}: UseConversationCountsOptions = {}) {
  const { data: workspaces } = useWorkspaces();

  const resolvedWorkspaceId =
    explicitWorkspaceId ||
    (workspaceSlug ? workspaces?.find(w => w.slug === workspaceSlug)?.id : undefined) ||
    workspaces?.[0]?.id;

  const isQueryEnabled = Boolean(enabled && resolvedWorkspaceId);

  const query = useQuery({
    queryKey: ['conversation-counts', resolvedWorkspaceId, status],
    queryFn: async () => {
      if (!resolvedWorkspaceId) {
        throw new Error('Workspace ID is required to fetch conversation counts');
      }
      const res = await conversationsApi.getCounts(resolvedWorkspaceId, status);
      return res.data as ConversationCountsResponseDto;
    },
    enabled: isQueryEnabled,
    staleTime: 10_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  return {
    ...query,
    counts: query.data,
  };
}
