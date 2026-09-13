'use client';

import * as React from 'react';
import { X, RotateCcw } from 'lucide-react';
import { ConversationStatus, Priority } from '@/lib/api/types';
import type { ConversationFilters, StatusFilter } from './hooks/use-conversation-filters';
import { useInboxes } from '@/features/settings/hooks/use-inboxes';
import { useLabels } from '@/features/settings/hooks/use-labels';
import { useWorkspaceMembers } from '@/features/settings/hooks/use-workspace-members';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

interface ConversationActiveChipsProps {
  workspaceId?: string;
  filters: ConversationFilters;
  activeFilterCount: number;
  setStatus: (status: StatusFilter) => void;
  setInbox: (inboxId?: string) => void;
  setPriority: (priority?: Priority) => void;
  setLabel: (labelId?: string) => void;
  setAssignee: (assigneeId?: string) => void;
  resetAdvancedFilters: () => void;
  className?: string;
}

export function ConversationActiveChips({
  workspaceId,
  filters,
  activeFilterCount,
  setStatus,
  setInbox,
  setPriority,
  setLabel,
  setAssignee,
  resetAdvancedFilters,
  className,
}: ConversationActiveChipsProps) {
  const { t } = useI18n();
  const { data: inboxes } = useInboxes(workspaceId);
  const { data: labels } = useLabels(workspaceId);
  const { data: members } = useWorkspaceMembers(workspaceId);

  if (activeFilterCount === 0) {
    return null;
  }

  // Resolve active inbox name
  const activeInbox = filters.inboxId ? inboxes?.find(i => i.id === filters.inboxId) : null;

  // Resolve active label
  const activeLabel = filters.labelId ? labels?.find(l => l.id === filters.labelId) : null;

  // Resolve active member
  const activeMember = filters.assigneeId
    ? members?.find(m => m.user?.id === filters.assigneeId)
    : null;

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

  const getPriorityLabel = (priority: Priority) => {
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

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 bg-muted/20 border-b border-border/40 overflow-x-auto scrollbar-none text-[11px]',
        className,
      )}
      aria-label="Active conversation filters"
    >
      <span className="text-muted-foreground shrink-0 font-medium text-[10px] uppercase tracking-wider">
        {t('common.filter')}:
      </span>

      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Status Chip */}
        {filters.status !== ConversationStatus.OPEN && (
          <span className="inline-flex items-center gap-1 rounded-md bg-background px-2 py-0.5 font-medium text-foreground border border-border/60 shadow-2xs">
            <span className="text-muted-foreground">{t('common.status')}:</span>
            <span className="font-semibold text-primary">{getStatusLabel(filters.status)}</span>
            <button
              type="button"
              onClick={() => setStatus(ConversationStatus.OPEN)}
              className="ml-0.5 rounded-xs p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              aria-label="Remove status filter"
            >
              <X className="size-3" />
            </button>
          </span>
        )}

        {/* Inbox / Channel Chip */}
        {filters.inboxId && (
          <span className="inline-flex items-center gap-1 rounded-md bg-background px-2 py-0.5 font-medium text-foreground border border-border/60 shadow-2xs">
            <span className="text-muted-foreground">Kênh:</span>
            <span className="font-semibold text-primary">
              {activeInbox ? activeInbox.name : 'Hộp thư'}
            </span>
            <button
              type="button"
              onClick={() => setInbox(undefined)}
              className="ml-0.5 rounded-xs p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              aria-label="Remove inbox filter"
            >
              <X className="size-3" />
            </button>
          </span>
        )}

        {/* Priority Chip */}
        {filters.priority && (
          <span className="inline-flex items-center gap-1 rounded-md bg-background px-2 py-0.5 font-medium text-foreground border border-border/60 shadow-2xs">
            <span className="text-muted-foreground">{t('common.priority')}:</span>
            <span
              className={cn(
                'font-semibold',
                filters.priority === Priority.URGENT && 'text-rose-600 dark:text-rose-400',
                filters.priority === Priority.HIGH && 'text-amber-600 dark:text-amber-400',
                filters.priority === Priority.MEDIUM && 'text-blue-600 dark:text-blue-400',
                filters.priority === Priority.LOW && 'text-slate-600 dark:text-slate-400',
              )}
            >
              {getPriorityLabel(filters.priority)}
            </span>
            <button
              type="button"
              onClick={() => setPriority(undefined)}
              className="ml-0.5 rounded-xs p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              aria-label="Remove priority filter"
            >
              <X className="size-3" />
            </button>
          </span>
        )}

        {/* Label Chip */}
        {filters.labelId && (
          <span className="inline-flex items-center gap-1 rounded-md bg-background px-2 py-0.5 font-medium text-foreground border border-border/60 shadow-2xs">
            <span className="text-muted-foreground">Nhãn:</span>
            {activeLabel && (
              <span
                className="size-2 rounded-full shrink-0"
                style={{ backgroundColor: activeLabel.color || '#3b82f6' }}
              />
            )}
            <span className="font-semibold text-primary">
              {activeLabel ? activeLabel.title : 'Nhãn'}
            </span>
            <button
              type="button"
              onClick={() => setLabel(undefined)}
              className="ml-0.5 rounded-xs p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              aria-label="Remove label filter"
            >
              <X className="size-3" />
            </button>
          </span>
        )}

        {/* Assignee Chip */}
        {filters.assigneeId && (
          <span className="inline-flex items-center gap-1 rounded-md bg-background px-2 py-0.5 font-medium text-foreground border border-border/60 shadow-2xs">
            <span className="text-muted-foreground">Phụ trách:</span>
            <span className="font-semibold text-primary">
              {activeMember?.user?.name || activeMember?.user?.email || 'Thành viên'}
            </span>
            <button
              type="button"
              onClick={() => setAssignee(undefined)}
              className="ml-0.5 rounded-xs p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              aria-label="Remove assignee filter"
            >
              <X className="size-3" />
            </button>
          </span>
        )}

        {/* Clear All Button */}
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={resetAdvancedFilters}
          className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer gap-1"
        >
          <RotateCcw className="size-2.5" />
          <span>{t('conversations.filter.clearFilters')}</span>
        </Button>
      </div>
    </div>
  );
}
