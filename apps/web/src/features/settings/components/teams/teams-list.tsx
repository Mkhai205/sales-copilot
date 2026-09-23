'use client';

import * as React from 'react';
import { Users2, UserPlus } from 'lucide-react';
import { type TeamDto, WorkspaceRole } from '@sales-copilot/shared-contracts';
import { Button } from '@/components/ui/button';
import { useDeleteTeam, useTeams } from '../../hooks/use-teams';
import { TeamFormDialog } from './team-form-dialog';
import { TeamsToolbar } from './teams-toolbar';
import { TeamCard } from './team-card';
import { TeamDeleteDialog } from './team-delete-dialog';

interface TeamsListProps {
  workspaceId: string;
  currentUserRole?: WorkspaceRole;
}

export function TeamsList({ workspaceId, currentUserRole }: TeamsListProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [teamToEdit, setTeamToEdit] = React.useState<TeamDto | null>(null);
  const [teamToDelete, setTeamToDelete] = React.useState<TeamDto | null>(null);

  const { data: teams } = useTeams(workspaceId);
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

  return (
    <div className="flex flex-col gap-6">
      {/* Toolbar */}
      <TeamsToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filteredCount={filteredTeams.length}
        canManage={canManage}
        onCreateTeam={() => setCreateDialogOpen(true)}
      />

      {/* Grid of Team Cards */}
      {filteredTeams.length === 0 ? (
        <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-border p-8 text-center bg-card/20">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
            <Users2 className="size-6" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            {searchQuery ? 'Không tìm thấy nhóm phù hợp' : 'Chưa có nhóm nào được tạo'}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            {searchQuery
              ? 'Thử thay đổi từ khóa tìm kiếm hoặc xóa bộ lọc.'
              : 'Tạo đội nhóm hỗ trợ để phân công nhân viên và định tuyến hội thoại khách hàng.'}
          </p>
          {canManage && !searchQuery && (
            <Button
              size="sm"
              onClick={() => setCreateDialogOpen(true)}
              className="mt-4 h-8 gap-1.5 text-xs font-medium"
            >
              <UserPlus className="size-3.5" data-icon="inline-start" />
              Tạo nhóm đầu tiên
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTeams.map(team => (
            <TeamCard
              key={team.id}
              team={team}
              canManage={canManage}
              onEdit={setTeamToEdit}
              onDelete={setTeamToDelete}
            />
          ))}
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
      <TeamDeleteDialog
        team={teamToDelete}
        onOpenChange={open => {
          if (!open) setTeamToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}
