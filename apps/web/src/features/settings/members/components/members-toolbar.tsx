'use client';

import * as React from 'react';
import { Search, UserPlus, X } from 'lucide-react';
import { WorkspaceRole } from '@sales-copilot/shared-contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { InviteMemberDialog } from './invite-member-dialog';

interface MembersToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  roleFilter: string;
  onRoleFilterChange: (value: string) => void;
  filteredCount: number;
  canManage: boolean;
  workspaceId: string;
}

export function MembersToolbar({
  searchQuery,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  filteredCount,
  canManage,
  workspaceId,
}: MembersToolbarProps) {
  const [inviteDialogOpen, setInviteDialogOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2.5">
        {/* Search Input */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Tìm theo tên hoặc email..."
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

        {/* Role Filter */}
        <Select value={roleFilter} onValueChange={onRoleFilterChange}>
          <SelectTrigger className="h-8 w-36 text-xs bg-card/40">
            <SelectValue placeholder="Tất cả vai trò" />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="ALL" className="text-xs">
              Tất cả vai trò
            </SelectItem>
            <SelectItem value={WorkspaceRole.OWNER} className="text-xs">
              Chủ sở hữu
            </SelectItem>
            <SelectItem value={WorkspaceRole.ADMIN} className="text-xs">
              Quản trị viên
            </SelectItem>
            <SelectItem value={WorkspaceRole.AGENT} className="text-xs">
              Nhân viên
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Members count badge */}
        <Badge
          variant="secondary"
          className="px-2 py-0.5 text-[11px] font-normal text-muted-foreground"
        >
          {filteredCount} thành viên
        </Badge>
      </div>

      {/* Add Employee Button */}
      {canManage && (
        <>
          <Button
            size="sm"
            onClick={() => setInviteDialogOpen(true)}
            className="h-8 gap-1.5 text-xs font-medium"
          >
            <UserPlus className="size-3.5" />
            Thêm nhân viên
          </Button>

          <InviteMemberDialog
            open={inviteDialogOpen}
            onOpenChange={setInviteDialogOpen}
            workspaceId={workspaceId}
          />
        </>
      )}
    </div>
  );
}
