'use client';

import * as React from 'react';
import {
  Search,
  UserPlus,
  Trash2,
  AlertTriangle,
  UserCheck,
  Shield,
  ShieldCheck,
  Eye,
  Crown,
  X,
} from 'lucide-react';
import {
  type AssignableWorkspaceRole,
  type WorkspaceMemberDto,
  WorkspaceRole,
} from '@sales-copilot/shared-contracts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  useRemoveWorkspaceMember,
  useUpdateMemberRole,
  useWorkspaceMembers,
} from './hooks/use-workspace-members';
import { InviteMemberDialog } from './invite-member-dialog';

interface MembersTableProps {
  workspaceId: string;
  currentUserId?: string;
  currentUserRole?: WorkspaceRole;
}

export function MembersTable({ workspaceId, currentUserId, currentUserRole }: MembersTableProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState<string>('ALL');
  const [inviteDialogOpen, setInviteDialogOpen] = React.useState(false);
  const [memberToRemove, setMemberToRemove] = React.useState<WorkspaceMemberDto | null>(null);

  const { data: members, isLoading } = useWorkspaceMembers(workspaceId);
  const { mutate: updateRole, isPending: isUpdatingRole } = useUpdateMemberRole(workspaceId);
  const { mutate: removeMember, isPending: isRemovingMember } =
    useRemoveWorkspaceMember(workspaceId);

  const canManage =
    currentUserRole === WorkspaceRole.OWNER || currentUserRole === WorkspaceRole.ADMIN;

  // Filter members by search query and role filter
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

  const getRoleIcon = (role: WorkspaceRole) => {
    switch (role) {
      case WorkspaceRole.OWNER:
        return <Crown className="size-3 text-amber-500" />;
      case WorkspaceRole.ADMIN:
        return <ShieldCheck className="size-3 text-primary" />;
      case WorkspaceRole.AGENT:
        return <UserCheck className="size-3 text-emerald-500" />;
      case WorkspaceRole.VIEWER:
        return <Eye className="size-3 text-muted-foreground" />;
      default:
        return <Shield className="size-3 text-muted-foreground" />;
    }
  };

  const getInitials = (name?: string, email?: string) => {
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
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Table Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name or email..."
              className="h-8 pl-8 pr-8 text-xs bg-card/40"
            />
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery('')}
                className="absolute right-1 top-1/2 size-6 -translate-y-1/2 p-0 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </Button>
            )}
          </div>

          {/* Role Filter */}
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-8 w-32 text-xs bg-card/40">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="ALL" className="text-xs">
                All Roles
              </SelectItem>
              <SelectItem value={WorkspaceRole.OWNER} className="text-xs">
                Owners
              </SelectItem>
              <SelectItem value={WorkspaceRole.ADMIN} className="text-xs">
                Admins
              </SelectItem>
              <SelectItem value={WorkspaceRole.AGENT} className="text-xs">
                Agents
              </SelectItem>
              <SelectItem value={WorkspaceRole.VIEWER} className="text-xs">
                Viewers
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Members count badge */}
          {members && (
            <Badge
              variant="secondary"
              className="px-2 py-0.5 text-[11px] font-normal text-muted-foreground"
            >
              {filteredMembers.length} {filteredMembers.length === 1 ? 'member' : 'members'}
            </Badge>
          )}
        </div>

        {/* Invite Button */}
        {canManage && (
          <Button
            size="sm"
            onClick={() => setInviteDialogOpen(true)}
            className="h-8 gap-1.5 text-xs font-medium"
          >
            <UserPlus className="size-3.5" data-icon="inline-start" />
            Invite Member
          </Button>
        )}
      </div>

      {/* Members Table */}
      <div className="rounded-xl border border-border bg-card/40 overflow-hidden shadow-2xs">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-[300px] text-xs font-semibold">User</TableHead>
              <TableHead className="text-xs font-semibold">Role</TableHead>
              <TableHead className="text-xs font-semibold">Joined</TableHead>
              {canManage && (
                <TableHead className="w-[80px] text-right text-xs font-semibold">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Loading Skeleton Rows
              Array.from({ length: 4 }).map((_, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Skeleton className="size-8 rounded-full" />
                      <div className="flex flex-col gap-1">
                        <Skeleton className="h-3.5 w-32" />
                        <Skeleton className="h-3 w-44" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-7 w-28 rounded-md" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-3 w-20" />
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto size-7 rounded-md" />
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : filteredMembers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 4 : 3}
                  className="h-36 text-center text-xs text-muted-foreground"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <UserCheck className="size-6 text-muted-foreground/50" />
                    <span>No members found matching your search.</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredMembers.map(member => {
                const isOwner = member.role === WorkspaceRole.OWNER;
                const isSelf = member.userId === currentUserId;
                const canEditThisMember = canManage && !isOwner && !isSelf;

                const joinedDate = member.createdAt
                  ? new Date(member.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : '—';

                return (
                  <TableRow key={member.id} className="hover:bg-muted/40">
                    {/* User Profile Column */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8 border border-border/60">
                          <AvatarImage
                            src={member.user?.avatarUrl || undefined}
                            alt={member.user?.name || 'User'}
                          />
                          <AvatarFallback className="text-xs font-medium">
                            {getInitials(member.user?.name, member.user?.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-xs font-semibold text-foreground">
                              {member.user?.name || 'Unnamed User'}
                            </span>
                            {isSelf && (
                              <Badge
                                variant="secondary"
                                className="h-4 px-1 text-[9px] font-medium"
                              >
                                You
                              </Badge>
                            )}
                          </div>
                          <span className="truncate text-[11px] text-muted-foreground">
                            {member.user?.email}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Role Column */}
                    <TableCell>
                      {isOwner ? (
                        <Badge
                          variant="outline"
                          className="gap-1 border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 text-xs font-semibold"
                        >
                          <Crown className="size-3" />
                          Owner
                        </Badge>
                      ) : canEditThisMember ? (
                        <Select
                          value={member.role}
                          onValueChange={(newRole: AssignableWorkspaceRole) =>
                            handleRoleChange(member, newRole)
                          }
                          disabled={isUpdatingRole}
                        >
                          <SelectTrigger className="h-7 w-28 text-xs bg-background/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent position="popper">
                            <SelectItem value={WorkspaceRole.ADMIN} className="text-xs">
                              <span className="flex items-center gap-1.5">
                                <ShieldCheck className="size-3 text-primary" />
                                Admin
                              </span>
                            </SelectItem>
                            <SelectItem value={WorkspaceRole.AGENT} className="text-xs">
                              <span className="flex items-center gap-1.5">
                                <UserCheck className="size-3 text-emerald-500" />
                                Agent
                              </span>
                            </SelectItem>
                            <SelectItem value={WorkspaceRole.VIEWER} className="text-xs">
                              <span className="flex items-center gap-1.5">
                                <Eye className="size-3 text-muted-foreground" />
                                Viewer
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="gap-1 px-2 py-0.5 text-xs font-medium"
                        >
                          {getRoleIcon(member.role)}
                          {member.role}
                        </Badge>
                      )}
                    </TableCell>

                    {/* Joined Date Column */}
                    <TableCell className="text-xs text-muted-foreground">{joinedDate}</TableCell>

                    {/* Actions Column */}
                    {canManage && (
                      <TableCell className="text-right">
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
                              Workspace Owner cannot be removed
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
                              You cannot remove your own account
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setMemberToRemove(member)}
                            className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                            title="Remove member"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Invite Member Dialog */}
      <InviteMemberDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        workspaceId={workspaceId}
      />

      {/* Destructive Removal Confirmation AlertDialog */}
      <AlertDialog
        open={!!memberToRemove}
        onOpenChange={open => {
          if (!open) setMemberToRemove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <AlertTriangle className="size-4" />
            </AlertDialogMedia>
            <AlertDialogTitle className="text-sm font-semibold">
              Remove Workspace Member?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Are you sure you want to remove{' '}
              <strong className="text-foreground font-semibold">
                {memberToRemove?.user?.name || memberToRemove?.user?.email}
              </strong>{' '}
              ({memberToRemove?.user?.email}) from this workspace? They will immediately lose access
              to all conversations, inboxes, and settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemovingMember} className="text-xs">
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmRemove}
              disabled={isRemovingMember}
              className="text-xs font-medium"
            >
              {isRemovingMember ? (
                <>
                  <Spinner className="size-3.5" data-icon="inline-start" />
                  Removing...
                </>
              ) : (
                'Remove Member'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
