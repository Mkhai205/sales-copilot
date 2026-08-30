'use client';

import * as React from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { format, isToday, isYesterday, isThisYear, parseISO, isValid } from 'date-fns';
import { messagesApi } from '@/lib/api/messages';
import type { MessageResponseDto } from '@/lib/api/types';
import { useWorkspaces } from '@/features/workspaces/use-workspaces';

export interface UseMessagesOptions {
  conversationId?: string | null;
  workspaceSlug?: string;
  workspaceId?: string;
  limit?: number;
  enabled?: boolean;
}

export interface MessageDateGroup {
  dateKey: string;
  dateLabel: string;
  messages: MessageResponseDto[];
}

/**
 * Formats a date or ISO string into human-friendly relative date labels ('Today', 'Yesterday', 'MMM d', or 'MMM d, yyyy')
 */
export function formatMessageDateLabel(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput;
  if (!isValid(date)) return '';
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (isThisYear(date)) return format(date, 'MMM d');
  return format(date, 'MMM d, yyyy');
}

/**
 * Groups a list of messages chronologically by calendar date
 */
export function groupMessagesByDate(messages: MessageResponseDto[]): MessageDateGroup[] {
  if (!messages || messages.length === 0) return [];

  const groupsMap = new Map<string, MessageDateGroup>();

  for (const message of messages) {
    const date = parseISO(message.createdAt);
    const dateKey = isValid(date) ? format(date, 'yyyy-MM-dd') : 'unknown';
    const dateLabel = isValid(date) ? formatMessageDateLabel(date) : 'Unknown Date';

    let group = groupsMap.get(dateKey);
    if (!group) {
      group = {
        dateKey,
        dateLabel,
        messages: [],
      };
      groupsMap.set(dateKey, group);
    }
    group.messages.push(message);
  }

  return Array.from(groupsMap.values());
}

/**
 * Data hook for fetching paginated messages in a conversation
 */
export function useMessages(
  conversationIdOrOptions?: string | null | UseMessagesOptions,
  extraOptions?: UseMessagesOptions,
) {
  const normalizedOptions: UseMessagesOptions =
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
    limit = 50,
    enabled = true,
  } = normalizedOptions;

  const { data: workspaces } = useWorkspaces();

  // Resolve target workspace ID
  const resolvedWorkspaceId =
    explicitWorkspaceId ||
    (workspaceSlug ? workspaces?.find(w => w.slug === workspaceSlug)?.id : undefined) ||
    workspaces?.[0]?.id;

  const isQueryEnabled = Boolean(enabled && resolvedWorkspaceId && conversationId);

  const query = useInfiniteQuery({
    queryKey: ['messages', resolvedWorkspaceId, conversationId, limit],
    queryFn: async ({ pageParam = 1 }) => {
      if (!resolvedWorkspaceId || !conversationId) {
        throw new Error('Workspace ID and Conversation ID are required to fetch messages');
      }
      const res = await messagesApi.list(resolvedWorkspaceId, conversationId, {
        page: pageParam,
        limit,
      });
      return res;
    },
    initialPageParam: 1,
    getNextPageParam: lastPage => {
      const meta = lastPage.meta;
      if (!meta) return undefined;
      const currentPage = meta.page ?? 1;
      const totalPages = (meta as { totalPages?: number }).totalPages;
      const hasNextPage =
        (meta as { hasNextPage?: boolean }).hasNextPage ??
        meta.hasMore ??
        (totalPages ? currentPage < totalPages : false);
      return hasNextPage ? currentPage + 1 : undefined;
    },
    enabled: isQueryEnabled,
    staleTime: 10_000,
  });

  // Flattened items across pages
  const messages: MessageResponseDto[] = React.useMemo(() => {
    if (!query.data?.pages) return [];
    return query.data.pages.flatMap(page => page.data || []);
  }, [query.data?.pages]);

  // Chronologically grouped messages by day
  const groupedMessages: MessageDateGroup[] = React.useMemo(() => {
    return groupMessagesByDate(messages);
  }, [messages]);

  const totalCount = query.data?.pages?.[0]?.meta?.total ?? messages.length;
  const isEmpty = !query.isLoading && messages.length === 0;

  return {
    ...query,
    messages,
    groupedMessages,
    totalCount,
    isEmpty,
    workspaceId: resolvedWorkspaceId,
  };
}
