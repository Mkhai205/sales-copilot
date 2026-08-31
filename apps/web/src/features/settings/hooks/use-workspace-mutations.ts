'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  UpdateWorkspaceDto,
  WorkspaceDto,
  UserWorkspaceDto,
} from '@sales-copilot/shared-contracts';
import { workspacesApi } from '@/lib/api/workspaces';

export function useCurrentWorkspaceDetails(workspaceId?: string) {
  return useQuery<WorkspaceDto>({
    queryKey: ['workspaces', 'current', workspaceId],
    queryFn: async () => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await workspacesApi.getCurrent(workspaceId);
      return res.data;
    },
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateWorkspace(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: UpdateWorkspaceDto) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await workspacesApi.updateCurrent(workspaceId, dto);
      return res.data;
    },
    onSuccess: (updatedWorkspace: WorkspaceDto) => {
      // 1. Update current workspace query data
      queryClient.setQueryData(['workspaces', 'current', workspaceId], updatedWorkspace);

      // 2. Update list in 'workspaces' query
      queryClient.setQueryData<UserWorkspaceDto[]>(['workspaces'], old => {
        if (!old) return old;
        return old.map(ws => (ws.id === updatedWorkspace.id ? { ...ws, ...updatedWorkspace } : ws));
      });

      // 3. Invalidate to ensure freshness
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });

      toast.success('Workspace settings updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update workspace settings');
    },
  });
}
