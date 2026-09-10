'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  PlatformWorkspaceDetailDto,
  PlatformWorkspaceListItemDto,
  PaginationMeta,
  QueryPlatformWorkspacesDto,
  ToggleWorkspaceStatusDto,
  UpdateWorkspacePlanDto,
} from '@sales-copilot/shared-contracts';
import { platformAdminApi } from '@/lib/api/platform-admin';

export interface UsePlatformWorkspacesResult {
  items: PlatformWorkspaceListItemDto[];
  meta?: PaginationMeta;
}

/**
 * React Query hook to fetch paginated workspaces list with search and filter support.
 */
export function usePlatformWorkspaces(params?: Partial<QueryPlatformWorkspacesDto>) {
  return useQuery<UsePlatformWorkspacesResult>({
    queryKey: ['platform-admin', 'workspaces', params],
    queryFn: async () => {
      const res = await platformAdminApi.getWorkspaces(params);
      return {
        items: res.data ?? [],
        meta: res.meta,
      };
    },
    staleTime: 15_000,
  });
}

/**
 * React Query hook to fetch full technical details of a workspace.
 */
export function usePlatformWorkspaceDetail(id?: string) {
  return useQuery<PlatformWorkspaceDetailDto>({
    queryKey: ['platform-admin', 'workspaces', 'detail', id],
    queryFn: async () => {
      if (!id) throw new Error('Workspace ID is required');
      const res = await platformAdminApi.getWorkspaceDetail(id);
      return res.data;
    },
    enabled: Boolean(id),
    staleTime: 15_000,
  });
}

export interface UpdateWorkspacePlanParams {
  id: string;
  payload: UpdateWorkspacePlanDto;
}

/**
 * React Query mutation hook to update workspace billing plan and/or quotas.
 */
export function useUpdateWorkspacePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: UpdateWorkspacePlanParams) => {
      const res = await platformAdminApi.updateWorkspacePlan(id, payload);
      return res.data;
    },
    onSuccess: (data, variables) => {
      toast.success(`Cập nhật gói cước cho "${data.name}" thành công`);
      queryClient.invalidateQueries({ queryKey: ['platform-admin', 'workspaces'] });
      queryClient.setQueryData(['platform-admin', 'workspaces', 'detail', variables.id], data);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Cập nhật gói cước thất bại');
    },
  });
}

export interface ToggleWorkspaceStatusParams {
  id: string;
  payload: ToggleWorkspaceStatusDto;
}

/**
 * React Query mutation hook to suspend or activate a workspace.
 */
export function useToggleWorkspaceStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: ToggleWorkspaceStatusParams) => {
      const res = await platformAdminApi.toggleWorkspaceStatus(id, payload);
      return res.data;
    },
    onSuccess: (data, variables) => {
      const actionText = variables.payload.isSuspended ? 'Tạm khóa' : 'Kích hoạt lại';
      toast.success(`${actionText} workspace "${data.name}" thành công`);
      queryClient.invalidateQueries({ queryKey: ['platform-admin', 'workspaces'] });
      queryClient.setQueryData(['platform-admin', 'workspaces', 'detail', variables.id], data);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Thao tác trạng thái workspace thất bại');
    },
  });
}
