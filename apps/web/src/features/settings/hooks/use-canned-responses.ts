'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  CannedResponseDto,
  CannedResponseListQueryDto,
  CreateCannedResponseDto,
  UpdateCannedResponseDto,
} from '@sales-copilot/shared-contracts';
import { cannedResponsesApi } from '@/lib/api/canned-responses';

export function useCannedResponses(workspaceId?: string, query?: CannedResponseListQueryDto) {
  return useQuery<CannedResponseDto[]>({
    queryKey: ['workspaces', workspaceId, 'canned-responses', query],
    queryFn: async () => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await cannedResponsesApi.list(workspaceId, query);
      return res.data;
    },
    enabled: !!workspaceId,
    staleTime: 60 * 1000,
  });
}

export function useCreateCannedResponse(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: CreateCannedResponseDto) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await cannedResponsesApi.create(workspaceId, dto);
      return res.data;
    },
    onSuccess: newItem => {
      queryClient.setQueriesData<CannedResponseDto[]>(
        { queryKey: ['workspaces', workspaceId, 'canned-responses'] },
        old => {
          if (!old) return [newItem];
          if (old.some(i => i.id === newItem.id)) return old;
          return [...old, newItem];
        },
      );
      queryClient.invalidateQueries({
        queryKey: ['workspaces', workspaceId, 'canned-responses'],
      });
      toast.success('Canned response created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create canned response');
    },
  });
}

export function useUpdateCannedResponse(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateCannedResponseDto }) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await cannedResponsesApi.update(workspaceId, id, dto);
      return res.data;
    },
    onSuccess: updatedItem => {
      queryClient.setQueriesData<CannedResponseDto[]>(
        { queryKey: ['workspaces', workspaceId, 'canned-responses'] },
        old => {
          if (!old) return old;
          return old.map(i => (i.id === updatedItem.id ? updatedItem : i));
        },
      );
      queryClient.invalidateQueries({
        queryKey: ['workspaces', workspaceId, 'canned-responses'],
      });
      toast.success('Canned response updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update canned response');
    },
  });
}

export function useDeleteCannedResponse(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await cannedResponsesApi.delete(workspaceId, id);
      return { id, success: res.success };
    },
    onSuccess: ({ id }) => {
      queryClient.setQueriesData<CannedResponseDto[]>(
        { queryKey: ['workspaces', workspaceId, 'canned-responses'] },
        old => {
          if (!old) return old;
          return old.filter(i => i.id !== id);
        },
      );
      toast.success('Canned response deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete canned response');
    },
  });
}
