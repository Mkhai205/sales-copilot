'use client';

import * as React from 'react';
import { Search, X } from 'lucide-react';
import { ConversationStatus } from '@/lib/api/types';
import {
  useConversationFilters,
  type AssignmentFilter,
  type StatusFilter,
} from './hooks/use-conversation-filters';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';

export function ConversationListFilters() {
  const { filters, setStatus, setAssignment, setSearch } = useConversationFilters();

  // Local immediate search input state
  const [searchInput, setSearchInput] = React.useState(filters.q);

  // Synchronize local input if URL search changes externally
  React.useEffect(() => {
    setSearchInput(filters.q);
  }, [filters.q]);

  // Debounce search query 300ms
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.q) {
        setSearch(searchInput);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput, filters.q, setSearch]);

  const handleClearSearch = () => {
    setSearchInput('');
    setSearch('');
  };

  return (
    <div className="flex flex-col gap-2.5 border-b border-border/60 p-3 bg-card/20">
      {/* 1. Status Filter Tabs */}
      <Tabs
        value={filters.status}
        onValueChange={val => setStatus(val as StatusFilter)}
        className="w-full"
      >
        <TabsList className="w-full grid grid-cols-4 h-7 p-0.5 bg-muted/60">
          <TabsTrigger value={ConversationStatus.OPEN} className="text-[11px] py-1">
            Open
          </TabsTrigger>
          <TabsTrigger value={ConversationStatus.PENDING} className="text-[11px] py-1">
            Pending
          </TabsTrigger>
          <TabsTrigger value={ConversationStatus.RESOLVED} className="text-[11px] py-1">
            Resolved
          </TabsTrigger>
          <TabsTrigger value="ALL" className="text-[11px] py-1">
            All
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 2. Secondary Assignment Filter & Search Bar */}
      <div className="flex items-center gap-2">
        <ToggleGroup
          type="single"
          value={filters.assignment}
          onValueChange={val => {
            if (val) setAssignment(val as AssignmentFilter);
          }}
          className="h-7 bg-muted/40 p-0.5 rounded-md border border-border/50"
        >
          <ToggleGroupItem value="all" className="h-6 px-2 text-[10px] font-medium">
            All
          </ToggleGroupItem>
          <ToggleGroupItem value="mine" className="h-6 px-2 text-[10px] font-medium">
            Mine
          </ToggleGroupItem>
          <ToggleGroupItem value="unassigned" className="h-6 px-2 text-[10px] font-medium">
            Unassigned
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* 3. Search Bar with InputGroup */}
      <InputGroup className="h-8 bg-background/80 border-border/70">
        <InputGroupAddon align="inline-start">
          <Search className="size-3.5 text-muted-foreground" />
        </InputGroupAddon>
        <InputGroupInput
          type="text"
          placeholder="Search by contact, text..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          className="text-xs h-7"
        />
        {searchInput && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="xs"
              variant="ghost"
              onClick={handleClearSearch}
              aria-label="Clear search"
            >
              <X className="size-3" />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>
    </div>
  );
}
