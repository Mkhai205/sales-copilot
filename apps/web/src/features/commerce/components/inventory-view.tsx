'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { useWorkspaces } from '@/features/identity';
import { useInventoryVariants, useInventorySummary } from '../hooks/use-inventory';
import { InventorySummaryCards } from './inventory-summary-cards';
import { InventoryVariantsTable } from './inventory-variants-table';
import { StockAdjustmentDialog, TargetVariantForAdjustment } from './stock-adjustment-dialog';
import { StockLedgerDrawer } from './stock-ledger-drawer';
import { ChevronLeft, ChevronRight, RefreshCw, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InventoryViewProps {
  workspaceSlug: string;
}

export function InventoryView({ workspaceSlug }: InventoryViewProps) {
  const { data: workspaces, isLoading: isWsLoading } = useWorkspaces();
  const currentWorkspace = workspaces?.find(w => w.slug === workspaceSlug);
  const workspaceId = currentWorkspace?.id;

  // Filters & State
  const [page, setPage] = React.useState<number>(1);
  const [limit] = React.useState<number>(20);
  const [searchTerm, setSearchTerm] = React.useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = React.useState<string>('');
  const [filterMode, setFilterMode] = React.useState<'ALL' | 'LOW' | 'OUT'>('ALL');

  // Modal States
  const [adjustDialogOpen, setAdjustDialogOpen] = React.useState(false);
  const [adjustingVariant, setAdjustingVariant] = React.useState<TargetVariantForAdjustment | null>(
    null,
  );

  const [ledgerDrawerOpen, setLedgerDrawerOpen] = React.useState(false);
  const [ledgerVariant, setLedgerVariant] = React.useState<{
    id: string;
    productId?: string;
    productName: string;
    name: string;
    sku: string;
  } | null>(null);

  // 300ms Debounce
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Queries
  const {
    data: summary,
    isLoading: isSummaryLoading,
    refetch: refetchSummary,
  } = useInventorySummary(workspaceId);

  const {
    data,
    isLoading: isVariantsLoading,
    refetch: refetchVariants,
  } = useInventoryVariants(workspaceId, {
    page,
    limit,
    search: debouncedSearch || undefined,
    lowStock: filterMode === 'LOW' ? true : undefined,
    outOfStock: filterMode === 'OUT' ? true : undefined,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
  });

  const variants = data?.items || [];
  const meta = data?.meta;

  const handleRefresh = () => {
    refetchSummary();
    refetchVariants();
  };

  const handleOpenAdjust = (v: TargetVariantForAdjustment) => {
    setAdjustingVariant(v);
    setAdjustDialogOpen(true);
  };

  const handleOpenLedger = (v: {
    id: string;
    productId?: string;
    productName: string;
    name: string;
    sku: string;
  }) => {
    setLedgerVariant(v);
    setLedgerDrawerOpen(true);
  };

  if (isWsLoading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }

  if (!currentWorkspace || !workspaceId) {
    return (
      <div className="flex h-full flex-1 items-center justify-center text-sm text-muted-foreground">
        Không tìm thấy workspace.
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden p-6 gap-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">Quản Trị Tồn Kho & Sổ Kho</h1>
            <Badge variant="outline" className="text-xs px-2 py-0.5 border-primary/30 text-primary">
              Kho trung tâm
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Theo dõi tồn kho 3 trạng thái (Vật lý, Tạm giữ đơn chat, Khả dụng) và sổ cái biến động
            bất biến.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          className="h-9 gap-1.5 text-xs self-start sm:self-auto"
        >
          <RefreshCw className="size-3.5" />
          Làm mới dữ liệu
        </Button>
      </div>

      {/* KPI Metric Cards */}
      <InventorySummaryCards summary={summary} isLoading={isSummaryLoading} />

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-lg border bg-card/60">
        <div className="flex flex-1 items-center gap-2 max-w-md relative">
          <Search className="size-4 text-muted-foreground absolute left-3 pointer-events-none" />
          <Input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Tìm theo SKU, tên sản phẩm, mã vạch..."
            className="pl-9 pr-8 h-9 text-xs"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 p-0.5 rounded-lg border bg-muted/40">
          <button
            type="button"
            onClick={() => {
              setFilterMode('ALL');
              setPage(1);
            }}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
              filterMode === 'ALL'
                ? 'bg-background shadow-xs text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Tất cả SKU
          </button>
          <button
            type="button"
            onClick={() => {
              setFilterMode('LOW');
              setPage(1);
            }}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1',
              filterMode === 'LOW'
                ? 'bg-amber-500 text-white font-semibold'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span>Sắp hết</span>
            {summary && summary.lowStockSkus > 0 && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1 py-0 h-3.5 bg-black/20 text-white"
              >
                {summary.lowStockSkus}
              </Badge>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setFilterMode('OUT');
              setPage(1);
            }}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1',
              filterMode === 'OUT'
                ? 'bg-rose-600 text-white font-semibold'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span>Hết hàng</span>
            {summary && summary.outOfStockSkus > 0 && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1 py-0 h-3.5 bg-black/20 text-white"
              >
                {summary.outOfStockSkus}
              </Badge>
            )}
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="flex-1 overflow-y-auto">
        {isVariantsLoading ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground text-xs gap-2">
            <Spinner className="size-6 text-primary" />
            <span>Đang tải số liệu tồn kho...</span>
          </div>
        ) : (
          <InventoryVariantsTable
            variants={variants}
            onAdjustStock={handleOpenAdjust}
            onViewLedger={handleOpenLedger}
          />
        )}
      </div>

      {/* Pagination Footer */}
      {meta && (Number(meta.totalPages) || 1) > 1 && (
        <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
          <span>
            Trang {Number(meta.page || 1)} / {Number(meta.totalPages || 1)} (Tổng{' '}
            {Number(meta.total || 0)} biến thể)
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || isVariantsLoading}
              className="h-8 px-2 text-xs gap-1"
            >
              <ChevronLeft className="size-3.5" /> Trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p + 1)}
              disabled={!meta.hasMore || isVariantsLoading}
              className="h-8 px-2 text-xs gap-1"
            >
              Sau <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Modals & Drawers */}
      <StockAdjustmentDialog
        open={adjustDialogOpen}
        onOpenChange={setAdjustDialogOpen}
        workspaceId={workspaceId}
        variant={adjustingVariant}
        onSuccess={handleRefresh}
      />

      <StockLedgerDrawer
        open={ledgerDrawerOpen}
        onOpenChange={setLedgerDrawerOpen}
        workspaceId={workspaceId}
        variant={ledgerVariant}
      />
    </div>
  );
}
