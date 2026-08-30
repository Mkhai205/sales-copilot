'use client';

import * as React from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { conversationsApi } from '@/lib/api/conversations';
import type { ConversationListQueryDto, ConversationResponseDto } from '@/lib/api/types';
import { useWorkspaces } from '@/features/workspaces/use-workspaces';

interface UseConversationsOptions {
  workspaceSlug?: string;
  workspaceId?: string;
  filters?: ConversationListQueryDto;
  limit?: number;
  enabled?: boolean;
}

export function useConversations({
  workspaceSlug,
  workspaceId: explicitWorkspaceId,
  filters,
  limit = 20,
  enabled = true,
}: UseConversationsOptions = {}) {
  const { data: workspaces } = useWorkspaces();

  // Resolve target workspace ID
  const resolvedWorkspaceId =
    explicitWorkspaceId ||
    (workspaceSlug ? workspaces?.find(w => w.slug === workspaceSlug)?.id : undefined) ||
    workspaces?.[0]?.id;

  const isQueryEnabled = Boolean(enabled && resolvedWorkspaceId);

  const query = useInfiniteQuery({
    queryKey: ['conversations', resolvedWorkspaceId, filters, limit],
    queryFn: async ({ pageParam = 1 }) => {
      if (!resolvedWorkspaceId) {
        throw new Error('Workspace ID is required to fetch conversations');
      }
      const res = await conversationsApi.list(resolvedWorkspaceId, {
        ...filters,
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
      return meta.hasMore ? currentPage + 1 : undefined;
    },
    enabled: isQueryEnabled,
    staleTime: 15_000, // 15 seconds
  });

  // Flattened items for easy UI iteration
  const conversations: ConversationResponseDto[] = React.useMemo(() => {
    if (!query.data?.pages) return [];
    return query.data.pages.flatMap(page => page.data || []);
  }, [query.data?.pages]);

  const totalCount = query.data?.pages?.[0]?.meta?.total ?? 0;
  const isEmpty = !query.isLoading && conversations.length === 0;

  return {
    ...query,
    conversations,
    totalCount,
    isEmpty,
    workspaceId: resolvedWorkspaceId,
  };
}
