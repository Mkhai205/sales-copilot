import { buildQueryString, fetchApi, workspaceHeaders } from '@/lib/api/client';
import type {
  AdjustInventoryDto,
  InventoryTransactionResponseDto,
  InventoryVariantItemDto,
  ListInventoryTransactionsQueryDto,
  ListInventoryVariantsQueryDto,
} from '@sales-copilot/shared-contracts';
import { normalizePaginatedResponse } from '@/lib/api/pagination';

export const inventoryApi = {
  listInventoryTransactions: (workspaceId: string, query?: ListInventoryTransactionsQueryDto) =>
    fetchApi<InventoryTransactionResponseDto[]>(
      `/inventory/transactions${buildQueryString(query)}`,
      {
        headers: workspaceHeaders(workspaceId),
      },
    ).then(res => normalizePaginatedResponse<InventoryTransactionResponseDto>(res)),

  listInventoryVariants: (workspaceId: string, query?: ListInventoryVariantsQueryDto) =>
    fetchApi<InventoryVariantItemDto[]>(`/inventory/variants${buildQueryString(query)}`, {
      headers: workspaceHeaders(workspaceId),
    }).then(res => normalizePaginatedResponse<InventoryVariantItemDto>(res)),

  getInventorySummary: (workspaceId: string) =>
    fetchApi<{
      totalSkus: number;
      totalPhysicalStock: number;
      totalReservedStock: number;
      totalAvailableStock: number;
      lowStockSkus: number;
      outOfStockSkus: number;
    }>(`/inventory/summary`, {
      headers: workspaceHeaders(workspaceId),
    }),

  adjustStockDirect: (workspaceId: string, variantId: string, dto: AdjustInventoryDto) =>
    fetchApi<InventoryTransactionResponseDto>(`/inventory/variants/${variantId}/adjust`, {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),
};
