'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { useWorkspaces } from '@/features/settings';
import { commerceApi } from '../api/commerce-client';
import { useProductMutations } from '../hooks/use-product-mutations';
import { ProductsTable } from './products-table';
import { ProductDialog } from './product-dialog';
import { StockAdjustmentDialog, TargetVariantForAdjustment } from './stock-adjustment-dialog';
import { StockLedgerDrawer } from './stock-ledger-drawer';
import type { ProductResponseDto } from '@sales-copilot/shared-contracts';
import { AlertTriangle, ChevronLeft, ChevronRight, Plus, Search, Tag, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/layout/page-header';

interface ProductsViewProps {
  workspaceSlug: string;
}

export function ProductsView({ workspaceSlug }: ProductsViewProps) {
  const { data: workspaces, isLoading: isWsLoading } = useWorkspaces();
  const currentWorkspace = workspaces?.find(w => w.slug === workspaceSlug);
  const workspaceId = currentWorkspace?.id;

  const { deleteProduct } = useProductMutations(workspaceId);

  // Filters & Pagination state
  const [page, setPage] = React.useState<number>(1);
  const [limit] = React.useState<number>(20);
  const [searchTerm, setSearchTerm] = React.useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = React.useState<string>('');
  const [selectedCategory, setSelectedCategory] = React.useState<string>('');
  const [lowStockFilter, setLowStockFilter] = React.useState<boolean>(false);

  // Modal states
  const [productDialogOpen, setProductDialogOpen] = React.useState(false);
  const [editingProduct, setEditingProduct] = React.useState<ProductResponseDto | null>(null);

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

  // 300ms Search Debounce
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: [
      'commerce-products',
      workspaceId,
      page,
      limit,
      debouncedSearch,
      selectedCategory,
      lowStockFilter,
    ],
    queryFn: async () => {
      if (!workspaceId) throw new Error('Workspace ID is required');
      const res = await commerceApi.listProducts(workspaceId, {
        page,
        limit,
        search: debouncedSearch || undefined,
        category: selectedCategory || undefined,
        lowStock: lowStockFilter || undefined,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      return res.data;
    },
    enabled: Boolean(workspaceId),
    staleTime: 60 * 1000,
  });

  const products = data?.items || [];
  const meta = data?.meta;

  // Extract unique categories for filter pills
  const categories = React.useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.category) set.add(p.category);
    }
    return Array.from(set);
  }, [products]);

  const handleCreateNew = () => {
    setEditingProduct(null);
    setProductDialogOpen(true);
  };

  const handleEdit = (prod: ProductResponseDto) => {
    setEditingProduct(prod);
    setProductDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bạn có chắc chắn muốn lưu trữ/ẩn sản phẩm này?')) {
      await deleteProduct(id);
    }
  };

  const handleOpenAdjustStock = (variant: TargetVariantForAdjustment) => {
    setAdjustingVariant(variant);
    setAdjustDialogOpen(true);
  };

  const handleOpenLedger = (variant: {
    id: string;
    productId?: string;
    productName: string;
    name: string;
    sku: string;
  }) => {
    setLedgerVariant(variant);
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
      <PageHeader
        title="Danh Mục Sản Phẩm"
        description="Quản lý bảng giá bán lẻ, giá vốn, danh mục và cấu hình ma trận biến thể SKU."
        icon={Tag}
        actions={
          <div className="flex items-center gap-2">
            {meta?.total !== undefined && (
              <Badge variant="secondary" className="text-xs font-mono px-2 py-0.5">
                {meta.total} sản phẩm
              </Badge>
            )}
            <Button size="sm" onClick={handleCreateNew} className="h-9 gap-1.5 text-xs font-medium">
              <Plus className="size-4" />
              Thêm sản phẩm
            </Button>
          </div>
        }
      />

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-lg border bg-card/60">
        <div className="flex flex-1 items-center gap-2 max-w-md relative">
          <Search className="size-4 text-muted-foreground absolute left-3 pointer-events-none" />
          <Input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên, mã SKU, mã vạch..."
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

        <div className="flex items-center gap-2 flex-wrap">
          {/* Low stock filter toggle */}
          <Button
            type="button"
            variant={lowStockFilter ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setLowStockFilter(prev => !prev);
              setPage(1);
            }}
            className={cn(
              'h-8 text-xs gap-1.5',
              lowStockFilter && 'bg-amber-600 hover:bg-amber-700 text-white',
            )}
          >
            <AlertTriangle className="size-3.5" />
            Sắp hết hàng
          </Button>

          {/* Category Filter */}
          {categories.length > 0 && (
            <div className="flex items-center gap-1 overflow-x-auto py-0.5">
              {categories.map(cat => (
                <Badge
                  key={cat}
                  variant={selectedCategory === cat ? 'default' : 'outline'}
                  onClick={() => {
                    setSelectedCategory(prev => (prev === cat ? '' : cat));
                    setPage(1);
                  }}
                  className="cursor-pointer text-[11px] px-2 py-0.5 transition-colors"
                >
                  <Tag className="size-2.5 mr-1" />
                  {cat}
                </Badge>
              ))}
              {selectedCategory && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory('')}
                  className="text-[11px] text-muted-foreground hover:text-foreground underline px-1"
                >
                  Xóa lọc
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Table */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground text-xs gap-2">
            <Spinner className="size-6 text-primary" />
            <span>Đang tải danh mục sản phẩm...</span>
          </div>
        ) : (
          <ProductsTable
            products={products}
            workspaceId={workspaceId}
            onEditProduct={handleEdit}
            onDeleteProduct={handleDelete}
            onAdjustStock={handleOpenAdjustStock}
            onViewLedger={handleOpenLedger}
          />
        )}
      </div>

      {/* Pagination Footer */}
      {meta && (Number(meta.totalPages) || 1) > 1 && (
        <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
          <span>
            Trang {Number(meta.page || 1)} / {Number(meta.totalPages || 1)} (Tổng{' '}
            {Number(meta.total || 0)} mục)
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="h-8 px-2 text-xs gap-1"
            >
              <ChevronLeft className="size-3.5" /> Trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p + 1)}
              disabled={!meta.hasMore || isLoading}
              className="h-8 px-2 text-xs gap-1"
            >
              Sau <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Modals & Drawers */}
      <ProductDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        workspaceId={workspaceId}
        product={editingProduct}
        onSuccess={() => refetch()}
      />

      <StockAdjustmentDialog
        open={adjustDialogOpen}
        onOpenChange={setAdjustDialogOpen}
        workspaceId={workspaceId}
        variant={adjustingVariant}
        onSuccess={() => refetch()}
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
