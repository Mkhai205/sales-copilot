'use client';

import {
  SlidersHorizontal,
  RotateCcw,
  Inbox as InboxIcon,
  Tag,
  User,
  AlertCircle,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { ConversationStatus, ConversationPriority } from '@sales-copilot/shared-contracts';
import type { InboxDto, LabelDto, WorkspaceMemberDto } from '@sales-copilot/shared-contracts';
import type { ConversationFilters, StatusFilter } from './hooks/use-conversation-filters';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type FilterView = 'menu' | 'status' | 'inbox' | 'priority' | 'label' | 'assignee';

interface ConversationFilterMenuProps {
  filters: ConversationFilters;
  activeFilterCount: number;
  inboxes?: InboxDto[];
  labels?: LabelDto[];
  members?: WorkspaceMemberDto[];
  onNavigate: (view: FilterView) => void;
  onReset: () => void;
}

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

const getPriorityLabel = (priority?: ConversationPriority) => {
  if (!priority) return 'Tất cả';
  switch (priority) {
    case ConversationPriority.URGENT:
      return 'Khẩn cấp';
    case ConversationPriority.HIGH:
      return 'Cao';
    case ConversationPriority.MEDIUM:
      return 'Trung bình';
    case ConversationPriority.LOW:
      return 'Thấp';
    default:
      return priority;
  }
};

export function ConversationFilterMenu({
  filters,
  activeFilterCount,
  inboxes,
  labels,
  members,
  onNavigate,
  onReset,
}: ConversationFilterMenuProps) {
  // Resolve current active labels for Menu view
  const activeInbox = inboxes?.find(i => i.id === filters.inboxId);
  const activeLabel = labels?.find(l => l.id === filters.labelId);
  const activeMember = members?.find(m => m.user?.id === filters.assigneeId);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 px-3.5 py-2.5 bg-muted/20">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">{'Bộ lọc'}</span>
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary tabular-nums">
              {activeFilterCount}
            </span>
          )}
        </div>

        {activeFilterCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            onClick={onReset}
            className="h-auto w-auto flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
          >
            <RotateCcw className="size-3" />
            <span>{'Xóa bộ lọc'}</span>
          </Button>
        )}
      </div>

      {/* Menu Rows */}
      <div className="p-1.5 space-y-0.5 text-xs">
        {/* 1. Trạng thái */}
        <Button
          type="button"
          variant="ghost"
          onClick={() => onNavigate('status')}
          className="h-auto w-auto flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors hover:bg-muted/60 cursor-pointer group"
        >
          <div className="flex items-center gap-2.5 text-foreground/80 group-hover:text-foreground">
            <Clock className="size-3.5 text-muted-foreground group-hover:text-foreground" />
            <span className="font-medium">{'Trạng thái'}</span>
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
        </Button>

        {/* 2. Hộp thư / Kênh */}
        <Button
          type="button"
          variant="ghost"
          onClick={() => onNavigate('inbox')}
          className="h-auto w-auto flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors hover:bg-muted/60 cursor-pointer group"
        >
          <div className="flex items-center gap-2.5 text-foreground/80 group-hover:text-foreground">
            <InboxIcon className="size-3.5 text-muted-foreground group-hover:text-foreground" />
            <span className="font-medium">{'Lọc theo hộp thư'}</span>
          </div>
          <div className="flex items-center gap-1 min-w-0">
            <span
              className={cn(
                'text-xs truncate max-w-[110px]',
                filters.inboxId ? 'font-semibold text-primary' : 'text-muted-foreground',
              )}
            >
              {activeInbox ? activeInbox.name : 'Tất cả'}
            </span>
            <ChevronRight className="size-3.5 text-muted-foreground/60 shrink-0" />
          </div>
        </Button>

        {/* 3. Độ ưu tiên */}
        <Button
          type="button"
          variant="ghost"
          onClick={() => onNavigate('priority')}
          className="h-auto w-auto flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors hover:bg-muted/60 cursor-pointer group"
        >
          <div className="flex items-center gap-2.5 text-foreground/80 group-hover:text-foreground">
            <AlertCircle className="size-3.5 text-muted-foreground group-hover:text-foreground" />
            <span className="font-medium">{'Độ ưu tiên'}</span>
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
        </Button>

        {/* 4. Nhãn */}
        <Button
          type="button"
          variant="ghost"
          onClick={() => onNavigate('label')}
          className="h-auto w-auto flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors hover:bg-muted/60 cursor-pointer group"
        >
          <div className="flex items-center gap-2.5 text-foreground/80 group-hover:text-foreground">
            <Tag className="size-3.5 text-muted-foreground group-hover:text-foreground" />
            <span className="font-medium">{'Nhãn'}</span>
          </div>
          <div className="flex items-center gap-1 min-w-0">
            <span
              className={cn(
                'text-xs truncate max-w-[110px]',
                filters.labelId ? 'font-semibold text-primary' : 'text-muted-foreground',
              )}
            >
              {activeLabel ? activeLabel.title : 'Tất cả'}
            </span>
            <ChevronRight className="size-3.5 text-muted-foreground/60 shrink-0" />
          </div>
        </Button>

        {/* 5. Người phụ trách */}
        <Button
          type="button"
          variant="ghost"
          onClick={() => onNavigate('assignee')}
          className="h-auto w-auto flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors hover:bg-muted/60 cursor-pointer group"
        >
          <div className="flex items-center gap-2.5 text-foreground/80 group-hover:text-foreground">
            <User className="size-3.5 text-muted-foreground group-hover:text-foreground" />
            <span className="font-medium">{'Người xử lý'}</span>
          </div>
          <div className="flex items-center gap-1 min-w-0">
            <span
              className={cn(
                'text-xs truncate max-w-[110px]',
                filters.assigneeId ? 'font-semibold text-primary' : 'text-muted-foreground',
              )}
            >
              {activeMember?.user?.name || activeMember?.user?.email || 'Tất cả'}
            </span>
            <ChevronRight className="size-3.5 text-muted-foreground/60 shrink-0" />
          </div>
        </Button>
      </div>
    </div>
  );
}
