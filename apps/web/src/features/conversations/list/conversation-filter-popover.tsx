'use client';

import * as React from 'react';
import { SlidersHorizontal, Check, ChevronLeft } from 'lucide-react';
import { ConversationStatus, ConversationPriority } from '@sales-copilot/shared-contracts';
import type { ConversationFilters, StatusFilter } from './hooks/use-conversation-filters';
import { useInboxes } from '@/features/settings/inboxes/hooks/use-inboxes';
import { useLabels } from '@/features/settings/labels/hooks/use-labels';
import { useWorkspaceMembers } from '@/features/settings/members/hooks/use-workspace-members';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ConversationFilterMenu, type FilterView } from './conversation-filter-menu';
import { ConversationFilterInboxView } from './conversation-filter-inbox-view';
import { ConversationFilterLabelView } from './conversation-filter-label-view';
import { ConversationFilterAssigneeView } from './conversation-filter-assignee-view';

interface ConversationFilterPopoverProps {
  workspaceId?: string;
  filters: ConversationFilters;
  activeFilterCount: number;
  setStatus: (status: StatusFilter) => void;
  setInbox: (inboxId?: string) => void;
  setPriority: (priority?: ConversationPriority) => void;
  setLabel: (labelId?: string) => void;
  setAssignee: (assigneeId?: string) => void;
  resetAdvancedFilters: () => void;
  disabled?: boolean;
}

const STATUS_ITEMS: Array<{ value: StatusFilter; label: string }> = [
  { value: ConversationStatus.OPEN, label: 'Đang mở' },
  { value: ConversationStatus.PENDING, label: 'Đang chờ' },
  { value: ConversationStatus.SNOOZED, label: 'Tạm hoãn' },
  { value: ConversationStatus.RESOLVED, label: 'Đã giải quyết' },
  { value: 'ALL', label: 'Tất cả' },
];

const PRIORITY_ITEMS: Array<{
  value?: ConversationPriority;
  label: string;
  dotColor: string;
  textColor?: string;
}> = [
  { value: undefined, label: 'Tất cả', dotColor: 'bg-muted-foreground/40' },
  {
    value: ConversationPriority.URGENT,
    label: 'Khẩn cấp',
    dotColor: 'bg-rose-500',
    textColor: 'text-rose-600 dark:text-rose-400',
  },
  {
    value: ConversationPriority.HIGH,
    label: 'Cao',
    dotColor: 'bg-amber-500',
    textColor: 'text-amber-600 dark:text-amber-400',
  },
  {
    value: ConversationPriority.MEDIUM,
    label: 'Trung bình',
    dotColor: 'bg-blue-500',
    textColor: 'text-blue-600 dark:text-blue-400',
  },
  {
    value: ConversationPriority.LOW,
    label: 'Thấp',
    dotColor: 'bg-muted-foreground/50',
    textColor: 'text-muted-foreground',
  },
];

export function ConversationFilterPopover({
  workspaceId,
  filters,
  activeFilterCount,
  setStatus,
  setInbox,
  setPriority,
  setLabel,
  setAssignee,
  resetAdvancedFilters,
  disabled = false,
}: ConversationFilterPopoverProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [currentView, setCurrentView] = React.useState<FilterView>('menu');
  const [searchQuery, setSearchQuery] = React.useState('');

  const { data: inboxes } = useInboxes(workspaceId);
  const { data: labels } = useLabels(workspaceId);
  const { data: members } = useWorkspaceMembers(workspaceId);

  // Reset navigation when popover closes
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setCurrentView('menu');
      setSearchQuery('');
    }
  };

  const navigateTo = (view: FilterView) => {
    setCurrentView(view);
    setSearchQuery('');
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant={activeFilterCount > 0 ? 'secondary' : 'ghost'}
              size="icon-xs"
              disabled={disabled}
              className={cn(
                'relative size-7 text-muted-foreground hover:text-foreground transition-all cursor-pointer',
                isOpen && 'bg-accent text-accent-foreground',
                activeFilterCount > 0 &&
                  'bg-primary/10 text-primary border border-primary/25 hover:bg-primary/15 hover:text-primary font-medium',
              )}
              aria-label="Lọc cuộc hội thoại"
            >
              <SlidersHorizontal className="size-3.5" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground shadow-xs animate-in zoom-in-50">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        {!isOpen && (
          <TooltipContent side="bottom">
            <span className="text-xs">
              {'Bộ lọc'}
              {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </span>
          </TooltipContent>
        )}
      </Tooltip>

      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        className="w-76 p-0 border border-border/80 bg-popover shadow-xl rounded-xl overflow-hidden focus:outline-none"
      >
        {/* ========================================================================= */}
        {/* TẦNG 1: MENU DANH MỤC TIÊU CHÍ (Linear / Raycast Style - 0 Scrollbars)     */}
        {/* ========================================================================= */}
        {currentView === 'menu' && (
          <ConversationFilterMenu
            filters={filters}
            activeFilterCount={activeFilterCount}
            inboxes={inboxes}
            labels={labels}
            members={members}
            onNavigate={navigateTo}
            onReset={resetAdvancedFilters}
          />
        )}

        {/* ========================================================================= */}
        {/* TẦNG 2: SUB-VIEW - CHỌN TRẠNG THÁI                                         */}
        {/* ========================================================================= */}
        {currentView === 'status' && (
          <div>
            <div className="flex items-center justify-between border-b border-border/60 px-2 py-2 bg-muted/20">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCurrentView('menu')}
                className="h-auto w-auto flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
              >
                <ChevronLeft className="size-3.5" />
                <span className="font-semibold">{'Trạng thái'}</span>
              </Button>
              {filters.status !== ConversationStatus.OPEN && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStatus(ConversationStatus.OPEN)}
                  className="h-auto w-auto text-[11px] text-muted-foreground hover:text-destructive cursor-pointer px-1"
                >
                  {'Xóa bộ lọc'}
                </Button>
              )}
            </div>

            <div className="p-1.5 space-y-0.5">
              {STATUS_ITEMS.map(item => {
                const isSelected = filters.status === item.value;
                return (
                  <Button
                    key={item.value}
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setStatus(item.value);
                      setCurrentView('menu');
                    }}
                    className={cn(
                      'h-auto w-auto flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition-colors cursor-pointer',
                      isSelected
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-foreground/80 hover:bg-muted/60',
                    )}
                  >
                    <span>{item.label}</span>
                    {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TẦNG 2: SUB-VIEW - CHỌN HỘP THƯ / KÊNH (CÓ SEARCH + 1 SCROLLBAR)           */}
        {/* ========================================================================= */}
        {currentView === 'inbox' && (
          <ConversationFilterInboxView
            filters={filters}
            inboxes={inboxes}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            setInbox={setInbox}
            setCurrentView={setCurrentView}
          />
        )}

        {/* ========================================================================= */}
        {/* TẦNG 2: SUB-VIEW - CHỌN ĐỘ ƯU TIÊN                                        */}
        {/* ========================================================================= */}
        {currentView === 'priority' && (
          <div>
            <div className="flex items-center justify-between border-b border-border/60 px-2 py-2 bg-muted/20">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCurrentView('menu')}
                className="h-auto w-auto flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
              >
                <ChevronLeft className="size-3.5" />
                <span className="font-semibold">{'Độ ưu tiên'}</span>
              </Button>
              {filters.priority && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setPriority(undefined)}
                  className="h-auto w-auto text-[11px] text-muted-foreground hover:text-destructive cursor-pointer px-1"
                >
                  {'Xóa bộ lọc'}
                </Button>
              )}
            </div>

            <div className="p-1.5 space-y-0.5">
              {PRIORITY_ITEMS.map(item => {
                const isSelected = filters.priority === item.value;
                return (
                  <Button
                    key={item.label}
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setPriority(item.value);
                      setCurrentView('menu');
                    }}
                    className={cn(
                      'h-auto w-auto flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition-colors cursor-pointer',
                      isSelected
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-foreground/80 hover:bg-muted/60',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn('size-2 rounded-full shrink-0', item.dotColor)} />
                      <span className={cn(isSelected ? 'text-primary' : item.textColor)}>
                        {item.label}
                      </span>
                    </div>
                    {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TẦNG 2: SUB-VIEW - CHỌN NHÃN (CÓ SEARCH + 1 SCROLLBAR)                    */}
        {/* ========================================================================= */}
        {currentView === 'label' && (
          <ConversationFilterLabelView
            filters={filters}
            labels={labels}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            setLabel={setLabel}
            setCurrentView={setCurrentView}
          />
        )}

        {/* ========================================================================= */}
        {/* TẦNG 2: SUB-VIEW - CHỌN NGƯỜI PHỤ TRÁCH (CÓ SEARCH + 1 SCROLLBAR)         */}
        {/* ========================================================================= */}
        {currentView === 'assignee' && (
          <ConversationFilterAssigneeView
            filters={filters}
            members={members}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            setAssignee={setAssignee}
            setCurrentView={setCurrentView}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
