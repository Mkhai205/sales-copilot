'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { WsServerEvent } from '@sales-copilot/shared-contracts';
import { toast } from 'sonner';
import type { ApiResponse } from '@/lib/api/client';
import {
  MessageType,
  SenderType,
  type ContactDto,
  type ConversationResponseDto,
  type MessageResponseDto,
} from '@/lib/api/types';
import { useBrowserNotifications } from '@/lib/hooks';
import {
  bubbleConversationToTop,
  reconcileOrAppendMessage,
  removeMessageFromInfiniteData,
  updateConversationInList,
  updateMessageInInfiniteData,
} from './cache-helpers';
import { useSocketEvent } from './use-socket';

/**
 * Central hook that listens to all realtime WebSocket events from the backend gateway
 * and keeps the TanStack Query caches (messages, conversation detail, conversation list) in sync.
 */
export function useRealtimeSync(): void {
  const queryClient = useQueryClient();
  const router = useRouter();
  const params = useParams<{ workspaceSlug?: string }>();
  const workspaceSlug = params?.workspaceSlug;
  const { notify } = useBrowserNotifications();

  // ==========================================================================
  // 1. Message Events
  // ==========================================================================

  // message.created
  useSocketEvent<MessageResponseDto | { message: MessageResponseDto }>(
    WsServerEvent.MESSAGE_CREATED,
    payload => {
      const message =
        payload && typeof payload === 'object' && 'message' in payload
          ? payload.message
          : (payload as MessageResponseDto);

      if (!message || !message.conversationId) return;

      // 1. Reconcile or append message to the message query cache for this conversation
      queryClient.setQueriesData<InfiniteData<ApiResponse<MessageResponseDto[]>>>(
        {
          predicate: query =>
            query.queryKey[0] === 'messages' && query.queryKey.includes(message.conversationId),
        },
        old => reconcileOrAppendMessage(old, message),
      );

      // 2. Update and bubble conversation to top in conversation lists
      let foundInList = false;
      queryClient.setQueriesData<InfiniteData<ApiResponse<ConversationResponseDto[]>>>(
        { queryKey: ['conversations'] },
        old => {
          if (!old) return old;
          const { updatedData, found } = bubbleConversationToTop(
            old,
            message.conversationId,
            prev => ({
              ...prev,
              lastMessage: message,
              lastActivityAt: message.createdAt,
              unreadMessagesCount:
                message.messageType === MessageType.INCOMING
                  ? (prev.unreadMessagesCount ?? 0) + 1
                  : prev.unreadMessagesCount,
            }),
          );
          if (found) foundInList = true;
          return updatedData;
        },
      );

      // If conversation wasn't found in current list cache (e.g. newly created conversation), refetch
      if (!foundInList) {
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      }

      // 3. Update single conversation detail query if viewed
      queryClient.setQueriesData<ConversationResponseDto>(
        {
          predicate: query =>
            query.queryKey[0] === 'conversation' && query.queryKey.includes(message.conversationId),
        },
        old => {
          if (!old) return old;
          return {
            ...old,
            lastMessage: message,
            lastActivityAt: message.createdAt,
            unreadMessagesCount:
              message.messageType === MessageType.INCOMING
                ? (old.unreadMessagesCount ?? 0) + 1
                : old.unreadMessagesCount,
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
            if (workspaceSlug && message.conversationId) {
              router.push(`/${workspaceSlug}/conversations/${message.conversationId}`);
            }
          },
        });
      }
    },
  );

  // message.updated
  useSocketEvent<MessageResponseDto | { message: MessageResponseDto }>(
    WsServerEvent.MESSAGE_UPDATED,
    payload => {
      const message =
        payload && typeof payload === 'object' && 'message' in payload
          ? payload.message
          : (payload as MessageResponseDto);

      if (!message || !message.id) return;

      queryClient.setQueriesData<InfiniteData<ApiResponse<MessageResponseDto[]>>>(
        {
          predicate: query =>
            query.queryKey[0] === 'messages' && query.queryKey.includes(message.conversationId),
        },
        old => updateMessageInInfiniteData(old, message),
      );

      // Also update lastMessage in conversation list if applicable
      queryClient.setQueriesData<InfiniteData<ApiResponse<ConversationResponseDto[]>>>(
        { queryKey: ['conversations'] },
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
    },
  );

  // message.deleted
  useSocketEvent<{ conversationId: string; messageId: string }>(
    WsServerEvent.MESSAGE_DELETED,
    payload => {
      if (!payload || !payload.conversationId || !payload.messageId) return;

      queryClient.setQueriesData<InfiniteData<ApiResponse<MessageResponseDto[]>>>(
        {
          predicate: query =>
            query.queryKey[0] === 'messages' && query.queryKey.includes(payload.conversationId),
        },
        old => removeMessageFromInfiniteData(old, payload.messageId),
      );
    },
  );

  // message.delivery_status_updated
  useSocketEvent<MessageResponseDto | { message: MessageResponseDto }>(
    WsServerEvent.MESSAGE_DELIVERY_STATUS_UPDATED,
    payload => {
      const message =
        payload && typeof payload === 'object' && 'message' in payload
          ? payload.message
          : (payload as MessageResponseDto);

      if (!message || !message.id) return;

      queryClient.setQueriesData<InfiniteData<ApiResponse<MessageResponseDto[]>>>(
        {
          predicate: query =>
            query.queryKey[0] === 'messages' && query.queryKey.includes(message.conversationId),
        },
        old => updateMessageInInfiniteData(old, message),
      );
    },
  );

  // ==========================================================================
  // 2. Conversation Events
  // ==========================================================================

  // conversation.created
  useSocketEvent<ConversationResponseDto | { conversation: ConversationResponseDto }>(
    WsServerEvent.CONVERSATION_CREATED,
    () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  );

  // conversation.status_updated & conversation.status_changed
  const handleStatusUpdate = (payload: any) => {
    const conv = payload?.conversation || payload;
    const conversationId = conv?.id || conv?.conversationId;
    const newStatus = conv?.status || conv?.currentStatus;

    if (!conversationId) return;

    // Update single conversation query
    queryClient.setQueriesData<ConversationResponseDto>(
      {
        predicate: query =>
          query.queryKey[0] === 'conversation' && query.queryKey.includes(conversationId),
      },
      old => (old ? { ...old, status: newStatus || old.status } : old),
    );

    // Update list item
    queryClient.setQueriesData<InfiniteData<ApiResponse<ConversationResponseDto[]>>>(
      { queryKey: ['conversations'] },
      old =>
        updateConversationInList(old, conversationId, {
          status: newStatus,
        }),
    );

    // Invalidate conversations to preserve tab grouping (e.g. Open vs. Resolved)
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  };

  useSocketEvent(WsServerEvent.CONVERSATION_STATUS_UPDATED, handleStatusUpdate);
  useSocketEvent(WsServerEvent.CONVERSATION_STATUS_CHANGED, handleStatusUpdate);
  useSocketEvent(WsServerEvent.CONVERSATION_REOPENED, handleStatusUpdate);

  // conversation.assigned
  useSocketEvent<any>(WsServerEvent.CONVERSATION_ASSIGNED, payload => {
    const conv = payload?.conversation || payload;
    const conversationId = conv?.id || payload?.conversationId;
    const newAssigneeId = payload?.newAssigneeId ?? conv?.assigneeId;
    const teamId = payload?.teamId ?? conv?.teamId;

    if (!conversationId) return;

    queryClient.setQueriesData<ConversationResponseDto>(
      {
        predicate: query =>
          query.queryKey[0] === 'conversation' && query.queryKey.includes(conversationId),
      },
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
      { queryKey: ['conversations'] },
      old =>
        updateConversationInList(old, conversationId, prev => ({
          ...prev,
          assigneeId: newAssigneeId,
          teamId,
          ...(conv ? { ...conv } : {}),
        })),
    );

    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  });

  // conversation.priority_updated
  useSocketEvent<any>(WsServerEvent.CONVERSATION_PRIORITY_UPDATED, payload => {
    const conv = payload?.conversation || payload;
    const conversationId = conv?.id || payload?.conversationId;
    const priority = payload?.priority || conv?.priority;

    if (!conversationId) return;

    queryClient.setQueriesData<ConversationResponseDto>(
      {
        predicate: query =>
          query.queryKey[0] === 'conversation' && query.queryKey.includes(conversationId),
      },
      old => (old ? { ...old, priority: priority || old.priority } : old),
    );

    queryClient.setQueriesData<InfiniteData<ApiResponse<ConversationResponseDto[]>>>(
      { queryKey: ['conversations'] },
      old =>
        updateConversationInList(old, conversationId, {
          priority,
        }),
    );
  });

  // conversation.labels_updated
  useSocketEvent<any>(WsServerEvent.CONVERSATION_LABELS_UPDATED, payload => {
    const conv = payload?.conversation || payload;
    const conversationId = conv?.id || payload?.conversationId;
    const labels = payload?.labels || conv?.labels;

    if (!conversationId) return;

    queryClient.setQueriesData<ConversationResponseDto>(
      {
        predicate: query =>
          query.queryKey[0] === 'conversation' && query.queryKey.includes(conversationId),
      },
      old => (old ? { ...old, labels: labels || old.labels } : old),
    );

    queryClient.setQueriesData<InfiniteData<ApiResponse<ConversationResponseDto[]>>>(
      { queryKey: ['conversations'] },
      old =>
        updateConversationInList(old, conversationId, {
          labels,
        }),
    );
  });

  // ==========================================================================
  // 3. Contact Events
  // ==========================================================================

  // contact.updated
  useSocketEvent<ContactDto | { contact: ContactDto }>(WsServerEvent.CONTACT_UPDATED, payload => {
    const contact =
      payload && typeof payload === 'object' && 'contact' in payload
        ? payload.contact
        : (payload as ContactDto);

    if (!contact || !contact.id) return;

    // Update contact in single conversation cache
    queryClient.setQueriesData<ConversationResponseDto>({ queryKey: ['conversation'] }, old => {
      if (!old || old.contactId !== contact.id) return old;
      return {
        ...old,
        contact: {
          ...old.contact,
          ...contact,
        },
      };
    });

    // Update contact in conversation list
    queryClient.setQueriesData<InfiniteData<ApiResponse<ConversationResponseDto[]>>>(
      { queryKey: ['conversations'] },
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
  // 4. Sales Evidence & Conversation Intelligence Events (Epic 2.4)
  // ==========================================================================

  // sales_evidence.detected
  useSocketEvent<any>(WsServerEvent.SALES_EVIDENCE_DETECTED, payload => {
    const evidence = payload?.evidence || payload;
    const conversationId = payload?.conversationId || evidence?.conversationId;
    const leadId = payload?.leadId || evidence?.leadId;

    if (conversationId) {
      queryClient.invalidateQueries({
        queryKey: ['sales-evidence', conversationId],
      });
      queryClient.invalidateQueries({
        queryKey: ['sales-evidence'],
      });
    }

    if (leadId) {
      queryClient.invalidateQueries({
        queryKey: ['lead-evidence', leadId],
      });
      queryClient.invalidateQueries({
        queryKey: ['lead', leadId],
      });
    }

    const confidence = Number(evidence?.confidence ?? 0);
    if (confidence >= 0.85 && evidence?.signalType) {
      toast.info(`Phát hiện tín hiệu mua hàng: ${evidence.signalType}`, {
        description: evidence.snippet ? `"${evidence.snippet}"` : undefined,
      });
    }
  });

  // lead_score.updated
  useSocketEvent<any>(WsServerEvent.LEAD_SCORE_UPDATED, payload => {
    const leadId = payload?.leadId;
    if (leadId) {
      queryClient.invalidateQueries({
        queryKey: ['lead-score'],
      });
      queryClient.invalidateQueries({
        queryKey: ['lead-score-history'],
      });
      queryClient.invalidateQueries({
        queryKey: ['lead', leadId],
      });
    }
    queryClient.invalidateQueries({
      queryKey: ['contact-lead'],
    });
    queryClient.invalidateQueries({
      queryKey: ['leads'],
    });
  });

  // lead.updated
  useSocketEvent<any>(WsServerEvent.LEAD_UPDATED, payload => {
    const leadId = payload?.leadId || payload?.id;
    if (leadId) {
      queryClient.invalidateQueries({
        queryKey: ['lead', leadId],
      });
    }
    queryClient.invalidateQueries({
      queryKey: ['contact-lead'],
    });
    queryClient.invalidateQueries({
      queryKey: ['leads'],
    });
  });

  // conversation.urgent_alert
  useSocketEvent<any>(WsServerEvent.CONVERSATION_URGENT_ALERT, payload => {
    const conversationId = payload?.conversationId;
    if (conversationId) {
      queryClient.invalidateQueries({
        queryKey: ['conversation', conversationId],
      });
    }
    queryClient.invalidateQueries({
      queryKey: ['conversations'],
    });

    toast.error('Cảnh báo khách hàng khẩn cấp', {
      description: payload?.snippet || payload?.reasoning || 'Cần phản hồi ngay lập tức',
    });
  });

  // conversation.intelligence_analyzed
  useSocketEvent<any>(WsServerEvent.CONVERSATION_INTELLIGENCE_ANALYZED, payload => {
    const conversationId = payload?.conversationId;
    if (conversationId) {
      queryClient.invalidateQueries({
        queryKey: ['conversation', conversationId],
      });
      queryClient.invalidateQueries({
        queryKey: ['conversation-intelligence', conversationId],
      });
    }
  });

  // copilot.suggestion_generated
  useSocketEvent<any>(WsServerEvent.COPILOT_SUGGESTION_GENERATED, payload => {
    const data = payload?.data || payload;
    const conversationId = data?.conversationId;
    if (conversationId) {
      queryClient.invalidateQueries({
        queryKey: ['copilot-suggestions', conversationId],
      });
      queryClient.invalidateQueries({
        queryKey: ['copilot-suggestions'],
      });
    }

    if (data?.title) {
      toast.info('Gợi ý Sales Copilot mới', {
        description: data.title,
      });
    }
  });

  // copilot.suggestion_acted
  useSocketEvent<any>(WsServerEvent.COPILOT_SUGGESTION_ACTED, payload => {
    const data = payload?.data || payload;
    const conversationId = data?.conversationId;
    if (conversationId) {
      queryClient.invalidateQueries({
        queryKey: ['copilot-suggestions', conversationId],
      });
    }
  });

  // ==========================================================================
  // 5. POS & Orders Events (Milestone M2)
  // ==========================================================================

  const handleOrderEvent = (payload: any) => {
    const order = payload?.order || payload;
    const conversationId = order?.conversationId;
    const contactId = order?.contactId;

    queryClient.invalidateQueries({ queryKey: ['pos-orders'] });
    queryClient.invalidateQueries({ queryKey: ['active-conversation-order'] });
    if (conversationId) {
      queryClient.invalidateQueries({
        queryKey: ['active-conversation-order', conversationId],
      });
    }
    if (contactId) {
      queryClient.invalidateQueries({
        queryKey: ['active-conversation-order', contactId],
      });
    }
  };

  useSocketEvent(WsServerEvent.ORDER_CREATED, handleOrderEvent);
  useSocketEvent(WsServerEvent.ORDER_UPDATED, handleOrderEvent);
  useSocketEvent(WsServerEvent.ORDER_CONFIRMED, handleOrderEvent);
  useSocketEvent(WsServerEvent.ORDER_PAID, handleOrderEvent);
  useSocketEvent(WsServerEvent.ORDER_PARTIALLY_PAID, handleOrderEvent);
  useSocketEvent(WsServerEvent.ORDER_CANCELLED, handleOrderEvent);

  useSocketEvent(WsServerEvent.INVENTORY_UPDATED, () => {
    queryClient.invalidateQueries({ queryKey: ['pos-products'] });
  });
}
