'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  CreateLabelDto,
  LabelDto,
  LabelListQueryDto,
  UpdateLabelDto,
} from '@sales-copilot/shared-contracts';
import { labelsApi } from '@/lib/api/labels';

export function useLabels(workspaceId?: string, query?: LabelListQueryDto) {
  return useQuery<LabelDto[]>({
    queryKey: ['workspaces', workspaceId, 'labels', query],
    queryFn: async () => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await labelsApi.list(workspaceId, query);
      return res.data;
    },
    enabled: !!workspaceId,
    staleTime: 60 * 1000,
  });
}

export function useCreateLabel(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: CreateLabelDto) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await labelsApi.create(workspaceId, dto);
      return res.data;
    },
    onSuccess: newLabel => {
      queryClient.setQueriesData<LabelDto[]>(
        { queryKey: ['workspaces', workspaceId, 'labels'] },
        old => {
          if (!old) return [newLabel];
          if (old.some(l => l.id === newLabel.id)) return old;
          return [...old, newLabel];
        },
      );
      queryClient.invalidateQueries({
        queryKey: ['workspaces', workspaceId, 'labels'],
      });
      toast.success('Label created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create label');
    },
  });
}

export function useUpdateLabel(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ labelId, dto }: { labelId: string; dto: UpdateLabelDto }) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await labelsApi.update(workspaceId, labelId, dto);
      return res.data;
    },
    onSuccess: updatedLabel => {
      queryClient.setQueriesData<LabelDto[]>(
        { queryKey: ['workspaces', workspaceId, 'labels'] },
        old => {
          if (!old) return old;
          return old.map(l => (l.id === updatedLabel.id ? updatedLabel : l));
        },
      );
      queryClient.invalidateQueries({
        queryKey: ['workspaces', workspaceId, 'labels'],
      });
      toast.success('Label updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update label');
    },
  });
}

export function useDeleteLabel(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (labelId: string) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await labelsApi.delete(workspaceId, labelId);
      return { labelId, success: res.success };
    },
    onSuccess: ({ labelId }) => {
      queryClient.setQueriesData<LabelDto[]>(
        { queryKey: ['workspaces', workspaceId, 'labels'] },
        old => {
          if (!old) return old;
          return old.filter(l => l.id !== labelId);
        },
      );
      toast.success('Label deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete label');
    },
  });
}
