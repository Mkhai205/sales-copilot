'use client';

import * as React from 'react';
import { X, RotateCcw } from 'lucide-react';
import { ConversationStatus, Priority } from '@sales-copilot/shared-contracts';
import type { ConversationFilters, StatusFilter } from './hooks/use-conversation-filters';
import { useInboxes, useLabels, useWorkspaceMembers } from '@/features/settings';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
        return 'Đang mở';
      case ConversationStatus.PENDING:
        return 'Đang chờ';
      case ConversationStatus.SNOOZED:
        return 'Tạm hoãn';
      case ConversationStatus.RESOLVED:
        return 'Đã giải quyết';
      case 'ALL':
        return 'Tất cả';
      default:
        return status;
    }
  };

  const getPriorityLabel = (priority: Priority) => {
    switch (priority) {
      case Priority.URGENT:
        return 'Khẩn cấp';
      case Priority.HIGH:
        return 'Cao';
      case Priority.MEDIUM:
        return 'Trung bình';
      case Priority.LOW:
        return 'Thấp';
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
      aria-label="Bộ lọc hội thoại đang áp dụng"
    >
      <span className="text-muted-foreground shrink-0 font-medium text-[10px] uppercase tracking-wider">
        {'Bộ lọc'}:
      </span>

      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Status Chip */}
        {filters.status !== ConversationStatus.OPEN && (
          <Badge
            variant="outline"
            className="h-6 gap-1 rounded-md px-2 py-0 text-[11px] font-medium text-foreground border-border/60 bg-background shadow-2xs"
          >
            <span className="text-muted-foreground">{'Trạng thái'}:</span>
            <span className="font-semibold text-primary">{getStatusLabel(filters.status)}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setStatus(ConversationStatus.OPEN)}
              className="size-3.5 p-0 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer ml-0.5"
              aria-label="Xóa bộ lọc trạng thái"
            >
              <X className="size-2.5" />
            </Button>
          </Badge>
        )}

        {/* Inbox / Channel Chip */}
        {filters.inboxId && (
          <Badge
            variant="outline"
            className="h-6 gap-1 rounded-md px-2 py-0 text-[11px] font-medium text-foreground border-border/60 bg-background shadow-2xs"
          >
            <span className="text-muted-foreground">{'Kênh:'}</span>
            <span className="font-semibold text-primary">
              {activeInbox ? activeInbox.name : 'Hộp thư'}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setInbox(undefined)}
              className="size-3.5 p-0 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer ml-0.5"
              aria-label="Xóa bộ lọc hộp thư"
            >
              <X className="size-2.5" />
            </Button>
          </Badge>
        )}

        {/* Priority Chip */}
        {filters.priority && (
          <Badge
            variant="outline"
            className="h-6 gap-1 rounded-md px-2 py-0 text-[11px] font-medium text-foreground border-border/60 bg-background shadow-2xs"
          >
            <span className="text-muted-foreground">{'Độ ưu tiên'}:</span>
            <span
              className={cn(
                'font-semibold',
                filters.priority === Priority.URGENT && 'text-rose-600 dark:text-rose-400',
                filters.priority === Priority.HIGH && 'text-amber-600 dark:text-amber-400',
                filters.priority === Priority.MEDIUM && 'text-blue-600 dark:text-blue-400',
                filters.priority === Priority.LOW && 'text-muted-foreground',
              )}
            >
              {getPriorityLabel(filters.priority)}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setPriority(undefined)}
              className="size-3.5 p-0 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer ml-0.5"
              aria-label="Xóa bộ lọc độ ưu tiên"
            >
              <X className="size-2.5" />
            </Button>
          </Badge>
        )}

        {/* Label Chip */}
        {filters.labelId && (
          <Badge
            variant="outline"
            className="h-6 gap-1 rounded-md px-2 py-0 text-[11px] font-medium text-foreground border-border/60 bg-background shadow-2xs"
          >
            <span className="text-muted-foreground">{'Nhãn:'}</span>
            {activeLabel && (
              <span
                className="size-2 rounded-full shrink-0"
                style={{ backgroundColor: activeLabel.color || '#3b82f6' }}
              />
            )}
            <span className="font-semibold text-primary">
              {activeLabel ? activeLabel.title : 'Nhãn'}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setLabel(undefined)}
              className="size-3.5 p-0 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer ml-0.5"
              aria-label="Xóa bộ lọc nhãn"
            >
              <X className="size-2.5" />
            </Button>
          </Badge>
        )}

        {/* Assignee Chip */}
        {filters.assigneeId && (
          <Badge
            variant="outline"
            className="h-6 gap-1 rounded-md px-2 py-0 text-[11px] font-medium text-foreground border-border/60 bg-background shadow-2xs"
          >
            <span className="text-muted-foreground">{'Phụ trách:'}</span>
            <span className="font-semibold text-primary">
              {activeMember?.user?.name || activeMember?.user?.email || 'Thành viên'}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setAssignee(undefined)}
              className="size-3.5 p-0 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer ml-0.5"
              aria-label="Xóa bộ lọc người phụ trách"
            >
              <X className="size-2.5" />
            </Button>
          </Badge>
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
          <span>{'Xóa bộ lọc'}</span>
        </Button>
      </div>
    </div>
  );
}
