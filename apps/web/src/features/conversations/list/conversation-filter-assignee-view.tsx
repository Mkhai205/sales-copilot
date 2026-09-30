'use client';

import * as React from 'react';
import { Check, ChevronLeft, Search, X } from 'lucide-react';
import type { WorkspaceMemberDto } from '@sales-copilot/shared-contracts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import type { ConversationFilters } from './hooks/use-conversation-filters';

interface ConversationFilterAssigneeViewProps {
  filters: ConversationFilters;
  members?: WorkspaceMemberDto[];
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  setAssignee: (assigneeId?: string) => void;
  setCurrentView: (view: 'menu') => void;
}

export function ConversationFilterAssigneeView({
  filters,
  members,
  searchQuery,
  setSearchQuery,
  setAssignee,
  setCurrentView,
}: ConversationFilterAssigneeViewProps) {
  // Filtered collection for search in subview
  const filteredMembers = React.useMemo(() => {
    if (!members) return [];
    if (!searchQuery.trim()) return members;
    const q = searchQuery.toLowerCase();
    return members.filter(
      m => m.user?.name?.toLowerCase().includes(q) || m.user?.email?.toLowerCase().includes(q),
    );
  }, [members, searchQuery]);

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
          <span className="font-semibold">{'Người xử lý'}</span>
        </Button>
        {filters.assigneeId && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setAssignee(undefined)}
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
            placeholder={'Tìm nhân viên theo tên, email...'}
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
            setAssignee(undefined);
            setCurrentView('menu');
          }}
          className={cn(
            'h-auto w-auto flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition-colors cursor-pointer',
            !filters.assigneeId
              ? 'bg-primary/10 text-primary font-semibold'
              : 'text-foreground/80 hover:bg-muted/60',
          )}
        >
          <span>{'Tất cả'}</span>
          {!filters.assigneeId && <Check className="size-3.5 text-primary shrink-0" />}
        </Button>

        {filteredMembers.map(member => {
          const isSelected = filters.assigneeId === member.user?.id;
          const name = member.user?.name || member.user?.email || 'Thành viên';
          return (
            <Button
              key={member.id}
              type="button"
              variant="ghost"
              onClick={() => {
                setAssignee(member.user?.id);
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
            </Button>
          );
        })}

        {filteredMembers.length === 0 && (
          <div className="py-6 text-center text-xs text-muted-foreground">
            {'Không tìm thấy kết quả'}
          </div>
        )}
      </div>
    </div>
  );
}
