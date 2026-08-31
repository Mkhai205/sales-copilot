import type { InfiniteData } from '@tanstack/react-query';
import type { ApiResponse } from '../api/client';
import {
  DeliveryStatus,
  type ConversationResponseDto,
  type MessageResponseDto,
} from '../api/types';

/**
 * Appends a new message to the paginated message query cache.
 * Prevents duplicate insertion if message ID already exists.
 */
export function appendMessageToInfiniteData(
  oldData: InfiniteData<ApiResponse<MessageResponseDto[]>> | undefined,
  newMessage: MessageResponseDto,
): InfiniteData<ApiResponse<MessageResponseDto[]>> | undefined {
  if (!oldData || !oldData.pages || oldData.pages.length === 0) {
    return oldData;
  }

  // Check for duplicate message across all pages
  const exists = oldData.pages.some(page => page.data?.some(msg => msg.id === newMessage.id));
  if (exists) {
    return oldData;
  }

  const newPages = oldData.pages.map((page, index) => {
    if (index === 0) {
      return {
        ...page,
        data: [...(page.data || []), newMessage],
        meta: page.meta
          ? {
              ...page.meta,
              total: (page.meta.total ?? page.data?.length ?? 0) + 1,
            }
          : undefined,
      };
    }
    return page;
  });

  return {
    ...oldData,
    pages: newPages,
  };
}

/**
 * Reconciles an incoming server message with existing optimistic messages in query cache,
 * or appends it as a new message if no match exists.
 *
 * Checks in order:
 * 1. Exact server ID match (already present / updated from server) -> update in place.
 * 2. Client temporary ID match (matches incomingMessage.metadata?.clientTempId or msg.id === incomingMessage.metadata?.clientTempId) -> replace in place.
 * 3. Heuristic match for pending temp messages (starts with 'temp-') -> replace in place.
 * 4. Otherwise -> append as new message.
 */
export function reconcileOrAppendMessage(
  oldData: InfiniteData<ApiResponse<MessageResponseDto[]>> | undefined,
  incomingMessage: MessageResponseDto,
): InfiniteData<ApiResponse<MessageResponseDto[]>> | undefined {
  if (!oldData || !oldData.pages || oldData.pages.length === 0) {
    return oldData;
  }

  const clientTempId = (incomingMessage.metadata as { clientTempId?: string } | undefined)
    ?.clientTempId;

  let reconciled = false;

  const newPages = oldData.pages.map(page => {
    if (!page.data || page.data.length === 0) return page;

    let pageModified = false;
    const newData = page.data.map(msg => {
      // 1. Exact server ID match
      if (msg.id === incomingMessage.id) {
        reconciled = true;
        pageModified = true;
        return { ...msg, ...incomingMessage };
      }

      // 2. Client tempId match via metadata or msg.id
      if (
        clientTempId &&
        (msg.id === clientTempId ||
          (msg.metadata as { clientTempId?: string } | undefined)?.clientTempId === clientTempId)
      ) {
        reconciled = true;
        pageModified = true;
        return incomingMessage;
      }

      // 3. Heuristic match for pending temp message from same sender & content
      if (
        msg.id.startsWith('temp-') &&
        msg.senderId === incomingMessage.senderId &&
        msg.content === incomingMessage.content &&
        msg.deliveryStatus === DeliveryStatus.PENDING
      ) {
        reconciled = true;
        pageModified = true;
        return incomingMessage;
      }

      return msg;
    });

    return pageModified ? { ...page, data: newData } : page;
  });

  if (reconciled) {
    return {
      ...oldData,
      pages: newPages,
    };
  }

  // 4. No match found -> append to thread
  return appendMessageToInfiniteData(oldData, incomingMessage);
}

/**
 * Updates an existing message in the paginated message query cache.
 */
export function updateMessageInInfiniteData(
  oldData: InfiniteData<ApiResponse<MessageResponseDto[]>> | undefined,
  updatedMessage: Partial<MessageResponseDto> & { id: string },
): InfiniteData<ApiResponse<MessageResponseDto[]>> | undefined {
  if (!oldData || !oldData.pages) {
    return oldData;
  }

  let found = false;
  const newPages = oldData.pages.map(page => {
    if (!page.data) return page;

    const msgIndex = page.data.findIndex(m => m.id === updatedMessage.id);
    if (msgIndex === -1) return page;

    found = true;
    const newData = [...page.data];
    newData[msgIndex] = {
      ...newData[msgIndex],
      ...updatedMessage,
    };

    return {
      ...page,
      data: newData,
    };
  });

  return found ? { ...oldData, pages: newPages } : oldData;
}

/**
 * Marks an optimistic message as FAILED by its temporary ID.
 */
export function markMessageFailedInInfiniteData(
  oldData: InfiniteData<ApiResponse<MessageResponseDto[]>> | undefined,
  tempId: string,
): InfiniteData<ApiResponse<MessageResponseDto[]>> | undefined {
  if (!oldData || !oldData.pages) {
    return oldData;
  }

  return updateMessageInInfiniteData(oldData, {
    id: tempId,
    deliveryStatus: DeliveryStatus.FAILED,
  });
}

/**
 * Removes a message from the paginated message query cache by ID.
 */
export function removeMessageFromInfiniteData(
  oldData: InfiniteData<ApiResponse<MessageResponseDto[]>> | undefined,
  messageId: string,
): InfiniteData<ApiResponse<MessageResponseDto[]>> | undefined {
  if (!oldData || !oldData.pages) {
    return oldData;
  }

  let removed = false;
  const newPages = oldData.pages.map(page => {
    if (!page.data) return page;

    const filteredData = page.data.filter(m => m.id !== messageId);
    if (filteredData.length !== page.data.length) {
      removed = true;
      return {
        ...page,
        data: filteredData,
        meta: page.meta
          ? {
              ...page.meta,
              total: Math.max(0, (page.meta.total ?? page.data.length) - 1),
            }
          : undefined,
      };
    }
    return page;
  });

  return removed ? { ...oldData, pages: newPages } : oldData;
}

/**
 * Updates an existing conversation inside the paginated conversation list query cache.
 */
export function updateConversationInList(
  oldData: InfiniteData<ApiResponse<ConversationResponseDto[]>> | undefined,
  conversationId: string,
  updater:
    Partial<ConversationResponseDto> | ((prev: ConversationResponseDto) => ConversationResponseDto),
): InfiniteData<ApiResponse<ConversationResponseDto[]>> | undefined {
  if (!oldData || !oldData.pages) {
    return oldData;
  }

  let found = false;
  const newPages = oldData.pages.map(page => {
    if (!page.data) return page;

    const convIndex = page.data.findIndex(c => c.id === conversationId);
    if (convIndex === -1) return page;

    found = true;
    const newData = [...page.data];
    const prevConv = newData[convIndex];
    newData[convIndex] =
      typeof updater === 'function' ? updater(prevConv) : { ...prevConv, ...updater };

    return {
      ...page,
      data: newData,
    };
  });

  return found ? { ...oldData, pages: newPages } : oldData;
}

/**
 * Updates a conversation and relocates it to the top (index 0 of page 0) of the conversation list.
 * If the conversation does not exist in the list, returns unchanged (the caller should invalidate).
 */
export function bubbleConversationToTop(
  oldData: InfiniteData<ApiResponse<ConversationResponseDto[]>> | undefined,
  conversationId: string,
  updater:
    Partial<ConversationResponseDto> | ((prev: ConversationResponseDto) => ConversationResponseDto),
): {
  updatedData: InfiniteData<ApiResponse<ConversationResponseDto[]>> | undefined;
  found: boolean;
} {
  if (!oldData || !oldData.pages || oldData.pages.length === 0) {
    return { updatedData: oldData, found: false };
  }

  let matchedConversation: ConversationResponseDto | null = null;

  // 1. Find and remove conversation from its current page
  const pagesWithoutConv = oldData.pages.map(page => {
    if (!page.data) return page;
    const item = page.data.find(c => c.id === conversationId);
    if (item) {
      matchedConversation = item;
      return {
        ...page,
        data: page.data.filter(c => c.id !== conversationId),
      };
    }
    return page;
  });

  if (!matchedConversation) {
    return { updatedData: oldData, found: false };
  }

  const targetConv: ConversationResponseDto = matchedConversation;

  // 2. Apply updates to the conversation
  const updatedConv: ConversationResponseDto =
    typeof updater === 'function' ? updater(targetConv) : { ...targetConv, ...updater };

  // 3. Prepend to page 0
  const finalPages = pagesWithoutConv.map((page, index) => {
    if (index === 0) {
      return {
        ...page,
        data: [updatedConv, ...(page.data || [])],
      };
    }
    return page;
  });

  return {
    updatedData: {
      ...oldData,
      pages: finalPages,
    },
    found: true,
  };
}
