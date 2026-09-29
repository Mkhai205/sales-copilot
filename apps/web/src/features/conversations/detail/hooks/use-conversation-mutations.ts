'use client';

import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { conversationsApi } from '../../api/conversations';
import { useWorkspaceContext } from '@/providers/workspace-provider';
import type { ApiResponse } from '@/lib/api/client';
import { updateConversationInList } from '@/lib/socket/cache-helpers';
import { conversationKeys } from '@/lib/query-keys';
import type {
  AssignConversationDto,
  AssignLabelsDto,
  ConversationResponseDto,
  UpdateConversationPriorityDto,
  UpdateConversationStatusDto,
} from '@sales-copilot/shared-contracts';

interface MutationHookOptions {
  workspaceSlug?: string;
  workspaceId?: string;
}

export function useUpdateConversationStatus(
  conversationId: string,
  options: MutationHookOptions = {},
) {
  const queryClient = useQueryClient();
  const { workspaceId: contextWorkspaceId } = useWorkspaceContext();
  const resolvedWorkspaceId = options.workspaceId || contextWorkspaceId || undefined;

  return useMutation({
    mutationFn: async (dto: UpdateConversationStatusDto) => {
      if (!resolvedWorkspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await conversationsApi.updateStatus(resolvedWorkspaceId, conversationId, dto);
      return res.data;
    },
    onSuccess: (updatedConversation: ConversationResponseDto) => {
      queryClient.setQueryData(
        conversationKeys.detail(resolvedWorkspaceId, conversationId),
        updatedConversation,
      );
      queryClient.invalidateQueries({
        queryKey: conversationKeys.list(resolvedWorkspaceId),
      });
      toast.success('Conversation status updated');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update conversation status');
    },
  });
}

export function useUpdateConversationPriority(
  conversationId: string,
  options: MutationHookOptions = {},
) {
  const queryClient = useQueryClient();
  const { workspaceId: contextWorkspaceId } = useWorkspaceContext();
  const resolvedWorkspaceId = options.workspaceId || contextWorkspaceId || undefined;

  return useMutation({
    mutationFn: async (dto: UpdateConversationPriorityDto) => {
      if (!resolvedWorkspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await conversationsApi.updatePriority(resolvedWorkspaceId, conversationId, dto);
      return res.data;
    },
    onSuccess: (updatedConversation: ConversationResponseDto) => {
      queryClient.setQueryData(
        conversationKeys.detail(resolvedWorkspaceId, conversationId),
        updatedConversation,
      );
      queryClient.invalidateQueries({
        queryKey: conversationKeys.list(resolvedWorkspaceId),
      });
      toast.success('Priority updated');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update priority');
    },
  });
}

export function useAssignConversation(conversationId: string, options: MutationHookOptions = {}) {
  const queryClient = useQueryClient();
  const { workspaceId: contextWorkspaceId } = useWorkspaceContext();
  const resolvedWorkspaceId = options.workspaceId || contextWorkspaceId || undefined;

  return useMutation({
    mutationFn: async (dto: AssignConversationDto) => {
      if (!resolvedWorkspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await conversationsApi.assign(resolvedWorkspaceId, conversationId, dto);
      return res.data;
    },
    onSuccess: (updatedConversation: ConversationResponseDto) => {
      queryClient.setQueryData(
        conversationKeys.detail(resolvedWorkspaceId, conversationId),
        updatedConversation,
      );
      queryClient.invalidateQueries({
        queryKey: conversationKeys.list(resolvedWorkspaceId),
      });
      toast.success('Assignment updated');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update assignment');
    },
  });
}

export function useAssignConversationLabels(
  conversationId: string,
  options: MutationHookOptions = {},
) {
  const queryClient = useQueryClient();
  const { workspaceId: contextWorkspaceId } = useWorkspaceContext();
  const resolvedWorkspaceId = options.workspaceId || contextWorkspaceId || undefined;

  return useMutation({
    mutationFn: async (dto: AssignLabelsDto) => {
      if (!resolvedWorkspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await conversationsApi.assignLabels(resolvedWorkspaceId, conversationId, dto);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: conversationKeys.detail(resolvedWorkspaceId, conversationId),
      });
      queryClient.invalidateQueries({
        queryKey: conversationKeys.list(resolvedWorkspaceId),
      });
      toast.success('Label added');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to add label');
    },
  });
}

export function useRemoveConversationLabel(
  conversationId: string,
  options: MutationHookOptions = {},
) {
  const queryClient = useQueryClient();
  const { workspaceId: contextWorkspaceId } = useWorkspaceContext();
  const resolvedWorkspaceId = options.workspaceId || contextWorkspaceId || undefined;

  return useMutation({
    mutationFn: async (labelId: string) => {
      if (!resolvedWorkspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await conversationsApi.removeLabel(resolvedWorkspaceId, conversationId, labelId);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: conversationKeys.detail(resolvedWorkspaceId, conversationId),
      });
      queryClient.invalidateQueries({
        queryKey: conversationKeys.list(resolvedWorkspaceId),
      });
      toast.success('Label removed');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to remove label');
    },
  });
}

export function useResetUnreadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workspaceId,
      conversationId,
    }: {
      workspaceId: string;
      conversationId: string;
    }) => {
      const res = await conversationsApi.resetUnread(workspaceId, conversationId);
      return res.data;
    },
    onMutate: async ({ workspaceId, conversationId }) => {
      // Optimistically zero unread count in both detail and list caches
      const previousDetail = queryClient.getQueriesData<ConversationResponseDto>({
        queryKey: conversationKeys.detail(workspaceId),
        predicate: query => query.queryKey.includes(conversationId),
      });
      const previousLists = queryClient.getQueriesData<
        InfiniteData<ApiResponse<ConversationResponseDto[]>>
      >({ queryKey: conversationKeys.list(workspaceId) });

      queryClient.setQueriesData<ConversationResponseDto>(
        {
          queryKey: conversationKeys.detail(workspaceId),
          predicate: query => query.queryKey.includes(conversationId),
        },
        old => (old ? { ...old, unreadMessagesCount: 0 } : old),
      );

      queryClient.setQueriesData<InfiniteData<ApiResponse<ConversationResponseDto[]>>>(
        { queryKey: conversationKeys.list(workspaceId) },
        old =>
          updateConversationInList(old, conversationId, prev => ({
            ...prev,
            unreadMessagesCount: 0,
          })),
      );

      return { previousDetail, previousLists };
    },
    onError: (err: any, _variables, context) => {
      console.error('Failed to reset unread count on view:', err);
      // Roll back the optimistic zeroing so the unread badge stays truthful
      context?.previousDetail.forEach(([key, data]) => queryClient.setQueryData(key, data));
      context?.previousLists.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
  });
}
