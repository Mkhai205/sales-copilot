'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useWorkspaces } from '@/features/identity';
import { commerceApi } from '../api/commerce-client';
import { useCommerceOrders } from '../hooks/use-commerce-orders';
import { useCommerceRealtimeSync } from '../hooks/use-commerce-realtime-sync';
import { OrdersTable } from './orders-table';
import { OrderDetailSheet } from './order-detail-sheet';
import { CreateOrderDialog } from './create-order-dialog';
import { ThermalPrintDialog } from './thermal-print-dialog';
import { OrderStatus, PaymentStatus, type OrderResponseDto } from '@sales-copilot/shared-contracts';
import { ChevronLeft, ChevronRight, Plus, RefreshCw, Search, ShoppingBag, X } from 'lucide-react';

interface OrdersViewProps {
  workspaceSlug: string;
}

export function OrdersView({ workspaceSlug }: OrdersViewProps) {
  const { data: workspaces } = useWorkspaces();
  const currentWorkspace = workspaces?.find(w => w.slug === workspaceSlug);
  const workspaceId = currentWorkspace?.id;

  // Realtime multi-agent sync
  useCommerceRealtimeSync({ workspaceId });

  // Filter & Pagination State
  const [activeTab, setActiveTab] = React.useState<string>('ALL');
  const [paymentFilter, setPaymentFilter] = React.useState<string>('ALL');
  const [searchTerm, setSearchTerm] = React.useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = React.useState<string>('');
  const [page, setPage] = React.useState<number>(1);
  const [limit] = React.useState<number>(20);

  // Modals / Dialogs / Sheets
  const [createDialogOpen, setCreateDialogOpen] = React.useState<boolean>(false);
  const [selectedOrder, setSelectedOrder] = React.useState<OrderResponseDto | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState<boolean>(false);
  const [printDialogOpen, setPrintDialogOpen] = React.useState<boolean>(false);
  const [printOrder, setPrintOrder] = React.useState<OrderResponseDto | null>(null);
  const [printFormat, setPrintFormat] = React.useState<'K80' | 'K58'>('K80');

  const { completeOrder } = useCommerceOrders(workspaceId);

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Query orders
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: [
      'commerce-orders',
      workspaceId,
      page,
      limit,
      activeTab,
      paymentFilter,
      debouncedSearch,
    ],
    queryFn: async () => {
      if (!workspaceId) throw new Error('Workspace ID is required');
      const res = await commerceApi.listOrders(workspaceId, {
        page,
        limit,
        status: activeTab !== 'ALL' ? (activeTab as OrderStatus) : undefined,
        paymentStatus: paymentFilter !== 'ALL' ? (paymentFilter as PaymentStatus) : undefined,
        search: debouncedSearch || undefined,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      return res.data;
    },
    enabled: Boolean(workspaceId),
    staleTime: 30 * 1000,
  });

  const orders = data?.items || [];
  const meta = data?.meta;

  const handleSelectOrder = (order: OrderResponseDto) => {
    setSelectedOrder(order);
    setSheetOpen(true);
  };

  const handlePrintOrder = (order: OrderResponseDto, format: 'K80' | 'K58' = 'K80') => {
    setPrintOrder(order);
    setPrintFormat(format);
    setPrintDialogOpen(true);
  };

  const handleCompleteOrder = async (order: OrderResponseDto) => {
    try {
      await completeOrder({ orderId: order.id });
      refetch();
    } catch {
      // Handled in mutation toast
    }
  };

  const handleCancelOrder = (order: OrderResponseDto) => {
    setSelectedOrder(order);
    setSheetOpen(true);
  };

  return (
    <div className="flex flex-col flex-1 h-full overflow-y-auto bg-background p-6 gap-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/70">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShoppingBag className="size-5 text-primary" />
            <span>{'Quản lý Đơn hàng'}</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {'Theo dõi toàn bộ đơn hàng đa kênh, trạng thái giữ kho và vận chuyển'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-8 text-xs gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>{'Làm mới'}</span>
          </Button>

          {workspaceId && (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => setCreateDialogOpen(true)}
              className="h-8 text-xs font-semibold gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>{'Tạo đơn hàng mới'}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Lifecycle Status Tabs */}
      <div className="flex items-center overflow-x-auto pb-1">
        <Tabs
          value={activeTab}
          onValueChange={val => {
            setActiveTab(val);
            setPage(1);
          }}
          className="w-full"
        >
          <TabsList className="h-9 p-1 bg-muted/60">
            <TabsTrigger value="ALL" className="text-xs px-3">
              {'Tất cả'}
            </TabsTrigger>
            <TabsTrigger value={OrderStatus.DRAFT} className="text-xs px-3">
              {'Bản nháp'}
            </TabsTrigger>
            <TabsTrigger value={OrderStatus.CONFIRMED} className="text-xs px-3">
              {'Đã xác nhận'}
            </TabsTrigger>
            <TabsTrigger value={OrderStatus.PAID} className="text-xs px-3">
              {'Đã thanh toán'}
            </TabsTrigger>
            <TabsTrigger value={OrderStatus.SHIPPING} className="text-xs px-3">
              {'Đang giao'}
            </TabsTrigger>
            <TabsTrigger value={OrderStatus.COMPLETED} className="text-xs px-3">
              {'Hoàn thành'}
            </TabsTrigger>
            <TabsTrigger value={OrderStatus.CANCELLED} className="text-xs px-3">
              {'Đã hủy'}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Search & Payment Filter Row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder={'Tìm theo mã đơn, người nhận, số điện thoại...'}
            className="pl-8 text-xs h-9"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={paymentFilter}
            onValueChange={val => {
              setPaymentFilter(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 text-xs w-[170px]">
              <SelectValue placeholder={'Thanh toán'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{'Tất cả thanh toán'}</SelectItem>
              <SelectItem value={PaymentStatus.UNPAID}>{'Chưa thanh toán'}</SelectItem>
              <SelectItem value={PaymentStatus.PARTIALLY_PAID}>{'Thanh toán 1 phần'}</SelectItem>
              <SelectItem value={PaymentStatus.PAID}>{'Đã thanh toán'}</SelectItem>
              <SelectItem value={PaymentStatus.REFUNDED}>{'Đã hoàn tiền'}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Orders Table */}
      {workspaceId && (
        <OrdersTable
          orders={orders}
          isLoading={isLoading}
          workspaceId={workspaceId}
          workspaceSlug={workspaceSlug}
          onSelectOrder={handleSelectOrder}
          onPrintOrder={handlePrintOrder}
          onCompleteOrder={handleCompleteOrder}
          onCancelOrder={handleCancelOrder}
        />
      )}

      {/* Pagination Footer */}
      {meta && (meta.totalPages ?? 0) > 1 && (
        <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
          <div>
            <span>
              Trang {meta.page} / {meta.totalPages} ({meta.total} đơn)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="cursor-pointer"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              onClick={() => setPage(p => Math.min(meta.totalPages ?? 1, p + 1))}
              disabled={page >= (meta.totalPages ?? 1) || isLoading}
              className="cursor-pointer"
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Order Detail Sheet */}
      {workspaceId && (
        <OrderDetailSheet
          order={selectedOrder}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          workspaceId={workspaceId}
          workspaceSlug={workspaceSlug}
          onOrderUpdated={() => refetch()}
        />
      )}

      {/* Create Order Dialog */}
      {workspaceId && (
        <CreateOrderDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          workspaceId={workspaceId}
          onOrderCreated={newOrder => {
            refetch();
            setSelectedOrder(newOrder);
            setSheetOpen(true);
          }}
        />
      )}

      {/* Thermal Print Dialog */}
      {workspaceId && printOrder && (
        <ThermalPrintDialog
          open={printDialogOpen}
          onOpenChange={setPrintDialogOpen}
          workspaceId={workspaceId}
          orderId={printOrder.id}
          defaultFormat={printFormat}
        />
      )}
    </div>
  );
}
