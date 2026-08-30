'use client';

import { useQuery } from '@tanstack/react-query';
import { conversationsApi } from '@/lib/api/conversations';
import type { ConversationResponseDto } from '@/lib/api/types';
import { useWorkspaces } from '@/features/workspaces/use-workspaces';

export interface UseConversationOptions {
  conversationId?: string | null;
  workspaceSlug?: string;
  workspaceId?: string;
  enabled?: boolean;
}

/**
 * Data hook for fetching a single conversation's details
 */
export function useConversation(
  conversationIdOrOptions?: string | null | UseConversationOptions,
  extraOptions?: UseConversationOptions,
) {
  const normalizedOptions: UseConversationOptions =
    typeof conversationIdOrOptions === 'object' && conversationIdOrOptions !== null
      ? conversationIdOrOptions
      : {
          conversationId: conversationIdOrOptions,
          ...extraOptions,
        };

  const {
    conversationId,
    workspaceSlug,
    workspaceId: explicitWorkspaceId,
    enabled = true,
  } = normalizedOptions;

  const { data: workspaces } = useWorkspaces();

  // Resolve target workspace ID
  const resolvedWorkspaceId =
    explicitWorkspaceId ||
    (workspaceSlug ? workspaces?.find(w => w.slug === workspaceSlug)?.id : undefined) ||
    workspaces?.[0]?.id;

  const isQueryEnabled = Boolean(enabled && resolvedWorkspaceId && conversationId);

  const query = useQuery({
    queryKey: ['conversation', resolvedWorkspaceId, conversationId],
    queryFn: async () => {
      if (!resolvedWorkspaceId || !conversationId) {
        throw new Error('Workspace ID and Conversation ID are required');
      }
      const res = await conversationsApi.get(resolvedWorkspaceId, conversationId);
      return res.data;
    },
    enabled: isQueryEnabled,
    staleTime: 15_000,
  });

  return {
    ...query,
    conversation: query.data as ConversationResponseDto | undefined,
    workspaceId: resolvedWorkspaceId,
  };
}
