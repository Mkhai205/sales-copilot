'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  AddWorkspaceMemberDto,
  UpdateWorkspaceMemberRoleDto,
  WorkspaceMemberDto,
} from '@sales-copilot/shared-contracts';
import { membersApi } from '../api/members';
import { memberKeys } from '@/lib/query-keys';

export function useWorkspaceMembers(workspaceId?: string) {
  return useQuery<WorkspaceMemberDto[]>({
    queryKey: memberKeys.list(workspaceId),
    queryFn: async () => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await membersApi.list(workspaceId);
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
      const res = await membersApi.add(workspaceId, dto);
      return res.data;
    },
    onSuccess: (newMember: WorkspaceMemberDto) => {
      queryClient.setQueryData<WorkspaceMemberDto[]>(memberKeys.list(workspaceId), old => {
        if (!old) return [newMember];
        if (old.some(m => m.id === newMember.id)) return old;
        return [...old, newMember];
      });
      queryClient.invalidateQueries({
        queryKey: memberKeys.list(workspaceId),
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
      const res = await membersApi.updateRole(workspaceId, memberId, dto);
      return res.data;
    },
    onSuccess: (updatedMember: WorkspaceMemberDto) => {
      queryClient.setQueryData<WorkspaceMemberDto[]>(memberKeys.list(workspaceId), old => {
        if (!old) return old;
        return old.map(m => (m.id === updatedMember.id ? updatedMember : m));
      });
      queryClient.invalidateQueries({
        queryKey: memberKeys.list(workspaceId),
      });
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
      const res = await membersApi.remove(workspaceId, memberId);
      return { memberId, success: res.success };
    },
    onSuccess: ({ memberId }) => {
      queryClient.setQueryData<WorkspaceMemberDto[]>(memberKeys.list(workspaceId), old => {
        if (!old) return old;
        return old.filter(m => m.id !== memberId);
      });
      queryClient.invalidateQueries({
        queryKey: memberKeys.list(workspaceId),
      });
      toast.success('Member removed from workspace');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to remove member');
    },
  });
}
