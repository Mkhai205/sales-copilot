'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { WorkspacePaymentSettings } from '@sales-copilot/shared-contracts';
import { workspacesApi } from '../api/workspaces';
import { workspaceKeys } from '@/lib/query-keys';

export function useBankSettings(workspaceId?: string) {
  return useQuery<WorkspacePaymentSettings>({
    queryKey: workspaceKeys.bankConfig(workspaceId),
    queryFn: async () => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await workspacesApi.getBankConfig(workspaceId);
      return res.data;
    },
    enabled: !!workspaceId,
    staleTime: 60 * 1000,
  });
}

export function useUpdateBankSettings(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: WorkspacePaymentSettings) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await workspacesApi.updateBankConfig(workspaceId, dto);
      return res.data;
    },
    onSuccess: updatedConfig => {
      queryClient.setQueryData(workspaceKeys.bankConfig(workspaceId), updatedConfig);
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.bankConfig(workspaceId),
      });
      toast.success('Đã lưu cấu hình ngân hàng & thanh toán thành công!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Lưu cấu hình thất bại. Vui lòng thử lại!');
    },
  });
}
