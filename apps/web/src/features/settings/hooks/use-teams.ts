'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { CreateTeamDto, TeamDto, UpdateTeamDto } from '@sales-copilot/shared-contracts';
import { teamsApi } from '@/lib/api/teams';

export function useTeams(workspaceId?: string) {
  return useQuery<TeamDto[]>({
    queryKey: ['workspaces', workspaceId, 'teams'],
    queryFn: async () => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await teamsApi.list(workspaceId);
      return res.data;
    },
    enabled: !!workspaceId,
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useTeam(workspaceId?: string, teamId?: string) {
  return useQuery<TeamDto>({
    queryKey: ['workspaces', workspaceId, 'teams', teamId],
    queryFn: async () => {
      if (!workspaceId || !teamId) {
        throw new Error('Workspace ID and Team ID are required');
      }
      const res = await teamsApi.get(workspaceId, teamId);
      return res.data;
    },
    enabled: !!workspaceId && !!teamId,
    staleTime: 60 * 1000,
  });
}

export function useCreateTeam(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      dto,
      memberUserIds,
    }: {
      dto: CreateTeamDto;
      memberUserIds?: string[];
    }) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      // 1. Create team
      const res = await teamsApi.create(workspaceId, dto);
      const newTeam = res.data;

      // 2. Add members if provided
      if (memberUserIds && memberUserIds.length > 0) {
        try {
          const membersRes = await teamsApi.addMembers(workspaceId, newTeam.id, memberUserIds);
          newTeam.members = membersRes.data;
          newTeam.memberCount = membersRes.data.length;
        } catch {
          // Team created, member assignment can be managed later
        }
      }

      return newTeam;
    },
    onSuccess: newTeam => {
      queryClient.setQueryData<TeamDto[]>(['workspaces', workspaceId, 'teams'], old => {
        if (!old) return [newTeam];
        if (old.some(t => t.id === newTeam.id)) return old;
        return [...old, newTeam];
      });
      queryClient.invalidateQueries({
        queryKey: ['workspaces', workspaceId, 'teams'],
      });
      toast.success('Team created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create team');
    },
  });
}

export function useUpdateTeam(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      dto,
      memberUserIds,
      currentMemberUserIds = [],
    }: {
      teamId: string;
      dto: UpdateTeamDto;
      memberUserIds?: string[];
      currentMemberUserIds?: string[];
    }) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }

      // 1. Update basic info if changed
      const res = await teamsApi.update(workspaceId, teamId, dto);
      const updatedTeam = res.data;

      // 2. Sync members if specified
      if (memberUserIds) {
        const toAdd = memberUserIds.filter(id => !currentMemberUserIds.includes(id));
        const toRemove = currentMemberUserIds.filter(id => !memberUserIds.includes(id));

        if (toAdd.length > 0) {
          await teamsApi.addMembers(workspaceId, teamId, toAdd);
        }
        if (toRemove.length > 0) {
          await teamsApi.removeMembers(workspaceId, teamId, toRemove);
        }

        // Fetch fresh team details
        const fresh = await teamsApi.get(workspaceId, teamId);
        return fresh.data;
      }

      return updatedTeam;
    },
    onSuccess: updatedTeam => {
      queryClient.setQueryData<TeamDto[]>(['workspaces', workspaceId, 'teams'], old => {
        if (!old) return old;
        return old.map(t => (t.id === updatedTeam.id ? updatedTeam : t));
      });
      queryClient.invalidateQueries({
        queryKey: ['workspaces', workspaceId, 'teams'],
      });
      toast.success('Team updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update team');
    },
  });
}

export function useDeleteTeam(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (teamId: string) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await teamsApi.delete(workspaceId, teamId);
      return { teamId, success: res.success };
    },
    onSuccess: ({ teamId }) => {
      queryClient.setQueryData<TeamDto[]>(['workspaces', workspaceId, 'teams'], old => {
        if (!old) return old;
        return old.filter(t => t.id !== teamId);
      });
      toast.success('Team deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete team');
    },
  });
}
