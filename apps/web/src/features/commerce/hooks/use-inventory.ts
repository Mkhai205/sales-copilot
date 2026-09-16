'use client';

import { useQuery } from '@tanstack/react-query';
import { commerceApi } from '../api/commerce-client';
import type {
  ListInventoryTransactionsQueryDto,
  ListInventoryVariantsQueryDto,
} from '@sales-copilot/shared-contracts';

export function useInventoryVariants(workspaceId?: string, query?: ListInventoryVariantsQueryDto) {
  return useQuery({
    queryKey: ['inventory-variants', workspaceId, query],
    queryFn: async () => {
      if (!workspaceId) throw new Error('Workspace ID is required');
      const res = await commerceApi.listInventoryVariants(workspaceId, query);
      return res.data;
    },
    enabled: Boolean(workspaceId),
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useInventorySummary(workspaceId?: string) {
  return useQuery({
    queryKey: ['inventory-summary', workspaceId],
    queryFn: async () => {
      if (!workspaceId) throw new Error('Workspace ID is required');
      const res = await commerceApi.getInventorySummary(workspaceId);
      return res.data;
    },
    enabled: Boolean(workspaceId),
    staleTime: 60 * 1000,
  });
}

export function useInventoryTransactions(
  workspaceId?: string,
  query?: ListInventoryTransactionsQueryDto,
) {
  return useQuery({
    queryKey: ['inventory-transactions', workspaceId, query],
    queryFn: async () => {
      if (!workspaceId) throw new Error('Workspace ID is required');
      const res = await commerceApi.listInventoryTransactions(workspaceId, query);
      return res.data;
    },
    enabled: Boolean(workspaceId),
    staleTime: 30 * 1000,
  });
}
