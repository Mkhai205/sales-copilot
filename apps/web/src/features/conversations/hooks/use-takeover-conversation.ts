'use client';

import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { conversationsApi } from '../api/conversations';
import { useWorkspaces } from '@/features/settings';
import type { ConversationResponseDto } from '@sales-copilot/shared-contracts';
import { updateConversationInList } from '@/lib/socket/cache-helpers';
import type { ApiResponse } from '@/lib/api/client';

interface UseTakeoverConversationOptions {
  workspaceSlug?: string;
  workspaceId?: string;
}

export function useTakeoverConversation(
  optionsOrWorkspaceId?: string | UseTakeoverConversationOptions,
) {
  const queryClient = useQueryClient();
  const { data: workspaces } = useWorkspaces();

  const options: UseTakeoverConversationOptions =
    typeof optionsOrWorkspaceId === 'string'
      ? { workspaceId: optionsOrWorkspaceId }
      : optionsOrWorkspaceId || {};

  return useMutation({
    mutationFn: async (arg: string | { conversationId: string; workspaceId?: string }) => {
      const conversationId = typeof arg === 'string' ? arg : arg.conversationId;
      const resolvedWorkspaceId =
        (typeof arg === 'object' && arg.workspaceId) ||
        options.workspaceId ||
        (options.workspaceSlug
          ? workspaces?.find(w => w.slug === options.workspaceSlug)?.id
          : undefined) ||
        workspaces?.[0]?.id;

      if (!resolvedWorkspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await conversationsApi.takeover(resolvedWorkspaceId, conversationId);
      return res.data;
    },
    onSuccess: (updatedConversation: ConversationResponseDto) => {
      // 1. Optimistically update single conversation detail cache
      queryClient.setQueriesData<ConversationResponseDto>(
        {
          predicate: query =>
            query.queryKey[0] === 'conversation' && query.queryKey.includes(updatedConversation.id),
        },
        old => (old ? { ...old, ...updatedConversation, isAiPaused: true } : updatedConversation),
      );

      // 2. Optimistically update conversation list caches for instantaneous UI response
      queryClient.setQueriesData<InfiniteData<ApiResponse<ConversationResponseDto[]>>>(
        { queryKey: ['conversations'] },
        old =>
          updateConversationInList(old, updatedConversation.id, prev => ({
            ...prev,
            ...updatedConversation,
            isAiPaused: true,
          })),
      );

      // 3. Invalidate lists to maintain server parity
      queryClient.invalidateQueries({
        queryKey: ['conversations'],
      });

      toast.success('Đã tiếp quản từ AI thành công');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Tiếp quản từ AI thất bại');
    },
  });
}
