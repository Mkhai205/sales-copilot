'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/page-header';
import { useWorkspaces } from '@/features/settings';
import { WsServerEvent, WorkspaceRole } from '@sales-copilot/shared-contracts';
import { useSocketEvent } from '@/lib/socket/use-socket';
import { formatVND } from '../lib/currency';
import { reconciliationKeys, commerceKeys } from '@/lib/query-keys';
import { commerceApi } from '../api/commerce-client';
import { useReconciliationTransactions, useReconciliationStats } from '../hooks/use-reconciliation';
import { ReconciliationSummaryBar } from './reconciliation-summary-bar';
import {
  ReconciliationFilterToolbar,
  type ReconciliationFilterValues,
} from './reconciliation-filter-toolbar';
import { ReconciliationLedgerTable } from './reconciliation-ledger-table';
import { ManualMatchDialog } from './manual-match-dialog';
import { TransactionDetailSheet } from './transaction-detail-sheet';
import { OrderDetailSheet } from './order-detail-sheet';
import { toast } from 'sonner';
import type { PaymentTransactionResponseDto } from '@sales-copilot/shared-contracts';

interface ReconciliationViewProps {
  workspaceSlug: string;
}

export function ReconciliationView({ workspaceSlug }: ReconciliationViewProps) {
  const queryClient = useQueryClient();
  const { data: workspaces } = useWorkspaces();
  const currentWorkspace = workspaces?.find(w => w.slug === workspaceSlug);
  const workspaceId = currentWorkspace?.id;

  const isOwnerOrAdmin =
    currentWorkspace?.role === WorkspaceRole.OWNER ||
    currentWorkspace?.role === WorkspaceRole.ADMIN;

  // Filter & Pagination State
  const [filters, setFilters] = React.useState<ReconciliationFilterValues>({
    search: '',
    status: 'ALL',
    datePreset: 'all',
  });
  const [page, setPage] = React.useState(1);
  const limit = 20;

  const handleFilterChange = React.useCallback(
    (newFilters: Partial<ReconciliationFilterValues>) => {
      setFilters(prev => ({ ...prev, ...newFilters }));
      setPage(1);
    },
    [],
  );

  // Queries
  const queryParams = React.useMemo(
    () => ({
      page,
      limit,
      search: filters.search || undefined,
      status: filters.status && filters.status !== 'ALL' ? (filters.status as any) : undefined,
      from: filters.from,
      to: filters.to,
    }),
    [page, limit, filters.search, filters.status, filters.from, filters.to],
  );

  const statsParams = React.useMemo(
    () => ({
      from: filters.from,
      to: filters.to,
    }),
    [filters.from, filters.to],
  );

  const {
    data: transactionsData,
    isLoading: isLoadingTransactions,
    isFetching: isFetchingTransactions,
    refetch: refetchTransactions,
  } = useReconciliationTransactions(workspaceId, queryParams);

  const {
    data: statsData,
    isLoading: isLoadingStats,
    refetch: refetchStats,
  } = useReconciliationStats(workspaceId, statsParams);

  const handleRefresh = React.useCallback(() => {
    refetchTransactions();
    refetchStats();
  }, [refetchTransactions, refetchStats]);

  // Real-time socket events
  useSocketEvent<any>(WsServerEvent.PAYMENT_TRANSACTION_CREATED, data => {
    if (!data || (workspaceId && data.workspaceId !== workspaceId)) return;

    const amountStr = data.amount ? formatVND(data.amount) : '';
    toast.info(`Biến động số dư mới: +${amountStr}`, {
      description: data.transferContent || 'Giao dịch chuyển khoản ngân hàng mới',
    });

    if (workspaceId) {
      queryClient.invalidateQueries({ queryKey: reconciliationKeys.transactions(workspaceId) });
      queryClient.invalidateQueries({ queryKey: reconciliationKeys.stats(workspaceId) });
      queryClient.invalidateQueries({ queryKey: commerceKeys.orders(workspaceId) });
    }
  });

  useSocketEvent<any>(WsServerEvent.PAYMENT_TRANSACTION_UPDATED, data => {
    if (!data || (workspaceId && data.workspaceId !== workspaceId)) return;

    if (workspaceId) {
      queryClient.invalidateQueries({ queryKey: reconciliationKeys.transactions(workspaceId) });
      queryClient.invalidateQueries({ queryKey: reconciliationKeys.stats(workspaceId) });
      queryClient.invalidateQueries({ queryKey: commerceKeys.orders(workspaceId) });
      if (data.orderId) {
        queryClient.invalidateQueries({ queryKey: commerceKeys.order(workspaceId, data.orderId) });
      }
    }
  });

  // Modal states
  const [selectedTxForDetail, setSelectedTxForDetail] =
    React.useState<PaymentTransactionResponseDto | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = React.useState(false);

  const [selectedTxForMatch, setSelectedTxForMatch] =
    React.useState<PaymentTransactionResponseDto | null>(null);
  const [matchDialogOpen, setMatchDialogOpen] = React.useState(false);

  const [selectedOrderId, setSelectedOrderId] = React.useState<string | null>(null);
  const [orderSheetOpen, setOrderSheetOpen] = React.useState(false);

  // Fetch selected order details when order sheet is open
  const { data: selectedOrderRes } = useQuery({
    queryKey: commerceKeys.order(workspaceId, selectedOrderId || undefined),
    queryFn: async () => {
      if (!workspaceId || !selectedOrderId) return null;
      const res = await commerceApi.getOrder(workspaceId, selectedOrderId);
      return res.data;
    },
    enabled: Boolean(workspaceId && selectedOrderId && orderSheetOpen),
  });

  const handleOpenDetail = (tx: PaymentTransactionResponseDto) => {
    setSelectedTxForDetail(tx);
    setDetailSheetOpen(true);
  };

  const handleOpenManualMatch = (tx: PaymentTransactionResponseDto) => {
    setSelectedTxForMatch(tx);
    setMatchDialogOpen(true);
  };

  const handleOpenOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    setOrderSheetOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col space-y-6 p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <PageHeader
        title="Đối soát Ngân hàng (Bank Reconciliation)"
        description="Theo dõi biến động số dư VietQR/SePay, tự động khớp mã đơn và gạch nợ tức thì."
      />

      {/* Summary KPI Bar */}
      <ReconciliationSummaryBar stats={statsData} isLoading={isLoadingStats} />

      {/* Filter Toolbar */}
      <ReconciliationFilterToolbar
        filters={filters}
        onFilterChange={handleFilterChange}
        onRefresh={handleRefresh}
        isFetching={isFetchingTransactions}
      />

      {/* Transactions Ledger Table */}
      <ReconciliationLedgerTable
        transactions={transactionsData?.items || []}
        meta={transactionsData?.meta}
        isLoading={isLoadingTransactions}
        onPageChange={setPage}
        onSelectTransaction={handleOpenDetail}
        onManualMatch={handleOpenManualMatch}
        onSelectOrder={handleOpenOrder}
        isOwnerOrAdmin={isOwnerOrAdmin}
      />

      {/* Manual Match Dialog */}
      {workspaceId && (
        <ManualMatchDialog
          open={matchDialogOpen}
          onOpenChange={setMatchDialogOpen}
          transaction={selectedTxForMatch}
          workspaceId={workspaceId}
        />
      )}

      {/* Transaction Detail Sheet */}
      <TransactionDetailSheet
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        transaction={selectedTxForDetail}
        onOpenOrderSheet={handleOpenOrder}
        onOpenManualMatch={handleOpenManualMatch}
        isOwnerOrAdmin={isOwnerOrAdmin}
      />

      {/* Order Detail Sheet */}
      {workspaceId && (
        <OrderDetailSheet
          open={orderSheetOpen}
          onOpenChange={setOrderSheetOpen}
          order={selectedOrderRes || null}
          workspaceId={workspaceId}
          workspaceSlug={workspaceSlug}
          onOrderUpdated={handleRefresh}
        />
      )}
    </div>
  );
}
