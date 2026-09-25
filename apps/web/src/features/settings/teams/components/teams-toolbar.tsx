'use client';

import * as React from 'react';
import { Search, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface TeamsToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filteredCount: number;
  canManage: boolean;
  onCreateTeam: () => void;
}

export function TeamsToolbar({
  searchQuery,
  onSearchChange,
  filteredCount,
  canManage,
  onCreateTeam,
}: TeamsToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 items-center gap-2.5">
        {/* Search Input */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Tìm kiếm đội nhóm..."
            className="h-8 pl-8 pr-8 text-xs bg-card/40"
          />
          {searchQuery && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onSearchChange('')}
              className="absolute right-1 top-1/2 size-6 -translate-y-1/2 p-0 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </Button>
          )}
        </div>

        <Badge
          variant="secondary"
          className="px-2 py-0.5 text-[11px] font-normal text-muted-foreground"
        >
          {filteredCount} nhóm
        </Badge>
      </div>

      {canManage && (
        <Button size="sm" onClick={onCreateTeam} className="h-8 gap-1.5 text-xs font-medium">
          <UserPlus className="size-3.5" />
          Tạo nhóm mới
        </Button>
      )}
    </div>
  );
}
