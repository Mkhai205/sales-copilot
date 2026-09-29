'use client';

import * as React from 'react';
import { Trash2, UserCheck } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import {
  type AssignableWorkspaceRole,
  type WorkspaceMemberDto,
  WorkspaceRole,
} from '@sales-copilot/shared-contracts';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DataTable } from '@/components/data-table/data-table';
import {
  useRemoveWorkspaceMember,
  useUpdateMemberRole,
  useWorkspaceMembers,
} from '../hooks/use-workspace-members';
import { MembersToolbar } from './members-toolbar';
import { MemberRoleSelect } from './member-role-select';
import { MemberRemoveDialog } from './member-remove-dialog';

interface MembersTableProps {
  workspaceId: string;
  currentUserId?: string;
  currentUserRole?: WorkspaceRole;
}

function getInitials(name?: string, email?: string) {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return 'U';
}

export function MembersTable({ workspaceId, currentUserId, currentUserRole }: MembersTableProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState<string>('ALL');
  const [memberToRemove, setMemberToRemove] = React.useState<WorkspaceMemberDto | null>(null);

  const { data: members } = useWorkspaceMembers(workspaceId);
  const { mutate: updateRole, isPending: isUpdatingRole } = useUpdateMemberRole(workspaceId);
  const { mutate: removeMember, isPending: isRemovingMember } =
    useRemoveWorkspaceMember(workspaceId);

  const canManage =
    currentUserRole === WorkspaceRole.OWNER || currentUserRole === WorkspaceRole.ADMIN;

  const filteredMembers = React.useMemo(() => {
    if (!members) return [];

    return members.filter(member => {
      const name = member.user?.name?.toLowerCase() || '';
      const email = member.user?.email?.toLowerCase() || '';
      const query = searchQuery.trim().toLowerCase();

      const matchesSearch = !query || name.includes(query) || email.includes(query);
      const matchesRole = roleFilter === 'ALL' || member.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [members, searchQuery, roleFilter]);

  const handleRoleChange = (member: WorkspaceMemberDto, newRole: AssignableWorkspaceRole) => {
    if (member.role === newRole) return;
    updateRole({
      memberId: member.id,
      dto: { role: newRole },
    });
  };

  const handleConfirmRemove = () => {
    if (!memberToRemove) return;
    removeMember(memberToRemove.id, {
      onSuccess: () => setMemberToRemove(null),
    });
  };

  const columns = React.useMemo<ColumnDef<WorkspaceMemberDto, any>[]>(() => {
    const actionsColumn: ColumnDef<WorkspaceMemberDto, any> = {
      header: 'Thao tác',
      meta: { headerClassName: 'w-[80px] text-right text-xs font-semibold' },
      cell: ({ row }) => {
        const member = row.original;
        const isOwner = member.role === WorkspaceRole.OWNER;
        const isSelf = member.userId === currentUserId;

        return (
          <div className="flex justify-end">
            {isOwner ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled
                      className="size-7 opacity-40 cursor-not-allowed"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="left" className="text-xs">
                  Không thể xóa Chủ sở hữu workspace
                </TooltipContent>
              </Tooltip>
            ) : isSelf ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled
                      className="size-7 opacity-40 cursor-not-allowed"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="left" className="text-xs">
                  Bạn không thể tự xóa tài khoản của chính mình
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setMemberToRemove(member)}
                className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                title="Xóa thành viên"
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        );
      },
    };

    return [
      {
        header: 'Thành viên',
        meta: { headerClassName: 'w-[300px] text-xs font-semibold' },
        cell: ({ row }) => {
          const member = row.original;
          const isSelf = member.userId === currentUserId;
          return (
            <div className="flex items-center gap-3">
              <Avatar className="size-8 border border-border/60">
                <AvatarImage
                  src={member.user?.avatarUrl || undefined}
                  alt={member.user?.name || 'Thành viên'}
                />
                <AvatarFallback className="text-xs font-medium">
                  {getInitials(member.user?.name, member.user?.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-xs font-semibold text-foreground">
                    {member.user?.name || 'Chưa đặt tên'}
                  </span>
                  {isSelf && (
                    <Badge variant="secondary" className="h-4 px-1 text-[9px] font-medium">
                      Bạn
                    </Badge>
                  )}
                </div>
                <span className="truncate text-[11px] text-muted-foreground">
                  {member.user?.email}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        header: 'Vai trò',
        meta: { headerClassName: 'text-xs font-semibold' },
        cell: ({ row }) => {
          const member = row.original;
          const isOwner = member.role === WorkspaceRole.OWNER;
          const isSelf = member.userId === currentUserId;
          return (
            <MemberRoleSelect
              member={member}
              canEdit={canManage && !isOwner && !isSelf}
              isUpdating={isUpdatingRole}
              onRoleChange={handleRoleChange}
            />
          );
        },
      },
      {
        header: 'Ngày tham gia',
        meta: { headerClassName: 'text-xs font-semibold' },
        cell: ({ row }) => {
          const member = row.original;
          const joinedDate = member.createdAt
            ? new Date(member.createdAt).toLocaleDateString('vi-VN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })
            : '—';
          return <span className="text-xs text-muted-foreground">{joinedDate}</span>;
        },
      },
      ...(canManage ? [actionsColumn] : []),
    ];
  }, [canManage, currentUserId, isUpdatingRole, handleRoleChange]);

  return (
    <div className="flex flex-col gap-5">
      <MembersToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        roleFilter={roleFilter}
        onRoleFilterChange={setRoleFilter}
        filteredCount={filteredMembers.length}
        canManage={canManage}
        workspaceId={workspaceId}
      />

      <DataTable
        data={filteredMembers}
        columns={columns}
        getRowKey={member => member.id}
        className="rounded-xl border border-border bg-card/40 overflow-hidden shadow-2xs [&_thead]:bg-muted/30 [&_thead_tr:hover]:bg-muted/30 [&_th]:text-xs [&_th]:font-semibold"
        emptyState={{
          icon: <UserCheck className="size-6 text-muted-foreground/50" />,
          title: 'Không tìm thấy thành viên nào phù hợp với tìm kiếm.',
        }}
      />

      <MemberRemoveDialog
        member={memberToRemove}
        onOpenChange={open => {
          if (!open) setMemberToRemove(null);
        }}
        onConfirm={handleConfirmRemove}
        isRemoving={isRemovingMember}
      />
    </div>
  );
}
