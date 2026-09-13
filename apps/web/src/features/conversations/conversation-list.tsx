'use client';

import * as React from 'react';
import Image from 'next/image';
import { RotateCcw, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Kbd } from '@/components/ui/kbd';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { ConversationCard } from './conversation-card';
import { ConversationListFilters } from './conversation-list-filters';
import { ConversationFilterPopover } from './conversation-filter-popover';
import { ConversationActiveChips } from './conversation-active-chips';
import { useConversations } from './hooks/use-conversations';
import { useConversationFilters } from './hooks/use-conversation-filters';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface ConversationListProps {
  workspaceSlug: string;
  activeConversationId?: string;
}

function ConversationListSkeleton() {
  return (
    <div className="flex flex-col divide-y divide-border/40">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex items-start gap-3 p-3">
          <Skeleton className="size-10 rounded-full shrink-0 mt-0.5" />
          <div className="flex flex-1 flex-col gap-1.5 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2.5 w-8" />
            </div>
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-4/5" />
            <div className="flex items-center gap-1.5 pt-0.5">
              <Skeleton className="h-3.5 w-14 rounded-xs" />
              <Skeleton className="h-3.5 w-12 rounded-xs" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ConversationList({ workspaceSlug, activeConversationId }: ConversationListProps) {
  const { t } = useI18n();
  const {
    apiQuery,
    resetFilters,
    resetAdvancedFilters,
    filters,
    activeFilterCount,
    setStatus,
    setSearch,
    setInbox,
    setPriority,
    setLabel,
    setAssignee,
  } = useConversationFilters();

  const {
    conversations,
    isLoading,
    isFetching,
    isError,
    isEmpty,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
    workspaceId,
  } = useConversations({
    workspaceSlug,
    filters: apiQuery,
  });

  // Search input state & ref
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [searchInput, setSearchInput] = React.useState(filters.q);

  React.useEffect(() => {
    setSearchInput(filters.q);
  }, [filters.q]);

  // Debounced search sync (300ms)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.q) {
        setSearch(searchInput);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput, filters.q, setSearch]);

  // Shortcut ⌘K / Ctrl+K to focus search input
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleClearSearch = () => {
    setSearchInput('');
    setSearch('');
    searchInputRef.current?.focus();
  };

  // Infinite Scroll IntersectionObserver
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
    filters.q || activeFilterCount > 0 || filters.assignment !== 'mine',
  );

  return (
    <div className="flex h-full w-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      {/* 1. Unified Search & Action Toolbar (Linear/Slack Style) */}
      <div className="flex items-center gap-1.5 border-b border-border/60 p-2 bg-background shrink-0">
        {/* Search Input */}
        <InputGroup className="h-8 flex-1 min-w-0 bg-muted/30 hover:bg-muted/50 focus-within:bg-background border-border/70 rounded-md transition-colors">
          <InputGroupAddon align="inline-start">
            <Search className="size-3.5 text-muted-foreground" />
          </InputGroupAddon>
          <InputGroupInput
            ref={searchInputRef}
            id="conversation-search"
            name="conversation-search"
            aria-label="Search for messages in conversations"
            type="text"
            placeholder={t('conversations.filter.searchPlaceholder')}
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="text-xs h-6.5 placeholder:text-muted-foreground/70"
          />
          <InputGroupAddon align="inline-end">
            {searchInput ? (
              <InputGroupButton
                size="xs"
                variant="ghost"
                onClick={handleClearSearch}
                aria-label="Clear search"
                className="size-4.5 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-3" />
              </InputGroupButton>
            ) : (
              <Kbd className="text-[9px] opacity-70">⌘K</Kbd>
            )}
          </InputGroupAddon>
        </InputGroup>

        {/* Action Group: Filter & Refresh */}
        <div className="flex items-center gap-0.5 shrink-0">
          {/* Advanced Filter Popover */}
          <ConversationFilterPopover
            workspaceId={workspaceId}
            filters={filters}
            activeFilterCount={activeFilterCount}
            setStatus={setStatus}
            setInbox={setInbox}
            setPriority={setPriority}
            setLabel={setLabel}
            setAssignee={setAssignee}
            resetAdvancedFilters={resetAdvancedFilters}
            disabled={isLoading}
          />

          {/* Refresh Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => refetch()}
                disabled={isLoading || isFetching}
                className="text-muted-foreground hover:text-foreground size-7 cursor-pointer"
                aria-label="Refresh conversations"
              >
                <RotateCcw className={cn('size-3.5', isFetching && 'animate-spin')} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <span className="text-xs">{t('common.refresh')}</span>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* 2. Underline Navigation Tabs (Mine / Unassigned / All) */}
      <ConversationListFilters workspaceSlug={workspaceSlug} />

      {/* 3. Active Filter Chips (Auto-rendered when activeFilterCount > 0) */}
      <ConversationActiveChips
        workspaceId={workspaceId}
        filters={filters}
        activeFilterCount={activeFilterCount}
        setStatus={setStatus}
        setInbox={setInbox}
        setPriority={setPriority}
        setLabel={setLabel}
        setAssignee={setAssignee}
        resetAdvancedFilters={resetAdvancedFilters}
      />

      {/* 4. Conversations Scroll Area */}
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

            {/* Infinite Scroll Trigger & Load More */}
            <div
              ref={loadMoreRef}
              className="w-full flex flex-col items-center justify-center py-3"
            >
              {isFetchingNextPage ? (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground py-1">
                  <span className="size-2 animate-ping rounded-full bg-primary" />
                  Loading more...
                </div>
              ) : hasNextPage ? (
                <button
                  type="button"
                  onClick={() => fetchNextPage()}
                  className="text-xs font-medium text-primary hover:underline cursor-pointer py-1"
                >
                  Load more conversations
                </button>
              ) : conversations.length > 0 ? (
                <p className="text-[11px] text-muted-foreground/70 py-1">
                  All conversations loaded 🎉
                </p>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
