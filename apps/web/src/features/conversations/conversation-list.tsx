'use client';

import * as React from 'react';
import Image from 'next/image';
import { RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ConversationCard } from './conversation-card';
import { ConversationListFilters } from './conversation-list-filters';
import { useConversations } from './hooks/use-conversations';
import { useConversationFilters } from './hooks/use-conversation-filters';

interface ConversationListProps {
  workspaceSlug: string;
  activeConversationId?: string;
}

function ConversationListSkeleton() {
  return (
    <div className="flex flex-col divide-y divide-border/40">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex flex-col gap-2 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Skeleton className="size-7 rounded-full" />
              <Skeleton className="h-3.5 w-28" />
            </div>
            <Skeleton className="h-3 w-10" />
          </div>
          <Skeleton className="h-3 w-4/5 ml-9" />
          <div className="flex items-center gap-1.5 ml-9 pt-1">
            <Skeleton className="h-4 w-14 rounded-full" />
            <Skeleton className="h-4 w-12 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ConversationList({ workspaceSlug, activeConversationId }: ConversationListProps) {
  const { apiQuery, resetFilters, filters } = useConversationFilters();
  const {
    conversations,
    totalCount,
    isLoading,
    isError,
    isEmpty,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useConversations({
    workspaceSlug,
    filters: apiQuery,
  });

  // IntersectionObserver for Infinite Scroll
  const loadMoreRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          fetchNextPage();
        }
      },
      { threshold: 0.1, rootMargin: '100px' },
    );

    const currentEl = loadMoreRef.current;
    if (currentEl) {
      observer.observe(currentEl);
    }

    return () => {
      if (currentEl) {
        observer.unobserve(currentEl);
      }
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const hasActiveFilters = Boolean(
    filters.q ||
    filters.status !== 'OPEN' ||
    filters.assignment !== 'all' ||
    filters.priority ||
    filters.inboxId ||
    filters.labelId,
  );

  return (
    <div className="flex h-full w-full min-h-0 flex-1 flex-col overflow-hidden bg-card/40">
      {/* 1. Panel Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/80 px-4">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold tracking-tight text-foreground">Conversations</h1>
          {!isLoading && (
            <Badge variant="secondary" className="text-[11px] font-normal px-1.5 py-0">
              {totalCount}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => refetch()}
            className="text-muted-foreground hover:text-foreground"
            title="Refresh conversations"
          >
            <RotateCcw className="size-3.5" />
            <span className="sr-only">Refresh conversations</span>
          </Button>
        </div>
      </div>

      {/* 2. Filters Section */}
      <ConversationListFilters />

      {/* 3. Conversations Scroll Area */}
      <div className="min-w-0 min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <ConversationListSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center justify-center p-8 text-center gap-2">
            <p className="text-xs text-destructive font-medium">Failed to load conversations</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="text-xs">
              Retry
            </Button>
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center p-8 text-center gap-2.5">
            <div className="flex items-center justify-center mb-1">
              <Image
                src={hasActiveFilters ? '/empty-search.svg' : '/empty-conversations.svg'}
                alt="Empty"
                width={120}
                height={90}
                className="max-h-24 w-auto object-contain drop-shadow-xs"
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">
                {hasActiveFilters ? 'No matching conversations' : 'No conversations in this view'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[200px] leading-tight">
                {hasActiveFilters
                  ? 'Try changing or clearing your search and filters.'
                  : 'New incoming customer messages will appear here.'}
              </p>
            </div>
            {hasActiveFilters && (
              <Button variant="outline" size="xs" onClick={resetFilters} className="text-[11px]">
                Reset filters
              </Button>
            )}
          </div>
        ) : (
          <div className="flex min-w-0 flex-col">
            {conversations.map(conversation => (
              <ConversationCard
                key={conversation.id}
                conversation={conversation}
                workspaceSlug={workspaceSlug}
                isSelected={activeConversationId === conversation.id}
              />
            ))}

            {/* Infinite Scroll Trigger Target */}
            <div ref={loadMoreRef} className="h-6 w-full flex items-center justify-center py-2">
              {isFetchingNextPage && (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="size-2 animate-ping rounded-full bg-primary" />
                  Loading more...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
