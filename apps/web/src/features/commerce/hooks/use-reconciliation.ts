'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { reconciliationKeys, commerceKeys } from '@/lib/query-keys';
import { reconciliationApi } from '../api/reconciliation-client';
import type {
  ListReconciliationTransactionsQueryDto,
  ManualMatchTransactionDto,
  ReconciliationStatsQueryDto,
} from '@sales-copilot/shared-contracts';

export function useReconciliationTransactions(
  workspaceId?: string,
  query?: ListReconciliationTransactionsQueryDto,
) {
  return useQuery({
    queryKey: reconciliationKeys.transactions(workspaceId, query),
    queryFn: async () => {
      if (!workspaceId) throw new Error('Workspace ID is required');
      const res = await reconciliationApi.listTransactions(workspaceId, query);
      return res.data;
    },
    enabled: Boolean(workspaceId),
  });
}

export function useReconciliationStats(workspaceId?: string, query?: ReconciliationStatsQueryDto) {
  return useQuery({
    queryKey: reconciliationKeys.stats(workspaceId, query),
    queryFn: async () => {
      if (!workspaceId) throw new Error('Workspace ID is required');
      const res = await reconciliationApi.getStats(workspaceId, query);
      return res.data;
    },
    enabled: Boolean(workspaceId),
  });
}

export function useManualMatchTransaction(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      transactionId,
      dto,
    }: {
      transactionId: string;
      dto: ManualMatchTransactionDto;
    }) => {
      if (!workspaceId) throw new Error('Workspace ID is required');
      return reconciliationApi.manualMatch(workspaceId, transactionId, dto);
    },
    onSuccess: (_, variables) => {
      toast.success('Đối soát và gán đơn hàng thành công!');
      if (workspaceId) {
        queryClient.invalidateQueries({
          queryKey: reconciliationKeys.transactions(workspaceId),
        });
        queryClient.invalidateQueries({
          queryKey: reconciliationKeys.stats(workspaceId),
        });
        queryClient.invalidateQueries({
          queryKey: commerceKeys.orders(workspaceId),
        });
        queryClient.invalidateQueries({
          queryKey: commerceKeys.order(workspaceId, variables.dto.orderId),
        });
      }
    },
    onError: (err: any) => {
      toast.error(err.message || 'Không thể đối soát giao dịch này');
    },
  });
}
