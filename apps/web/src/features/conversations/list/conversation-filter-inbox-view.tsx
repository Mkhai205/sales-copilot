'use client';

import * as React from 'react';
import { Check, ChevronLeft, Search, X } from 'lucide-react';
import type { InboxDto } from '@sales-copilot/shared-contracts';
import { getChannelMeta } from '@/lib/channels';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import type { ConversationFilters } from './hooks/use-conversation-filters';

interface ConversationFilterInboxViewProps {
  filters: ConversationFilters;
  inboxes?: InboxDto[];
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  setInbox: (inboxId?: string) => void;
  setCurrentView: (view: 'menu') => void;
}

export function ConversationFilterInboxView({
  filters,
  inboxes,
  searchQuery,
  setSearchQuery,
  setInbox,
  setCurrentView,
}: ConversationFilterInboxViewProps) {
  // Filtered collection for search in subview
  const filteredInboxes = React.useMemo(() => {
    if (!inboxes) return [];
    if (!searchQuery.trim()) return inboxes;
    const q = searchQuery.toLowerCase();
    return inboxes.filter(
      i => i.name.toLowerCase().includes(q) || i.channelType.toLowerCase().includes(q),
    );
  }, [inboxes, searchQuery]);

  return (
    <div>
      <div className="flex items-center justify-between border-b border-border/60 px-2 py-2 bg-muted/20">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setCurrentView('menu')}
          className="h-auto w-auto flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
        >
          <ChevronLeft className="size-3.5" />
          <span className="font-semibold">{'Lọc theo hộp thư'}</span>
        </Button>
        {filters.inboxId && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setInbox(undefined)}
            className="h-auto w-auto text-[11px] text-muted-foreground hover:text-destructive cursor-pointer px-1"
          >
            {'Xóa bộ lọc'}
          </Button>
        )}
      </div>

      {/* Instant Search Bar */}
      <div className="border-b border-border/50 p-2">
        <InputGroup className="h-8 bg-muted/40 border-border/60">
          <InputGroupAddon align="inline-start">
            <Search className="size-3 text-muted-foreground shrink-0" />
          </InputGroupAddon>
          <InputGroupInput
            type="text"
            placeholder={'Tìm theo tên kênh hoặc loại...'}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="text-xs"
            autoFocus
          />
          {searchQuery && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                variant="ghost"
                onClick={() => setSearchQuery('')}
                className="cursor-pointer text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
      </div>

      {/* List with single vertical scrollbar */}
      <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5 scrollbar-thin">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setInbox(undefined);
            setCurrentView('menu');
          }}
          className={cn(
            'h-auto w-auto flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition-colors cursor-pointer',
            !filters.inboxId
              ? 'bg-primary/10 text-primary font-semibold'
              : 'text-foreground/80 hover:bg-muted/60',
          )}
        >
          <span>{'Tất cả hộp thư'}</span>
          {!filters.inboxId && <Check className="size-3.5 text-primary shrink-0" />}
        </Button>

        {filteredInboxes.map(inbox => {
          const meta = getChannelMeta(inbox.channelType);
          const isSelected = filters.inboxId === inbox.id;
          return (
            <Button
              key={inbox.id}
              type="button"
              variant="ghost"
              onClick={() => {
                setInbox(inbox.id);
                setCurrentView('menu');
              }}
              className={cn(
                'h-auto w-auto flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition-colors cursor-pointer',
                isSelected
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-foreground/80 hover:bg-muted/60',
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <img
                  src={meta.iconSrc}
                  alt={meta.label}
                  className="size-3.5 shrink-0 object-contain"
                />
                <span className="truncate">{inbox.name}</span>
              </div>
              {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
            </Button>
          );
        })}

        {filteredInboxes.length === 0 && (
          <div className="py-6 text-center text-xs text-muted-foreground">
            {'Không tìm thấy kết quả'}
          </div>
        )}
      </div>
    </div>
  );
}
