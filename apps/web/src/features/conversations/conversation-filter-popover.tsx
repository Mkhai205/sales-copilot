'use client';

import * as React from 'react';
import Image from 'next/image';
import {
  SlidersHorizontal,
  Check,
  RotateCcw,
  Inbox as InboxIcon,
  Tag,
  User,
  AlertCircle,
  Clock,
  ChevronRight,
  ChevronLeft,
  Search,
  X,
} from 'lucide-react';
import { ConversationStatus, Priority } from '@/lib/api/types';
import type { ConversationFilters, StatusFilter } from './hooks/use-conversation-filters';
import { useInboxes } from '@/features/settings/hooks/use-inboxes';
import { useLabels } from '@/features/settings/hooks/use-labels';
import { useWorkspaceMembers } from '@/features/settings/hooks/use-workspace-members';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getChannelMeta } from '@/lib/channels';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

interface ConversationFilterPopoverProps {
  workspaceId?: string;
  filters: ConversationFilters;
  activeFilterCount: number;
  setStatus: (status: StatusFilter) => void;
  setInbox: (inboxId?: string) => void;
  setPriority: (priority?: Priority) => void;
  setLabel: (labelId?: string) => void;
  setAssignee: (assigneeId?: string) => void;
  resetAdvancedFilters: () => void;
  disabled?: boolean;
}

type FilterView = 'menu' | 'status' | 'inbox' | 'priority' | 'label' | 'assignee';

const STATUS_ITEMS: Array<{ value: StatusFilter; labelKey: string }> = [
  { value: ConversationStatus.OPEN, labelKey: 'conversations.status.open' },
  { value: ConversationStatus.PENDING, labelKey: 'conversations.status.pending' },
  { value: ConversationStatus.SNOOZED, labelKey: 'conversations.status.snoozed' },
  { value: ConversationStatus.RESOLVED, labelKey: 'conversations.status.resolved' },
  { value: 'ALL', labelKey: 'common.all' },
];

const PRIORITY_ITEMS: Array<{
  value?: Priority;
  labelKey: string;
  dotColor: string;
  textColor?: string;
}> = [
  { value: undefined, labelKey: 'common.all', dotColor: 'bg-muted-foreground/40' },
  {
    value: Priority.URGENT,
    labelKey: 'conversations.priority.urgent',
    dotColor: 'bg-rose-500',
    textColor: 'text-rose-600 dark:text-rose-400',
  },
  {
    value: Priority.HIGH,
    labelKey: 'conversations.priority.high',
    dotColor: 'bg-amber-500',
    textColor: 'text-amber-600 dark:text-amber-400',
  },
  {
    value: Priority.MEDIUM,
    labelKey: 'conversations.priority.medium',
    dotColor: 'bg-blue-500',
    textColor: 'text-blue-600 dark:text-blue-400',
  },
  {
    value: Priority.LOW,
    labelKey: 'conversations.priority.low',
    dotColor: 'bg-slate-400',
    textColor: 'text-slate-600 dark:text-slate-400',
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
  const { t } = useI18n();
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

  // Resolve current active labels for Menu view
  const activeInbox = inboxes?.find(i => i.id === filters.inboxId);
  const activeLabel = labels?.find(l => l.id === filters.labelId);
  const activeMember = members?.find(m => m.user?.id === filters.assigneeId);

  const getStatusLabel = (status: StatusFilter) => {
    switch (status) {
      case ConversationStatus.OPEN:
        return t('conversations.status.open');
      case ConversationStatus.PENDING:
        return t('conversations.status.pending');
      case ConversationStatus.SNOOZED:
        return t('conversations.status.snoozed');
      case ConversationStatus.RESOLVED:
        return t('conversations.status.resolved');
      case 'ALL':
        return t('common.all');
      default:
        return status;
    }
  };

  const getPriorityLabel = (priority?: Priority) => {
    if (!priority) return t('common.all');
    switch (priority) {
      case Priority.URGENT:
        return t('conversations.priority.urgent');
      case Priority.HIGH:
        return t('conversations.priority.high');
      case Priority.MEDIUM:
        return t('conversations.priority.medium');
      case Priority.LOW:
        return t('conversations.priority.low');
      default:
        return priority;
    }
  };

  // Filtered collections for search in subviews
  const filteredInboxes = React.useMemo(() => {
    if (!inboxes) return [];
    if (!searchQuery.trim()) return inboxes;
    const q = searchQuery.toLowerCase();
    return inboxes.filter(
      i => i.name.toLowerCase().includes(q) || i.channelType.toLowerCase().includes(q),
    );
  }, [inboxes, searchQuery]);

  const filteredLabels = React.useMemo(() => {
    if (!labels) return [];
    if (!searchQuery.trim()) return labels;
    const q = searchQuery.toLowerCase();
    return labels.filter(l => l.title.toLowerCase().includes(q));
  }, [labels, searchQuery]);

  const filteredMembers = React.useMemo(() => {
    if (!members) return [];
    if (!searchQuery.trim()) return members;
    const q = searchQuery.toLowerCase();
    return members.filter(
      m => m.user?.name?.toLowerCase().includes(q) || m.user?.email?.toLowerCase().includes(q),
    );
  }, [members, searchQuery]);

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <Tooltip open={isOpen ? false : undefined}>
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
              aria-label="Filter conversations"
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
        <TooltipContent side="bottom">
          <span className="text-xs">
            {t('common.filter')}
            {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </span>
        </TooltipContent>
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
          <div>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/60 px-3.5 py-2.5 bg-muted/20">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="size-3.5 text-primary" />
                <span className="text-xs font-semibold text-foreground">{t('common.filter')}</span>
                {activeFilterCount > 0 && (
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary tabular-nums">
                    {activeFilterCount}
                  </span>
                )}
              </div>

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={resetAdvancedFilters}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                >
                  <RotateCcw className="size-3" />
                  <span>{t('conversations.filter.clearFilters')}</span>
                </button>
              )}
            </div>

            {/* Menu Rows */}
            <div className="p-1.5 space-y-0.5 text-xs">
              {/* 1. Trạng thái */}
              <button
                type="button"
                onClick={() => navigateTo('status')}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors hover:bg-muted/60 cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 text-foreground/80 group-hover:text-foreground">
                  <Clock className="size-3.5 text-muted-foreground group-hover:text-foreground" />
                  <span className="font-medium">{t('common.status')}</span>
                </div>
                <div className="flex items-center gap-1 min-w-0">
                  <span
                    className={cn(
                      'text-xs truncate max-w-[110px]',
                      filters.status !== ConversationStatus.OPEN
                        ? 'font-semibold text-primary'
                        : 'text-muted-foreground',
                    )}
                  >
                    {getStatusLabel(filters.status)}
                  </span>
                  <ChevronRight className="size-3.5 text-muted-foreground/60 shrink-0" />
                </div>
              </button>

              {/* 2. Hộp thư / Kênh */}
              <button
                type="button"
                onClick={() => navigateTo('inbox')}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors hover:bg-muted/60 cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 text-foreground/80 group-hover:text-foreground">
                  <InboxIcon className="size-3.5 text-muted-foreground group-hover:text-foreground" />
                  <span className="font-medium">{t('conversations.filter.filterByInbox')}</span>
                </div>
                <div className="flex items-center gap-1 min-w-0">
                  <span
                    className={cn(
                      'text-xs truncate max-w-[110px]',
                      filters.inboxId ? 'font-semibold text-primary' : 'text-muted-foreground',
                    )}
                  >
                    {activeInbox ? activeInbox.name : t('common.all')}
                  </span>
                  <ChevronRight className="size-3.5 text-muted-foreground/60 shrink-0" />
                </div>
              </button>

              {/* 3. Độ ưu tiên */}
              <button
                type="button"
                onClick={() => navigateTo('priority')}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors hover:bg-muted/60 cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 text-foreground/80 group-hover:text-foreground">
                  <AlertCircle className="size-3.5 text-muted-foreground group-hover:text-foreground" />
                  <span className="font-medium">{t('common.priority')}</span>
                </div>
                <div className="flex items-center gap-1 min-w-0">
                  <span
                    className={cn(
                      'text-xs truncate max-w-[110px]',
                      filters.priority ? 'font-semibold text-primary' : 'text-muted-foreground',
                    )}
                  >
                    {getPriorityLabel(filters.priority)}
                  </span>
                  <ChevronRight className="size-3.5 text-muted-foreground/60 shrink-0" />
                </div>
              </button>

              {/* 4. Nhãn */}
              <button
                type="button"
                onClick={() => navigateTo('label')}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors hover:bg-muted/60 cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 text-foreground/80 group-hover:text-foreground">
                  <Tag className="size-3.5 text-muted-foreground group-hover:text-foreground" />
                  <span className="font-medium">{t('conversations.actions.labels')}</span>
                </div>
                <div className="flex items-center gap-1 min-w-0">
                  <span
                    className={cn(
                      'text-xs truncate max-w-[110px]',
                      filters.labelId ? 'font-semibold text-primary' : 'text-muted-foreground',
                    )}
                  >
                    {activeLabel ? activeLabel.title : t('common.all')}
                  </span>
                  <ChevronRight className="size-3.5 text-muted-foreground/60 shrink-0" />
                </div>
              </button>

              {/* 5. Người phụ trách */}
              <button
                type="button"
                onClick={() => navigateTo('assignee')}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors hover:bg-muted/60 cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 text-foreground/80 group-hover:text-foreground">
                  <User className="size-3.5 text-muted-foreground group-hover:text-foreground" />
                  <span className="font-medium">{t('conversations.actions.assignee')}</span>
                </div>
                <div className="flex items-center gap-1 min-w-0">
                  <span
                    className={cn(
                      'text-xs truncate max-w-[110px]',
                      filters.assigneeId ? 'font-semibold text-primary' : 'text-muted-foreground',
                    )}
                  >
                    {activeMember?.user?.name || activeMember?.user?.email || t('common.all')}
                  </span>
                  <ChevronRight className="size-3.5 text-muted-foreground/60 shrink-0" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TẦNG 2: SUB-VIEW - CHỌN TRẠNG THÁI                                         */}
        {/* ========================================================================= */}
        {currentView === 'status' && (
          <div>
            <div className="flex items-center justify-between border-b border-border/60 px-2 py-2 bg-muted/20">
              <button
                type="button"
                onClick={() => setCurrentView('menu')}
                className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
              >
                <ChevronLeft className="size-3.5" />
                <span className="font-semibold">{t('common.status')}</span>
              </button>
              {filters.status !== ConversationStatus.OPEN && (
                <button
                  type="button"
                  onClick={() => setStatus(ConversationStatus.OPEN)}
                  className="text-[11px] text-muted-foreground hover:text-destructive cursor-pointer px-1"
                >
                  {t('common.clear')}
                </button>
              )}
            </div>

            <div className="p-1.5 space-y-0.5">
              {STATUS_ITEMS.map(item => {
                const isSelected = filters.status === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      setStatus(item.value);
                      setCurrentView('menu');
                    }}
                    className={cn(
                      'flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition-colors cursor-pointer',
                      isSelected
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-foreground/80 hover:bg-muted/60',
                    )}
                  >
                    <span>{t(item.labelKey)}</span>
                    {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TẦNG 2: SUB-VIEW - CHỌN HỘP THƯ / KÊNH (CÓ SEARCH + 1 SCROLLBAR)           */}
        {/* ========================================================================= */}
        {currentView === 'inbox' && (
          <div>
            <div className="flex items-center justify-between border-b border-border/60 px-2 py-2 bg-muted/20">
              <button
                type="button"
                onClick={() => setCurrentView('menu')}
                className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
              >
                <ChevronLeft className="size-3.5" />
                <span className="font-semibold">{t('conversations.filter.filterByInbox')}</span>
              </button>
              {filters.inboxId && (
                <button
                  type="button"
                  onClick={() => setInbox(undefined)}
                  className="text-[11px] text-muted-foreground hover:text-destructive cursor-pointer px-1"
                >
                  {t('common.clear')}
                </button>
              )}
            </div>

            {/* Instant Search Bar */}
            <div className="border-b border-border/50 p-2">
              <div className="flex items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1 text-xs border border-border/60 focus-within:border-ring">
                <Search className="size-3 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  placeholder="Tìm theo tên kênh hoặc loại..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            </div>

            {/* List with single vertical scrollbar */}
            <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5 scrollbar-thin">
              <button
                type="button"
                onClick={() => {
                  setInbox(undefined);
                  setCurrentView('menu');
                }}
                className={cn(
                  'flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition-colors cursor-pointer',
                  !filters.inboxId
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-foreground/80 hover:bg-muted/60',
                )}
              >
                <span>{t('conversations.filter.allInboxes')}</span>
                {!filters.inboxId && <Check className="size-3.5 text-primary shrink-0" />}
              </button>

              {filteredInboxes.map(inbox => {
                const meta = getChannelMeta(inbox.channelType);
                const isSelected = filters.inboxId === inbox.id;
                return (
                  <button
                    key={inbox.id}
                    type="button"
                    onClick={() => {
                      setInbox(inbox.id);
                      setCurrentView('menu');
                    }}
                    className={cn(
                      'flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition-colors cursor-pointer',
                      isSelected
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-foreground/80 hover:bg-muted/60',
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Image
                        src={meta.iconSrc}
                        alt={meta.label}
                        width={14}
                        height={14}
                        className="shrink-0 object-contain"
                      />
                      <span className="truncate">{inbox.name}</span>
                    </div>
                    {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                  </button>
                );
              })}

              {filteredInboxes.length === 0 && (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  {t('common.noResults')}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TẦNG 2: SUB-VIEW - CHỌN ĐỘ ƯU TIÊN                                        */}
        {/* ========================================================================= */}
        {currentView === 'priority' && (
          <div>
            <div className="flex items-center justify-between border-b border-border/60 px-2 py-2 bg-muted/20">
              <button
                type="button"
                onClick={() => setCurrentView('menu')}
                className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
              >
                <ChevronLeft className="size-3.5" />
                <span className="font-semibold">{t('common.priority')}</span>
              </button>
              {filters.priority && (
                <button
                  type="button"
                  onClick={() => setPriority(undefined)}
                  className="text-[11px] text-muted-foreground hover:text-destructive cursor-pointer px-1"
                >
                  {t('common.clear')}
                </button>
              )}
            </div>

            <div className="p-1.5 space-y-0.5">
              {PRIORITY_ITEMS.map(item => {
                const isSelected = filters.priority === item.value;
                return (
                  <button
                    key={item.labelKey}
                    type="button"
                    onClick={() => {
                      setPriority(item.value);
                      setCurrentView('menu');
                    }}
                    className={cn(
                      'flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition-colors cursor-pointer',
                      isSelected
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-foreground/80 hover:bg-muted/60',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn('size-2 rounded-full shrink-0', item.dotColor)} />
                      <span className={cn(isSelected ? 'text-primary' : item.textColor)}>
                        {t(item.labelKey)}
                      </span>
                    </div>
                    {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TẦNG 2: SUB-VIEW - CHỌN NHÃN (CÓ SEARCH + 1 SCROLLBAR)                    */}
        {/* ========================================================================= */}
        {currentView === 'label' && (
          <div>
            <div className="flex items-center justify-between border-b border-border/60 px-2 py-2 bg-muted/20">
              <button
                type="button"
                onClick={() => setCurrentView('menu')}
                className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
              >
                <ChevronLeft className="size-3.5" />
                <span className="font-semibold">{t('conversations.actions.labels')}</span>
              </button>
              {filters.labelId && (
                <button
                  type="button"
                  onClick={() => setLabel(undefined)}
                  className="text-[11px] text-muted-foreground hover:text-destructive cursor-pointer px-1"
                >
                  {t('common.clear')}
                </button>
              )}
            </div>

            {/* Instant Search Bar */}
            <div className="border-b border-border/50 p-2">
              <div className="flex items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1 text-xs border border-border/60 focus-within:border-ring">
                <Search className="size-3 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  placeholder="Tìm kiếm nhãn..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Single scrollbar list */}
            <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5 scrollbar-thin">
              <button
                type="button"
                onClick={() => {
                  setLabel(undefined);
                  setCurrentView('menu');
                }}
                className={cn(
                  'flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition-colors cursor-pointer',
                  !filters.labelId
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-foreground/80 hover:bg-muted/60',
                )}
              >
                <span>{t('common.all')}</span>
                {!filters.labelId && <Check className="size-3.5 text-primary shrink-0" />}
              </button>

              {filteredLabels.map(label => {
                const isSelected = filters.labelId === label.id;
                return (
                  <button
                    key={label.id}
                    type="button"
                    onClick={() => {
                      setLabel(label.id);
                      setCurrentView('menu');
                    }}
                    className={cn(
                      'flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition-colors cursor-pointer',
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
                  </button>
                );
              })}

              {filteredLabels.length === 0 && (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  {t('common.noResults')}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TẦNG 2: SUB-VIEW - CHỌN NGƯỜI PHỤ TRÁCH (CÓ SEARCH + 1 SCROLLBAR)         */}
        {/* ========================================================================= */}
        {currentView === 'assignee' && (
          <div>
            <div className="flex items-center justify-between border-b border-border/60 px-2 py-2 bg-muted/20">
              <button
                type="button"
                onClick={() => setCurrentView('menu')}
                className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
              >
                <ChevronLeft className="size-3.5" />
                <span className="font-semibold">{t('conversations.actions.assignee')}</span>
              </button>
              {filters.assigneeId && (
                <button
                  type="button"
                  onClick={() => setAssignee(undefined)}
                  className="text-[11px] text-muted-foreground hover:text-destructive cursor-pointer px-1"
                >
                  {t('common.clear')}
                </button>
              )}
            </div>

            {/* Instant Search Bar */}
            <div className="border-b border-border/50 p-2">
              <div className="flex items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1 text-xs border border-border/60 focus-within:border-ring">
                <Search className="size-3 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  placeholder="Tìm nhân viên theo tên, email..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Single scrollbar list */}
            <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5 scrollbar-thin">
              <button
                type="button"
                onClick={() => {
                  setAssignee(undefined);
                  setCurrentView('menu');
                }}
                className={cn(
                  'flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition-colors cursor-pointer',
                  !filters.assigneeId
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-foreground/80 hover:bg-muted/60',
                )}
              >
                <span>{t('common.all')}</span>
                {!filters.assigneeId && <Check className="size-3.5 text-primary shrink-0" />}
              </button>

              {filteredMembers.map(member => {
                const isSelected = filters.assigneeId === member.user?.id;
                const name = member.user?.name || member.user?.email || 'Thành viên';
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => {
                      setAssignee(member.user?.id);
                      setCurrentView('menu');
                    }}
                    className={cn(
                      'flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition-colors cursor-pointer',
                      isSelected
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-foreground/80 hover:bg-muted/60',
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                        {name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="flex flex-col text-left min-w-0">
                        <span className="truncate font-medium">{name}</span>
                        {member.user?.email && member.user?.email !== name && (
                          <span className="text-[10px] text-muted-foreground truncate">
                            {member.user.email}
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                  </button>
                );
              })}

              {filteredMembers.length === 0 && (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  {t('common.noResults')}
                </div>
              )}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
