import { buildQueryString, fetchApi, workspaceHeaders } from '@/lib/api/client';
import type {
  ListReconciliationTransactionsQueryDto,
  ManualMatchTransactionDto,
  PaymentTransactionResponseDto,
  ReconciliationStatsQueryDto,
  ReconciliationStatsResponseDto,
  PaginationMeta,
} from '@sales-copilot/shared-contracts';

export interface PaginatedTransactionsResult {
  items: PaymentTransactionResponseDto[];
  meta?: PaginationMeta;
}

export const reconciliationApi = {
  listTransactions: async (
    workspaceId: string,
    query?: ListReconciliationTransactionsQueryDto,
  ): Promise<{ success: boolean; data: PaginatedTransactionsResult; meta?: PaginationMeta }> => {
    const res = await fetchApi<any>(
      `/workspaces/${workspaceId}/reconciliation/transactions${buildQueryString(query)}`,
      {
        headers: workspaceHeaders(workspaceId),
      },
    );

    const rawData = res.data;
    let items: PaymentTransactionResponseDto[] = [];
    let meta: PaginationMeta | undefined = res.meta;

    if (Array.isArray(rawData)) {
      items = rawData;
    } else if (rawData && typeof rawData === 'object' && Array.isArray(rawData.items)) {
      items = rawData.items;
      meta = rawData.meta || meta;
    }

    return {
      success: res.success ?? true,
      data: {
        items,
        meta,
      },
      meta,
    };
  },

  getStats: async (
    workspaceId: string,
    query?: ReconciliationStatsQueryDto,
  ): Promise<{ success: boolean; data: ReconciliationStatsResponseDto }> => {
    return fetchApi<ReconciliationStatsResponseDto>(
      `/workspaces/${workspaceId}/reconciliation/stats${buildQueryString(query)}`,
      {
        headers: workspaceHeaders(workspaceId),
      },
    );
  },

  manualMatch: async (
    workspaceId: string,
    transactionId: string,
    dto: ManualMatchTransactionDto,
  ): Promise<{
    success: boolean;
    data: { transaction: PaymentTransactionResponseDto; order: any };
  }> => {
    return fetchApi<{ transaction: PaymentTransactionResponseDto; order: any }>(
      `/workspaces/${workspaceId}/reconciliation/transactions/${transactionId}/manual-match`,
      {
        method: 'POST',
        headers: workspaceHeaders(workspaceId),
        body: JSON.stringify(dto),
      },
    );
  },
};
