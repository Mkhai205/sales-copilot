'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  AddWorkspaceMemberDto,
  UpdateWorkspaceMemberRoleDto,
  WorkspaceMemberDto,
} from '@sales-copilot/shared-contracts';
import { workspacesApi } from '@/lib/api/workspaces';

export function useWorkspaceMembers(workspaceId?: string) {
  return useQuery<WorkspaceMemberDto[]>({
    queryKey: ['workspaces', workspaceId, 'members'],
    queryFn: async () => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await workspacesApi.listMembers(workspaceId);
      return res.data;
    },
    enabled: !!workspaceId,
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useAddWorkspaceMember(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: AddWorkspaceMemberDto) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await workspacesApi.addMember(workspaceId, dto);
      return res.data;
    },
    onSuccess: (newMember: WorkspaceMemberDto) => {
      queryClient.setQueryData<WorkspaceMemberDto[]>(
        ['workspaces', workspaceId, 'members'],
        old => {
          if (!old) return [newMember];
          // Check if already in list
          if (old.some(m => m.id === newMember.id)) return old;
          return [...old, newMember];
        },
      );
      queryClient.invalidateQueries({
        queryKey: ['workspaces', workspaceId, 'members'],
      });
      toast.success('Member invited successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to invite member');
    },
  });
}

export function useUpdateMemberRole(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      memberId,
      dto,
    }: {
      memberId: string;
      dto: UpdateWorkspaceMemberRoleDto;
    }) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await workspacesApi.updateMemberRole(workspaceId, memberId, dto);
      return res.data;
    },
    onSuccess: (updatedMember: WorkspaceMemberDto) => {
      queryClient.setQueryData<WorkspaceMemberDto[]>(
        ['workspaces', workspaceId, 'members'],
        old => {
          if (!old) return old;
          return old.map(m => (m.id === updatedMember.id ? updatedMember : m));
        },
      );
      toast.success('Member role updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update member role');
    },
  });
}

export function useRemoveWorkspaceMember(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memberId: string) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await workspacesApi.removeMember(workspaceId, memberId);
      return { memberId, success: res.success };
    },
    onSuccess: ({ memberId }) => {
      queryClient.setQueryData<WorkspaceMemberDto[]>(
        ['workspaces', workspaceId, 'members'],
        old => {
          if (!old) return old;
          return old.filter(m => m.id !== memberId);
        },
      );
      toast.success('Member removed from workspace');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to remove member');
    },
  });
}
