'use client';

import { useQuery } from '@tanstack/react-query';
import { conversationsApi } from '../../api/conversations';
import type { ConversationResponseDto } from '@sales-copilot/shared-contracts';
import { useWorkspaceContext } from '@/providers/workspace-provider';
import { conversationKeys } from '@/lib/query-keys';

export interface UseConversationOptions {
  conversationId?: string | null;
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

  const { conversationId, workspaceId: explicitWorkspaceId, enabled = true } = normalizedOptions;

  const { workspaceId: contextWorkspaceId } = useWorkspaceContext();
  const resolvedWorkspaceId = explicitWorkspaceId || contextWorkspaceId || undefined;

  const isQueryEnabled = Boolean(enabled && resolvedWorkspaceId && conversationId);

  const query = useQuery({
    queryKey: conversationKeys.detail(resolvedWorkspaceId, conversationId ?? undefined),
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
