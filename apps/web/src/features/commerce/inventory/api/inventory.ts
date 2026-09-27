import { buildQueryString, fetchApi, workspaceHeaders } from '@/lib/api/client';
import type {
  AdjustInventoryDto,
  InventoryTransactionResponseDto,
  InventoryVariantItemDto,
  ListInventoryTransactionsQueryDto,
  ListInventoryVariantsQueryDto,
  PaginationMeta,
} from '@sales-copilot/shared-contracts';

export interface PaginatedResult<T> {
  items: T[];
  meta?: PaginationMeta;
}

function normalizePaginatedResponse<T>(res: any): {
  success: boolean;
  data: PaginatedResult<T>;
  meta?: PaginationMeta;
} {
  const rawData = res.data;
  let items: T[] = [];
  let meta: PaginationMeta | undefined = res.meta;

  if (Array.isArray(rawData)) {
    items = rawData;
  } else if (rawData && typeof rawData === 'object' && Array.isArray(rawData.items)) {
    items = rawData.items;
    meta = rawData.meta || meta;
  }

  return {
    ...res,
    data: {
      items,
      meta,
    },
    meta,
  };
}

export const inventoryApi = {
  listInventoryTransactions: (workspaceId: string, query?: ListInventoryTransactionsQueryDto) =>
    fetchApi<InventoryTransactionResponseDto[]>(
      `/workspaces/${workspaceId}/inventory/transactions${buildQueryString(query)}`,
      {
        headers: workspaceHeaders(workspaceId),
      },
    ).then(res => normalizePaginatedResponse<InventoryTransactionResponseDto>(res)),

  listInventoryVariants: (workspaceId: string, query?: ListInventoryVariantsQueryDto) =>
    fetchApi<InventoryVariantItemDto[]>(
      `/workspaces/${workspaceId}/inventory/variants${buildQueryString(query)}`,
      {
        headers: workspaceHeaders(workspaceId),
      },
    ).then(res => normalizePaginatedResponse<InventoryVariantItemDto>(res)),

  getInventorySummary: (workspaceId: string) =>
    fetchApi<{
      totalSkus: number;
      totalPhysicalStock: number;
      totalReservedStock: number;
      totalAvailableStock: number;
      lowStockSkus: number;
      outOfStockSkus: number;
    }>(`/workspaces/${workspaceId}/inventory/summary`, {
      headers: workspaceHeaders(workspaceId),
    }),

  adjustStockDirect: (workspaceId: string, variantId: string, dto: AdjustInventoryDto) =>
    fetchApi<InventoryTransactionResponseDto>(
      `/workspaces/${workspaceId}/inventory/variants/${variantId}/adjust`,
      {
        method: 'POST',
        headers: workspaceHeaders(workspaceId),
        body: JSON.stringify(dto),
      },
    ),
};
