'use client';

import * as React from 'react';
import { Check, ChevronLeft, Search, X } from 'lucide-react';
import type { LabelDto } from '@sales-copilot/shared-contracts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import type { ConversationFilters } from './hooks/use-conversation-filters';

interface ConversationFilterLabelViewProps {
  filters: ConversationFilters;
  labels?: LabelDto[];
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  setLabel: (labelId?: string) => void;
  setCurrentView: (view: 'menu') => void;
}

export function ConversationFilterLabelView({
  filters,
  labels,
  searchQuery,
  setSearchQuery,
  setLabel,
  setCurrentView,
}: ConversationFilterLabelViewProps) {
  // Filtered collection for search in subview
  const filteredLabels = React.useMemo(() => {
    if (!labels) return [];
    if (!searchQuery.trim()) return labels;
    const q = searchQuery.toLowerCase();
    return labels.filter(l => l.title.toLowerCase().includes(q));
  }, [labels, searchQuery]);

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
          <span className="font-semibold">{'Nhãn'}</span>
        </Button>
        {filters.labelId && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setLabel(undefined)}
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
            placeholder={'Tìm kiếm nhãn...'}
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

      {/* Single scrollbar list */}
      <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5 scrollbar-thin">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setLabel(undefined);
            setCurrentView('menu');
          }}
          className={cn(
            'h-auto w-auto flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition-colors cursor-pointer',
            !filters.labelId
              ? 'bg-primary/10 text-primary font-semibold'
              : 'text-foreground/80 hover:bg-muted/60',
          )}
        >
          <span>{'Tất cả'}</span>
          {!filters.labelId && <Check className="size-3.5 text-primary shrink-0" />}
        </Button>

        {filteredLabels.map(label => {
          const isSelected = filters.labelId === label.id;
          return (
            <Button
              key={label.id}
              type="button"
              variant="ghost"
              onClick={() => {
                setLabel(label.id);
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
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{ backgroundColor: label.color || '#3b82f6' }}
                />
                <span className="truncate">{label.title}</span>
              </div>
              {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
            </Button>
          );
        })}

        {filteredLabels.length === 0 && (
          <div className="py-6 text-center text-xs text-muted-foreground">
            {'Không tìm thấy kết quả'}
          </div>
        )}
      </div>
    </div>
  );
}
