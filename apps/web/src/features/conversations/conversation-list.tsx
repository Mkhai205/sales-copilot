'use client';

import * as React from 'react';
import Image from 'next/image';
import { ArrowUpDown, Check, ChevronDown, RotateCcw, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Kbd } from '@/components/ui/kbd';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { ConversationCard } from './conversation-card';
import { ConversationListFilters } from './conversation-list-filters';
import { useConversations } from './hooks/use-conversations';
import { useConversationFilters, type StatusFilter } from './hooks/use-conversation-filters';
import { ConversationStatus, type ConversationSortBy } from '@/lib/api/types';
import { cn } from '@/lib/utils';

interface ConversationListProps {
  workspaceSlug: string;
  activeConversationId?: string;
}

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: ConversationStatus.OPEN, label: 'Open' },
  { value: ConversationStatus.PENDING, label: 'Pending' },
  { value: ConversationStatus.SNOOZED, label: 'Snoozed' },
  { value: ConversationStatus.RESOLVED, label: 'Resolved' },
  { value: 'ALL', label: 'All' },
];

const SORT_OPTIONS: Array<{
  label: string;
  sortBy: ConversationSortBy;
  sortOrder: 'asc' | 'desc';
}> = [
  { label: 'Last activity: Newest first', sortBy: 'lastActivityAt', sortOrder: 'desc' },
  { label: 'Last activity: Oldest first', sortBy: 'lastActivityAt', sortOrder: 'asc' },
  { label: 'Created at: Newest first', sortBy: 'createdAt', sortOrder: 'desc' },
  { label: 'Created at: Oldest first', sortBy: 'createdAt', sortOrder: 'asc' },
  { label: 'Priority: Highest first', sortBy: 'priority', sortOrder: 'desc' },
  { label: 'Unread count: Highest first', sortBy: 'unreadMessagesCount', sortOrder: 'desc' },
];

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
  const { apiQuery, resetFilters, filters, setStatus, setSearch, setSorting } =
    useConversationFilters();

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
    filters.q ||
    filters.status !== 'OPEN' ||
    filters.assignment !== 'mine' ||
    filters.priority ||
    filters.inboxId ||
    filters.labelId,
  );

  const activeStatusLabel =
    STATUS_OPTIONS.find(opt => opt.value === filters.status)?.label || 'Open';

  const isCurrentSort = (sortBy: ConversationSortBy, sortOrder: 'asc' | 'desc') =>
    filters.sortBy === sortBy && filters.sortOrder === sortOrder;

  return (
    <div className="flex h-full w-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      {/* 1. Top Search Header */}
      <div className="border-b border-border/60 p-2.5 bg-background">
        <InputGroup className="h-8.5 bg-muted/30 hover:bg-muted/50 focus-within:bg-background border-border/70 rounded-lg transition-colors">
          <InputGroupAddon align="inline-start">
            <Search className="size-3.5 text-muted-foreground" />
          </InputGroupAddon>
          <InputGroupInput
            ref={searchInputRef}
            id="conversation-search"
            name="conversation-search"
            aria-label="Search for messages in conversations"
            type="text"
            placeholder="Search for messages in conversations"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="text-xs h-7 placeholder:text-muted-foreground/70"
          />
          <InputGroupAddon align="inline-end">
            {searchInput ? (
              <InputGroupButton
                size="xs"
                variant="ghost"
                onClick={handleClearSearch}
                aria-label="Clear search"
                className="size-5 p-0 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </InputGroupButton>
            ) : (
              <Kbd className="text-[10px] opacity-70">⌘K</Kbd>
            )}
          </InputGroupAddon>
        </InputGroup>
      </div>

      {/* 2. Header Row: Title + Status Dropdown Pill + Action Buttons */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border/60 px-3 bg-background">
        {/* Left: Title + Status Pill */}
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold tracking-tight text-foreground">Conversations</h1>

          {/* Status Dropdown Pill */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="xs"
                className="h-6 gap-1 px-2 rounded-md text-xs font-medium text-foreground/80 hover:text-foreground bg-muted/40 hover:bg-muted/70 border-border/60 cursor-pointer"
              >
                <span>{activeStatusLabel}</span>
                <ChevronDown className="size-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-36">
              <DropdownMenuLabel className="text-[11px] text-muted-foreground">
                Filter by Status
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {STATUS_OPTIONS.map(opt => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => setStatus(opt.value)}
                  className="flex items-center justify-between text-xs cursor-pointer"
                >
                  <span>{opt.label}</span>
                  {filters.status === opt.value && <Check className="size-3.5 text-primary" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Right: Sort Dropdown & Refresh */}
        <div className="flex items-center gap-0.5">
          {/* Sort Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground hover:text-foreground size-7"
                title="Sort conversations"
              >
                <ArrowUpDown className="size-3.5" />
                <span className="sr-only">Sort conversations</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-[11px] text-muted-foreground">
                Order by
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {SORT_OPTIONS.map(opt => (
                <DropdownMenuItem
                  key={`${opt.sortBy}-${opt.sortOrder}`}
                  onClick={() => setSorting(opt.sortBy, opt.sortOrder)}
                  className="flex items-center justify-between text-xs cursor-pointer"
                >
                  <span
                    className={cn(
                      isCurrentSort(opt.sortBy, opt.sortOrder) && 'font-medium text-primary',
                    )}
                  >
                    {opt.label}
                  </span>
                  {isCurrentSort(opt.sortBy, opt.sortOrder) && (
                    <Check className="size-3.5 text-primary shrink-0" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Refresh Button */}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => refetch()}
            className="text-muted-foreground hover:text-foreground size-7"
            title="Refresh conversations"
          >
            <RotateCcw className="size-3.5" />
            <span className="sr-only">Refresh conversations</span>
          </Button>
        </div>
      </div>

      {/* 3. Underline Navigation Tabs (Mine / Unassigned / All) */}
      <ConversationListFilters workspaceSlug={workspaceSlug} />

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
