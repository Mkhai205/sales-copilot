'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { MessageType, SenderType, WsServerEvent } from '@sales-copilot/shared-contracts';
import type {
  ContactDto,
  ContactUpdatedEvent,
  ConversationResponseDto,
  MessageResponseDto,
  OrderCancelledEventPayload,
  OrderCompletedEventPayload,
  OrderConfirmedEventPayload,
  OrderCreatedEventPayload,
  OrderPaidEventPayload,
  OrderPartiallyPaidEventPayload,
  OrderUpdatedEventPayload,
} from '@sales-copilot/shared-contracts';
import { conversationsApi } from '@/features/conversations/api/conversations';
import type { ApiResponse } from '@/lib/api/client';
import { useBrowserNotifications } from '@/lib/hooks/use-browser-notifications';
import {
  bubbleConversationToTop,
  reconcileOrAppendMessage,
  removeMessageFromInfiniteData,
  updateConversationInList,
  updateMessageInInfiniteData,
} from './cache-helpers';
import { useSocketEvent } from './use-socket';
import { conversationKeys, commerceKeys } from '@/lib/query-keys';
/**
 * Central hook that listens to all realtime WebSocket events from the backend gateway
 * and keeps the TanStack Query caches (messages, conversation detail, conversation list) in sync.
 *
 * Cache operations are scoped to `payload.workspaceId` wherever the wire payload
 * carries it, so events from one workspace never touch another workspace's cache.
 */
export function useRealtimeSync(): void {
  const queryClient = useQueryClient();
  const router = useRouter();
  const params = useParams<{ workspaceSlug?: string; conversationId?: string }>();
  const workspaceSlug = params?.workspaceSlug;
  const currentActiveConversationId = params?.conversationId;
  const { notify } = useBrowserNotifications();

  // ==========================================================================
  // 1. Message Events
  // ==========================================================================

  // message.created
  useSocketEvent(WsServerEvent.MESSAGE_CREATED, (message: MessageResponseDto) => {
    if (!message || !message.conversationId || !message.workspaceId) return;

    const { workspaceId, conversationId } = message;
    const isCurrentActive = currentActiveConversationId === conversationId;
    const isIncoming = message.senderType === SenderType.CONTACT;

    // 1. Reconcile / append into message infinite query cache
    queryClient.setQueriesData<InfiniteData<ApiResponse<MessageResponseDto[]>>>(
      {
        queryKey: conversationKeys.messages(workspaceId, conversationId),
      },
      old => reconcileOrAppendMessage(old, message),
    );

    // SILENT READ RECEIPT / UNREAD AUTO-RESET:
    // If the agent is currently viewing THIS conversation and receives an incoming message,
    // silently call resetUnread in backend to ensure DB unreadMessagesCount stays 0.
    if (isCurrentActive && isIncoming) {
      conversationsApi.resetUnread(workspaceId, conversationId).catch(() => {});
    }

    // 2. Update and bubble conversation to top in conversation lists
    let foundInList = false;
    queryClient.setQueriesData<InfiniteData<ApiResponse<ConversationResponseDto[]>>>(
      { queryKey: conversationKeys.list(workspaceId) },
      old => {
        if (!old) return old;
        const { updatedData, found } = bubbleConversationToTop(old, conversationId, prev => {
          const isDuplicate = prev.lastMessage?.id === message.id;
          let nextUnreadCount = prev.unreadMessagesCount ?? 0;
          if (!isDuplicate) {
            if (isCurrentActive) {
              nextUnreadCount = 0;
            } else if (isIncoming) {
              nextUnreadCount = (prev.unreadMessagesCount ?? 0) + 1;
            }
          }

          return {
            ...prev,
            lastMessage: message,
            lastActivityAt: message.createdAt,
            unreadMessagesCount: nextUnreadCount,
          };
        });
        if (found) foundInList = true;
        return updatedData;
      },
    );

    // If conversation wasn't found in current list cache (e.g. newly created conversation), refetch
    if (!foundInList) {
      queryClient.invalidateQueries({ queryKey: conversationKeys.list(workspaceId) });
      queryClient.invalidateQueries({ queryKey: conversationKeys.counts(workspaceId) });
    }

    // 3. Update single conversation detail query if viewed
    queryClient.setQueriesData<ConversationResponseDto>(
      { queryKey: conversationKeys.detail(workspaceId, conversationId) },
      old => {
        if (!old) return old;
        const isDuplicate = old.lastMessage?.id === message.id;
        let nextUnreadCount = old.unreadMessagesCount ?? 0;
        if (!isDuplicate) {
          if (isCurrentActive) {
            nextUnreadCount = 0;
          } else if (isIncoming) {
            nextUnreadCount = (old.unreadMessagesCount ?? 0) + 1;
          }
        }

        return {
          ...old,
          lastMessage: message,
          lastActivityAt: message.createdAt,
          unreadMessagesCount: nextUnreadCount,
        };
      },
    );

    // 4. Trigger audio chime & browser notification for incoming messages from contacts
    const isContactMessage =
      message.messageType === MessageType.INCOMING || message.senderType === SenderType.CONTACT;

    if (isContactMessage && !message.isPrivate) {
      const senderName = message.sender?.name || 'Customer';
      const messagePreview =
        message.content ||
        (message.attachments && message.attachments.length > 0
          ? 'Sent an attachment'
          : 'New incoming message');

      notify({
        title: senderName,
        body: messagePreview,
        onClick: () => {
          if (workspaceSlug && conversationId) {
            router.push(`/${workspaceSlug}/conversations/${conversationId}`);
          }
        },
      });
    }
  });

  // message.updated
  useSocketEvent(WsServerEvent.MESSAGE_UPDATED, (message: MessageResponseDto) => {
    if (!message || !message.id || !message.workspaceId) return;

    queryClient.setQueriesData<InfiniteData<ApiResponse<MessageResponseDto[]>>>(
      {
        queryKey: conversationKeys.messages(message.workspaceId, message.conversationId),
      },
      old => updateMessageInInfiniteData(old, message),
    );

    // Also update lastMessage in conversation list if applicable
    queryClient.setQueriesData<InfiniteData<ApiResponse<ConversationResponseDto[]>>>(
      { queryKey: conversationKeys.list(message.workspaceId) },
      old =>
        updateConversationInList(old, message.conversationId, prev => {
          if (prev.lastMessage?.id === message.id) {
            return {
              ...prev,
              lastMessage: { ...prev.lastMessage, ...message },
            };
          }
          return prev;
        }),
    );
  });

  // message.deleted
  useSocketEvent(
    WsServerEvent.MESSAGE_DELETED,
    ({
      workspaceId,
      conversationId,
      messageId,
    }: {
      workspaceId: string;
      conversationId: string;
      messageId: string;
    }) => {
      if (!workspaceId || !conversationId || !messageId) return;

      queryClient.setQueriesData<InfiniteData<ApiResponse<MessageResponseDto[]>>>(
        { queryKey: conversationKeys.messages(workspaceId, conversationId) },
        old => removeMessageFromInfiniteData(old, messageId),
      );
    },
  );

  // message.delivery_status_updated
  useSocketEvent(WsServerEvent.MESSAGE_DELIVERY_STATUS_UPDATED, (message: MessageResponseDto) => {
    if (!message || !message.id || !message.workspaceId) return;

    queryClient.setQueriesData<InfiniteData<ApiResponse<MessageResponseDto[]>>>(
      {
        queryKey: conversationKeys.messages(message.workspaceId, message.conversationId),
      },
      old => updateMessageInInfiniteData(old, message),
    );
  });

  // ==========================================================================
  // 2. Conversation Events
  // ==========================================================================

  // conversation.created
  useSocketEvent(WsServerEvent.CONVERSATION_CREATED, (conversation: ConversationResponseDto) => {
    if (!conversation?.workspaceId) return;
    queryClient.invalidateQueries({ queryKey: conversationKeys.list(conversation.workspaceId) });
    queryClient.invalidateQueries({ queryKey: conversationKeys.counts(conversation.workspaceId) });
  });

  // conversation.updated
  useSocketEvent(WsServerEvent.CONVERSATION_UPDATED, (conv: ConversationResponseDto) => {
    const conversationId = conv?.id;
    if (!conversationId || !conv?.workspaceId) return;

    queryClient.setQueriesData<ConversationResponseDto>(
      { queryKey: conversationKeys.detail(conv.workspaceId, conversationId) },
      old => (old ? { ...old, ...conv } : old),
    );

    queryClient.setQueriesData<InfiniteData<ApiResponse<ConversationResponseDto[]>>>(
      { queryKey: conversationKeys.list(conv.workspaceId) },
      old =>
        updateConversationInList(old, conversationId, prev => ({
          ...prev,
          ...conv,
        })),
    );
  });

  // conversation.status_updated & conversation.status_changed & conversation.reopened
  const handleStatusUpdate = (conv: ConversationResponseDto) => {
    const conversationId = conv?.id;
    if (!conversationId || !conv?.workspaceId) return;

    // Update single conversation query
    queryClient.setQueriesData<ConversationResponseDto>(
      { queryKey: conversationKeys.detail(conv.workspaceId, conversationId) },
      old => (old ? { ...old, status: conv.status || old.status } : old),
    );

    // Update list item
    queryClient.setQueriesData<InfiniteData<ApiResponse<ConversationResponseDto[]>>>(
      { queryKey: conversationKeys.list(conv.workspaceId) },
      old =>
        updateConversationInList(old, conversationId, {
          status: conv.status,
        }),
    );

    // Invalidate conversations to preserve tab grouping (e.g. Open vs. Resolved)
    queryClient.invalidateQueries({ queryKey: conversationKeys.list(conv.workspaceId) });
    queryClient.invalidateQueries({ queryKey: conversationKeys.counts(conv.workspaceId) });
  };

  useSocketEvent(WsServerEvent.CONVERSATION_STATUS_UPDATED, handleStatusUpdate);
  useSocketEvent(WsServerEvent.CONVERSATION_STATUS_CHANGED, handleStatusUpdate);
  useSocketEvent(WsServerEvent.CONVERSATION_REOPENED, handleStatusUpdate);

  // conversation.assigned — wire sends either a ConversationResponseDto or the
  // full ConversationAssignedEvent when no conversation snapshot is available.
  useSocketEvent(WsServerEvent.CONVERSATION_ASSIGNED, payload => {
    const isEvent = 'conversationId' in payload; // event form always carries conversationId
    const conv = isEvent ? (payload.conversation ?? undefined) : payload;
    const conversationId = isEvent ? payload.conversationId : payload.id;
    const workspaceId = isEvent ? payload.workspaceId : payload.workspaceId;
    const newAssigneeId = isEvent ? payload.newAssigneeId : payload.assigneeId;
    const teamId = isEvent ? payload.teamId : payload.teamId;

    if (!conversationId || !workspaceId) return;

    queryClient.setQueriesData<ConversationResponseDto>(
      { queryKey: conversationKeys.detail(workspaceId, conversationId) },
      old =>
        old
          ? {
              ...old,
              assigneeId: newAssigneeId,
              teamId,
              ...(conv ? { ...conv } : {}),
            }
          : old,
    );

    queryClient.setQueriesData<InfiniteData<ApiResponse<ConversationResponseDto[]>>>(
      { queryKey: conversationKeys.list(workspaceId) },
      old =>
        updateConversationInList(old, conversationId, prev => ({
          ...prev,
          assigneeId: newAssigneeId,
          teamId,
          ...(conv ? { ...conv } : {}),
        })),
    );

    queryClient.invalidateQueries({ queryKey: conversationKeys.list(workspaceId) });
    queryClient.invalidateQueries({ queryKey: conversationKeys.counts(workspaceId) });
  });

  // conversation.priority_updated — wire sends the DTO or the event payload
  useSocketEvent(WsServerEvent.CONVERSATION_PRIORITY_UPDATED, payload => {
    const isEvent = 'conversationId' in payload;
    const conversationId = isEvent ? payload.conversationId : payload.id;
    const workspaceId = isEvent ? payload.workspaceId : payload.workspaceId;
    const priority = isEvent ? payload.currentPriority : payload.priority;

    if (!conversationId || !workspaceId) return;

    queryClient.setQueriesData<ConversationResponseDto>(
      { queryKey: conversationKeys.detail(workspaceId, conversationId) },
      old => (old ? { ...old, priority: priority || old.priority } : old),
    );

    queryClient.setQueriesData<InfiniteData<ApiResponse<ConversationResponseDto[]>>>(
      { queryKey: conversationKeys.list(workspaceId) },
      old =>
        updateConversationInList(old, conversationId, {
          priority,
        }),
    );
  });

  // conversation.labels_updated — wire sends the DTO or the event payload
  useSocketEvent(WsServerEvent.CONVERSATION_LABELS_UPDATED, payload => {
    const isEvent = 'conversationId' in payload;
    const conversationId = isEvent ? payload.conversationId : payload.id;
    const workspaceId = isEvent ? payload.workspaceId : payload.workspaceId;
    const labels = isEvent ? payload.labels : payload.labels;

    if (!conversationId || !workspaceId) return;

    queryClient.setQueriesData<ConversationResponseDto>(
      { queryKey: conversationKeys.detail(workspaceId, conversationId) },
      old => (old ? { ...old, labels: labels || old.labels } : old),
    );

    queryClient.setQueriesData<InfiniteData<ApiResponse<ConversationResponseDto[]>>>(
      { queryKey: conversationKeys.list(workspaceId) },
      old =>
        updateConversationInList(old, conversationId, {
          labels,
        }),
    );
  });

  // ==========================================================================
  // 3. Contact Events
  // ==========================================================================

  // contact.updated — wire sends the ContactUpdatedEvent envelope or a bare DTO
  useSocketEvent(WsServerEvent.CONTACT_UPDATED, (payload: ContactUpdatedEvent | ContactDto) => {
    const contact = 'contact' in payload ? payload.contact : payload;
    const workspaceId = 'workspaceId' in payload ? payload.workspaceId : contact?.workspaceId;

    if (!contact || !contact.id || !workspaceId) return;

    // Update contact in single conversation cache
    queryClient.setQueriesData<ConversationResponseDto>(
      { queryKey: conversationKeys.detail(workspaceId) },
      old => {
        if (!old || old.contactId !== contact.id) return old;
        return {
          ...old,
          contact: {
            ...old.contact,
            ...contact,
          },
        };
      },
    );

    // Update contact in conversation list
    queryClient.setQueriesData<InfiniteData<ApiResponse<ConversationResponseDto[]>>>(
      { queryKey: conversationKeys.list(workspaceId) },
      old => {
        if (!old || !old.pages) return old;
        return {
          ...old,
          pages: old.pages.map(page => ({
            ...page,
            data: page.data?.map(conv => {
              if (conv.contactId === contact.id) {
                return {
                  ...conv,
                  contact: { ...conv.contact, ...contact },
                };
              }
              return conv;
            }),
          })),
        };
      },
    );
  });

  // ==========================================================================
  // 4. Commerce & Orders Events (Milestone M2) — scoped to the workspace the
  // event belongs to; order/inventory payloads always carry workspaceId.
  // ==========================================================================

  const handleOrderEvent = (
    payload:
      | OrderCreatedEventPayload
      | OrderUpdatedEventPayload
      | OrderConfirmedEventPayload
      | OrderPaidEventPayload
      | OrderPartiallyPaidEventPayload
      | OrderCancelledEventPayload
      | OrderCompletedEventPayload,
  ) => {
    const { workspaceId, orderId } = payload;
    if (!workspaceId) return;

    queryClient.invalidateQueries({ queryKey: commerceKeys.orders(workspaceId) });
    if (orderId) {
      queryClient.invalidateQueries({ queryKey: commerceKeys.order(workspaceId, orderId) });
    }
    if (payload.conversationId) {
      queryClient.invalidateQueries({
        queryKey: commerceKeys.activeOrder(workspaceId, payload.conversationId),
      });
    }
  };

  useSocketEvent(WsServerEvent.ORDER_CREATED, handleOrderEvent);
  useSocketEvent(WsServerEvent.ORDER_UPDATED, handleOrderEvent);
  useSocketEvent(WsServerEvent.ORDER_CONFIRMED, handleOrderEvent);
  useSocketEvent(WsServerEvent.ORDER_PAID, handleOrderEvent);
  useSocketEvent(WsServerEvent.ORDER_PARTIALLY_PAID, handleOrderEvent);
  useSocketEvent(WsServerEvent.ORDER_CANCELLED, handleOrderEvent);
  useSocketEvent(WsServerEvent.ORDER_COMPLETED, handleOrderEvent);

  useSocketEvent(WsServerEvent.INVENTORY_UPDATED, payload => {
    const { workspaceId } = payload;
    if (!workspaceId) return;

    queryClient.invalidateQueries({ queryKey: commerceKeys.inventoryVariants(workspaceId) });
    queryClient.invalidateQueries({ queryKey: commerceKeys.inventorySummary(workspaceId) });
    queryClient.invalidateQueries({ queryKey: commerceKeys.inventoryTransactions(workspaceId) });
  });
}
