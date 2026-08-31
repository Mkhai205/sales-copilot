'use client';

import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ApiResponse } from '@/lib/api/client';
import { messagesApi } from '@/lib/api/messages';
import {
  DeliveryStatus,
  FileType,
  MessageContentType,
  MessageType,
  SenderType,
  type AttachmentDto,
  type CreateMessageDto,
  type MessageResponseDto,
} from '@/lib/api/types';
import { useCurrentUser } from '@/features/auth/use-current-user';
import { useWorkspaces } from '@/features/workspaces/use-workspaces';
import {
  bubbleConversationToTop,
  markMessageFailedInInfiniteData,
  reconcileOrAppendMessage,
} from '@/lib/socket';

export interface UseSendMessageOptions {
  conversationId: string;
  workspaceSlug?: string;
  workspaceId?: string;
}

export interface SendMessageInput {
  content?: string;
  attachments?: File[];
  messageType?: MessageType;
  contentType?: MessageContentType;
  isPrivate?: boolean;
  metadata?: Record<string, unknown>;
  clientTempId?: string;
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
    mutationFn: async (input: SendMessageInput) => {
      if (!resolvedWorkspaceId) {
        throw new Error('Workspace ID is required to send a message');
      }
      if (!conversationId) {
        throw new Error('Conversation ID is required to send a message');
      }

      const clientTempId =
        input.clientTempId || `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const enrichedMetadata = {
        ...(input.metadata || {}),
        clientTempId,
      };

      let payload: CreateMessageDto | FormData;

      if (input.attachments && input.attachments.length > 0) {
        const formData = new FormData();
        if (input.content) {
          formData.append('content', input.content);
        }
        formData.append('isPrivate', String(Boolean(input.isPrivate)));
        formData.append('messageType', input.messageType ?? MessageType.OUTGOING);
        formData.append('senderType', SenderType.USER);
        if (currentUser?.id) {
          formData.append('senderId', currentUser.id);
        }
        if (input.contentType) {
          formData.append('contentType', input.contentType);
        }
        formData.append('metadata', JSON.stringify(enrichedMetadata));
        input.attachments.forEach(file => {
          formData.append('attachments', file);
        });
        payload = formData;
      } else {
        payload = {
          content: input.content || '',
          messageType: input.messageType ?? MessageType.OUTGOING,
          contentType: input.contentType ?? MessageContentType.TEXT,
          isPrivate: input.isPrivate ?? false,
          senderType: SenderType.USER,
          senderId: currentUser?.id,
          metadata: enrichedMetadata,
        };
      }

      const res = await messagesApi.create(resolvedWorkspaceId, conversationId, payload);
      return {
        createdMessage: res.data,
        clientTempId,
      };
    },

    onMutate: async (input: SendMessageInput) => {
      if (!resolvedWorkspaceId || !conversationId) return;

      const messageQueryFilter = {
        queryKey: ['messages', resolvedWorkspaceId, conversationId],
      };

      // 1. Cancel any outgoing refetches
      await queryClient.cancelQueries(messageQueryFilter);

      // 2. Snapshot previous data
      const previousData =
        queryClient.getQueriesData<InfiniteData<ApiResponse<MessageResponseDto[]>>>(
          messageQueryFilter,
        );

      // 3. Construct optimistic message
      const tempId =
        input.clientTempId || `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      const optimisticAttachments: AttachmentDto[] = (input.attachments || []).map((file, idx) => {
        const isImage = file.type.startsWith('image/');
        return {
          id: `temp-att-${Date.now()}-${idx}`,
          messageId: tempId,
          fileType: isImage ? FileType.IMAGE : FileType.FILE,
          fileName: file.name,
          fileSize: file.size,
          storagePath: '',
          contentType: file.type,
          fileUrl: isImage ? URL.createObjectURL(file) : undefined,
          createdAt: new Date().toISOString(),
        };
      });

      const isAllImages =
        input.attachments &&
        input.attachments.length > 0 &&
        input.attachments.every(f => f.type.startsWith('image/'));

      const optimisticContentType =
        input.contentType ??
        (input.attachments && input.attachments.length > 0
          ? isAllImages
            ? MessageContentType.IMAGE
            : MessageContentType.FILE
          : MessageContentType.TEXT);

      const optimisticMessage: MessageResponseDto = {
        id: tempId,
        conversationId,
        workspaceId: resolvedWorkspaceId,
        senderType: SenderType.USER,
        senderId: currentUser?.id,
        messageType: input.messageType ?? MessageType.OUTGOING,
        contentType: optimisticContentType,
        content: input.content || null,
        isPrivate: Boolean(input.isPrivate),
        deliveryStatus: DeliveryStatus.PENDING,
        createdAt: new Date().toISOString(),
        metadata: {
          ...(input.metadata || {}),
          clientTempId: tempId,
        },
        sender: currentUser
          ? {
              id: currentUser.id,
              name: currentUser.name,
              avatarUrl: currentUser.avatarUrl,
              type: SenderType.USER,
            }
          : undefined,
        attachments: optimisticAttachments,
      };

      // 4. Optimistically append message to cache
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

          const firstPage = oldData.pages[0];
          const updatedPages = [...oldData.pages];
          updatedPages[0] = {
            ...firstPage,
            data: [...(firstPage.data || []), optimisticMessage],
          };

          return {
            ...oldData,
            pages: updatedPages,
          };
        },
      );

      // 5. Update conversation list with optimistic lastMessage
      queryClient.setQueriesData<InfiniteData<ApiResponse<any[]>>>(
        { queryKey: ['conversations'] },
        old => {
          if (!old) return old;
          const { updatedData } = bubbleConversationToTop(old, conversationId, {
            lastMessage: optimisticMessage,
            lastActivityAt: optimisticMessage.createdAt,
          });
          return updatedData;
        },
      );

      return { previousData, tempId };
    },

    onError: (error, _variables, context) => {
      if (!resolvedWorkspaceId || !conversationId) return;

      // Mark the optimistic message as FAILED rather than silently removing it
      if (context?.tempId) {
        queryClient.setQueriesData<InfiniteData<ApiResponse<MessageResponseDto[]>>>(
          { queryKey: ['messages', resolvedWorkspaceId, conversationId] },
          old => markMessageFailedInInfiniteData(old, context.tempId),
        );
      }

      toast.error('Failed to send message', {
        description:
          error instanceof Error ? error.message : 'Please check your connection and try again.',
      });
    },

    onSuccess: result => {
      if (!resolvedWorkspaceId || !conversationId || !result) return;

      const { createdMessage, clientTempId } = result;

      // Ensure server message has clientTempId for guaranteed reconciliation
      const enrichedCreatedMessage: MessageResponseDto = {
        ...createdMessage,
        metadata: {
          ...((createdMessage.metadata as Record<string, unknown>) || {}),
          clientTempId,
        },
      };

      const messageQueryFilter = {
        queryKey: ['messages', resolvedWorkspaceId, conversationId],
      };

      // Reconcile optimistic message with actual created message from server
      queryClient.setQueriesData<InfiniteData<ApiResponse<MessageResponseDto[]>>>(
        messageQueryFilter,
        oldData => reconcileOrAppendMessage(oldData, enrichedCreatedMessage),
      );

      // Update conversation in list
      queryClient.setQueriesData<InfiniteData<ApiResponse<any[]>>>(
        { queryKey: ['conversations'] },
        old => {
          if (!old) return old;
          const { updatedData } = bubbleConversationToTop(old, conversationId, {
            lastMessage: enrichedCreatedMessage,
            lastActivityAt: enrichedCreatedMessage.createdAt,
          });
          return updatedData;
        },
      );
    },
  });
}
