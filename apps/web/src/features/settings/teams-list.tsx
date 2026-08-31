'use client';

import * as React from 'react';
import { Users2, UserPlus, Search, Pencil, Trash2, AlertTriangle, X, Users } from 'lucide-react';
import { type TeamDto, WorkspaceRole } from '@sales-copilot/shared-contracts';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
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
import { useDeleteTeam, useTeams } from './hooks/use-teams';
import { TeamFormDialog } from './team-form-dialog';

interface TeamsListProps {
  workspaceId: string;
  currentUserRole?: WorkspaceRole;
}

export function TeamsList({ workspaceId, currentUserRole }: TeamsListProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [teamToEdit, setTeamToEdit] = React.useState<TeamDto | null>(null);
  const [teamToDelete, setTeamToDelete] = React.useState<TeamDto | null>(null);

  const { data: teams, isLoading } = useTeams(workspaceId);
  const { mutate: deleteTeam, isPending: isDeleting } = useDeleteTeam(workspaceId);

  const canManage =
    currentUserRole === WorkspaceRole.OWNER || currentUserRole === WorkspaceRole.ADMIN;

  const filteredTeams = React.useMemo(() => {
    if (!teams) return [];
    if (!searchQuery.trim()) return teams;

    const query = searchQuery.trim().toLowerCase();
    return teams.filter(team => {
      const name = team.name.toLowerCase();
      const desc = team.description?.toLowerCase() || '';
      return name.includes(query) || desc.includes(query);
    });
  }, [teams, searchQuery]);

  const handleConfirmDelete = () => {
    if (!teamToDelete) return;
    deleteTeam(teamToDelete.id, {
      onSuccess: () => setTeamToDelete(null),
    });
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
    <div className="flex flex-col gap-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2.5">
          {/* Search Input */}
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search teams..."
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

          {teams && (
            <Badge
              variant="secondary"
              className="px-2 py-0.5 text-[11px] font-normal text-muted-foreground"
            >
              {filteredTeams.length} {filteredTeams.length === 1 ? 'team' : 'teams'}
            </Badge>
          )}
        </div>

        {canManage && (
          <Button
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
            className="h-8 gap-1.5 text-xs font-medium"
          >
            <UserPlus className="size-3.5" data-icon="inline-start" />
            Create Team
          </Button>
        )}
      </div>

      {/* Grid of Team Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <Card key={idx} className="border-border bg-card/30">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="size-8 rounded-lg" />
                  <div className="flex flex-col gap-1 flex-1">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-4">
                <Skeleton className="h-8 w-full rounded-md" />
              </CardContent>
              <CardFooter className="pt-0">
                <Skeleton className="h-6 w-24 rounded-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : filteredTeams.length === 0 ? (
        <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-border p-8 text-center bg-card/20">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
            <Users2 className="size-6" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            {searchQuery ? 'No teams match your search' : 'No teams created yet'}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            {searchQuery
              ? 'Try changing your search terms or clear the search input.'
              : 'Create support teams to organize agents and route incoming customer conversations.'}
          </p>
          {canManage && !searchQuery && (
            <Button
              size="sm"
              onClick={() => setCreateDialogOpen(true)}
              className="mt-4 h-8 gap-1.5 text-xs font-medium"
            >
              <UserPlus className="size-3.5" data-icon="inline-start" />
              Create First Team
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTeams.map(team => {
            const memberCount = team.memberCount ?? (team.members?.length || 0);
            const displayedMembers = (team.members || []).slice(0, 4);
            const remainingCount = memberCount - displayedMembers.length;

            return (
              <Card
                key={team.id}
                className="group relative flex flex-col justify-between border-border bg-card/40 hover:bg-card/70 transition-all shadow-2xs hover:shadow-sm"
              >
                <CardHeader className="pb-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                        <Users2 className="size-4" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <CardTitle className="truncate text-sm font-semibold text-foreground">
                          {team.name}
                        </CardTitle>
                        <span className="text-[11px] text-muted-foreground">
                          {memberCount} {memberCount === 1 ? 'member' : 'members'}
                        </span>
                      </div>
                    </div>

                    {canManage && (
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setTeamToEdit(team)}
                          className="size-7 text-muted-foreground hover:text-foreground"
                          title="Edit team"
                        >
                          <Pencil className="size-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setTeamToDelete(team)}
                          className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                          title="Delete team"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="flex-1 py-1">
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {team.description || 'No description provided.'}
                  </p>
                </CardContent>

                <CardFooter className="pt-3 pb-3 border-t border-border/40 flex items-center justify-between">
                  {/* Member Avatars Stack */}
                  <div className="flex items-center">
                    {displayedMembers.length > 0 ? (
                      <div className="flex -space-x-1.5 overflow-hidden py-0.5">
                        {displayedMembers.map(m => (
                          <Avatar
                            key={m.id}
                            className="inline-block size-6 ring-2 ring-background border border-border/60"
                            title={m.user?.name || m.user?.email}
                          >
                            <AvatarImage
                              src={m.user?.avatarUrl || undefined}
                              alt={m.user?.name || 'Member'}
                            />
                            <AvatarFallback className="text-[9px] font-medium">
                              {getInitials(m.user?.name, m.user?.email)}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {remainingCount > 0 && (
                          <div className="flex size-6 items-center justify-center rounded-full bg-muted ring-2 ring-background text-[9px] font-medium text-muted-foreground">
                            +{remainingCount}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                        <Users className="size-3" />
                        No members assigned
                      </span>
                    )}
                  </div>

                  {canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTeamToEdit(team)}
                      className="h-6 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                    >
                      Manage
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <TeamFormDialog
        open={createDialogOpen || !!teamToEdit}
        onOpenChange={open => {
          if (!open) {
            setCreateDialogOpen(false);
            setTeamToEdit(null);
          }
        }}
        workspaceId={workspaceId}
        teamToEdit={teamToEdit}
      />

      {/* Delete Team AlertDialog */}
      <AlertDialog
        open={!!teamToDelete}
        onOpenChange={open => {
          if (!open) setTeamToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <AlertTriangle className="size-4" />
            </AlertDialogMedia>
            <AlertDialogTitle className="text-sm font-semibold">Delete Team?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Are you sure you want to delete{' '}
              <strong className="text-foreground font-semibold">"{teamToDelete?.name}"</strong>? All
              conversation assignments and member associations for this team will be unlinked. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="text-xs">
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="text-xs font-medium"
            >
              {isDeleting ? (
                <>
                  <Spinner className="size-3.5" data-icon="inline-start" />
                  Deleting...
                </>
              ) : (
                'Delete Team'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
