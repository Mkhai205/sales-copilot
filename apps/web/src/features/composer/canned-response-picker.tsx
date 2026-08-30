'use client';

import * as React from 'react';
import { MessageSquareQuote, Search, Sparkles } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Kbd } from '@/components/ui/kbd';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import type { CannedResponseDto } from '@/lib/api/types';
import { useCannedResponses } from './hooks/use-canned-responses';

export interface CannedResponsePickerHandle {
  navigateUp: () => void;
  navigateDown: () => void;
  selectCurrent: () => boolean;
  filteredCount: number;
}

export interface CannedResponsePickerProps {
  isOpen: boolean;
  searchQuery: string;
  onSearchChange?: (query: string) => void;
  onSelect: (response: CannedResponseDto) => void;
  onClose: () => void;
  workspaceId?: string;
  workspaceSlug?: string;
  className?: string;
}

export const CannedResponsePicker = React.forwardRef<
  CannedResponsePickerHandle,
  CannedResponsePickerProps
>(function CannedResponsePicker(
  {
    isOpen,
    searchQuery,
    onSelect,
    onClose,
    workspaceId,
    workspaceSlug,
    className,
  }: CannedResponsePickerProps,
  ref,
) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  const { data: cannedResponses, isLoading } = useCannedResponses({
    workspaceId,
    workspaceSlug,
    enabled: isOpen,
  });

  // Client-side filtering by shortCode or content for instant snappy results
  const filteredResponses = React.useMemo(() => {
    if (!cannedResponses || cannedResponses.length === 0) return [];
    if (!searchQuery) return cannedResponses;

    const lower = searchQuery.toLowerCase().trim();
    return cannedResponses.filter(
      item =>
        item.shortCode.toLowerCase().includes(lower) || item.content.toLowerCase().includes(lower),
    );
  }, [cannedResponses, searchQuery]);

  // Keep selected index within bounds when results change
  React.useEffect(() => {
    setSelectedIndex(0);
  }, [filteredResponses.length, searchQuery]);

  // Expose keyboard navigation methods to parent textarea
  React.useImperativeHandle(
    ref,
    () => ({
      navigateUp: () => {
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : filteredResponses.length - 1));
      },
      navigateDown: () => {
        setSelectedIndex(prev => (prev < filteredResponses.length - 1 ? prev + 1 : 0));
      },
      selectCurrent: () => {
        if (filteredResponses.length > 0 && filteredResponses[selectedIndex]) {
          onSelect(filteredResponses[selectedIndex]);
          return true;
        }
        return false;
      },
      filteredCount: filteredResponses.length,
    }),
    [filteredResponses, selectedIndex, onSelect],
  );

  // Close on outside click
  React.useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className={cn(
        'absolute bottom-full mb-2 left-0 right-0 z-30 overflow-hidden rounded-xl border border-border bg-popover shadow-xl transition-all animate-in fade-in-0 zoom-in-95 duration-150',
        className,
      )}
    >
      <Command shouldFilter={false} className="border-none bg-transparent">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-border/50 px-3 py-2 bg-muted/30">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <MessageSquareQuote className="size-4 text-primary" />
            <span>Canned Responses</span>
            {searchQuery && (
              <span className="text-[11px] font-normal text-muted-foreground ml-1">
                matching &quot;/{searchQuery}&quot;
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="hidden sm:inline">Use</span>
            <Kbd className="text-[9px] py-0 px-1">↑↓</Kbd>
            <span className="hidden sm:inline">to navigate,</span>
            <Kbd className="text-[9px] py-0 px-1">↵</Kbd>
            <span className="hidden sm:inline">to select,</span>
            <Kbd className="text-[9px] py-0 px-1">Esc</Kbd>
          </div>
        </div>

        {/* Results List */}
        <CommandList className="max-h-56 p-1.5">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
              <Spinner className="size-3.5 animate-spin" />
              <span>Loading canned responses...</span>
            </div>
          ) : filteredResponses.length === 0 ? (
            <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">
              <div className="flex flex-col items-center gap-1">
                <Search className="size-4 opacity-40 mb-1" />
                <p className="font-medium text-foreground">No matching responses</p>
                <p className="text-[11px]">
                  {searchQuery
                    ? `No canned response found for "/${searchQuery}"`
                    : 'No canned responses available in this workspace'}
                </p>
              </div>
            </CommandEmpty>
          ) : (
            <CommandGroup heading="Saved Responses">
              {filteredResponses.map((item, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={() => onSelect(item)}
                    className={cn(
                      'flex items-center justify-between gap-3 px-2.5 py-2 cursor-pointer rounded-lg transition-colors',
                      isSelected && 'bg-accent text-accent-foreground',
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="font-mono text-[11px] font-semibold text-primary bg-primary/10 dark:bg-primary/20 px-1.5 py-0.5 rounded shrink-0">
                        /{item.shortCode}
                      </span>
                      <span className="text-xs text-foreground/90 truncate max-w-[320px]">
                        {item.content}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 text-muted-foreground opacity-60">
                      <Sparkles className="size-3" />
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </div>
  );
});
