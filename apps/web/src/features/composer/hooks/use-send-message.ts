'use client';

import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ApiResponse } from '@/lib/api/client';
import { messagesApi } from '@/lib/api/messages';
import {
  DeliveryStatus,
  MessageContentType,
  MessageType,
  SenderType,
  type CreateMessageDto,
  type MessageResponseDto,
} from '@/lib/api/types';
import { useCurrentUser } from '@/features/auth/use-current-user';
import { useWorkspaces } from '@/features/workspaces/use-workspaces';

export interface UseSendMessageOptions {
  conversationId: string;
  workspaceSlug?: string;
  workspaceId?: string;
}

export interface SendMessageInput {
  content: string;
  messageType?: MessageType;
  contentType?: MessageContentType;
  isPrivate?: boolean;
  metadata?: Record<string, unknown>;
}

export function useSendMessage(options: UseSendMessageOptions) {
  const { conversationId, workspaceSlug, workspaceId: explicitWorkspaceId } = options;
  const queryClient = useQueryClient();
  const { data: workspaces } = useWorkspaces();
  const { data: currentUser } = useCurrentUser();

  // Resolve target workspace ID
  const resolvedWorkspaceId =
    explicitWorkspaceId ||
    (workspaceSlug ? workspaces?.find(w => w.slug === workspaceSlug)?.id : undefined) ||
    workspaces?.[0]?.id;

  return useMutation({
    mutationFn: async (input: SendMessageInput | CreateMessageDto) => {
      if (!resolvedWorkspaceId) {
        throw new Error('Workspace ID is required to send a message');
      }
      if (!conversationId) {
        throw new Error('Conversation ID is required to send a message');
      }

      const payload: CreateMessageDto = {
        content: input.content,
        messageType: input.messageType ?? MessageType.OUTGOING,
        contentType: input.contentType ?? MessageContentType.TEXT,
        isPrivate: input.isPrivate ?? false,
        senderType: SenderType.USER,
        senderId: currentUser?.id,
        metadata: input.metadata,
      };

      const res = await messagesApi.create(resolvedWorkspaceId, conversationId, payload);
      return res.data;
    },

    onMutate: async (input: SendMessageInput | CreateMessageDto) => {
      if (!resolvedWorkspaceId || !conversationId) return;

      const messageQueryFilter = {
        queryKey: ['messages', resolvedWorkspaceId, conversationId],
      };

      // 1. Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries(messageQueryFilter);

      // 2. Snapshot the previous queries matching the conversation
      const previousData =
        queryClient.getQueriesData<InfiniteData<ApiResponse<MessageResponseDto[]>>>(
          messageQueryFilter,
        );

      // 3. Construct optimistic message
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const optimisticMessage: MessageResponseDto = {
        id: tempId,
        conversationId,
        workspaceId: resolvedWorkspaceId,
        senderType: SenderType.USER,
        senderId: currentUser?.id,
        messageType: input.messageType ?? MessageType.OUTGOING,
        contentType: input.contentType ?? MessageContentType.TEXT,
        content: input.content,
        isPrivate: Boolean(input.isPrivate),
        deliveryStatus: DeliveryStatus.PENDING,
        createdAt: new Date().toISOString(),
        sender: currentUser
          ? {
              id: currentUser.id,
              name: currentUser.name,
              avatarUrl: currentUser.avatarUrl,
              type: SenderType.USER,
            }
          : undefined,
        attachments: [],
      };

      // 4. Optimistically append message to the last page of all matching query caches
      queryClient.setQueriesData<InfiniteData<ApiResponse<MessageResponseDto[]>>>(
        messageQueryFilter,
        oldData => {
          if (!oldData || !oldData.pages || oldData.pages.length === 0) {
            return {
              pageParams: [1],
              pages: [
                {
                  success: true,
                  data: [optimisticMessage],
                  meta: { page: 1, limit: 50, total: 1, hasMore: false },
                },
              ],
            };
          }

          const lastPageIndex = oldData.pages.length - 1;
          const lastPage = oldData.pages[lastPageIndex];

          const updatedPages = [...oldData.pages];
          updatedPages[lastPageIndex] = {
            ...lastPage,
            data: [...(lastPage.data || []), optimisticMessage],
          };

          return {
            ...oldData,
            pages: updatedPages,
          };
        },
      );

      return { previousData, tempId };
    },

    onError: (error, _variables, context) => {
      // Rollback to snapshot on error
      if (context?.previousData) {
        for (const [queryKey, data] of context.previousData) {
          queryClient.setQueryData(queryKey, data);
        }
      }

      toast.error('Failed to send message', {
        description:
          error instanceof Error ? error.message : 'Please check your connection and try again.',
      });
    },

    onSuccess: (createdMessage, _variables, context) => {
      if (!resolvedWorkspaceId || !conversationId) return;

      const messageQueryFilter = {
        queryKey: ['messages', resolvedWorkspaceId, conversationId],
      };

      // Replace optimistic message with actual created message from server
      if (context?.tempId) {
        queryClient.setQueriesData<InfiniteData<ApiResponse<MessageResponseDto[]>>>(
          messageQueryFilter,
          oldData => {
            if (!oldData) return oldData;
            return {
              ...oldData,
              pages: oldData.pages.map(page => ({
                ...page,
                data: (page.data || []).map((msg: MessageResponseDto) =>
                  msg.id === context.tempId ? createdMessage : msg,
                ),
              })),
            };
          },
        );
      }

      // Invalidate conversations list and single conversation to update lastMessage and timestamps
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
    },

    onSettled: () => {
      if (!resolvedWorkspaceId || !conversationId) return;

      // Invalidate to guarantee eventual consistency with the server
      queryClient.invalidateQueries({
        queryKey: ['messages', resolvedWorkspaceId, conversationId],
      });
    },
  });
}
