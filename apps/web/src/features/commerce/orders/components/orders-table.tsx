'use client';

import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { OrderStatusBadge, PaymentStatusBadge } from './order-status-badge';
import { OrderStatus, type OrderResponseDto } from '@sales-copilot/shared-contracts';
import { formatVND } from '@/features/commerce/shared/lib/currency';
import {
  Eye,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  MessageSquare,
  ShoppingBag,
} from 'lucide-react';
import Link from 'next/link';
import { formatDateTime } from '@/lib/format-date';
import { DataTable } from '@/components/data-table/data-table';

export interface OrdersTableProps {
  orders: OrderResponseDto[];
  isLoading?: boolean;
  workspaceId: string;
  workspaceSlug: string;
  onSelectOrder: (order: OrderResponseDto) => void;
  onPrintOrder?: (order: OrderResponseDto, format?: 'K80' | 'K58') => void;
  onCompleteOrder: (order: OrderResponseDto) => void;
  onCancelOrder: (order: OrderResponseDto) => void;
}

export function OrdersTable({
  orders,
  isLoading = false,
  workspaceId: _workspaceId,
  workspaceSlug,
  onSelectOrder,
  onPrintOrder: _onPrintOrder,
  onCompleteOrder,
  onCancelOrder,
}: OrdersTableProps) {
  const columns = React.useMemo<ColumnDef<OrderResponseDto, any>[]>(
    () => [
      {
        header: 'Mã đơn',
        meta: { headerClassName: 'w-28' },
        cell: ({ row }) => (
          <span className="font-mono font-semibold text-primary order-id">
            {row.original.displayId || row.original.orderNumber}
          </span>
        ),
      },
      {
        header: 'Người nhận',
        meta: { headerClassName: 'min-w-[160px]' },
        cell: ({ row }) => {
          const order = row.original;
          const customerName = order.shippingAddress?.recipientName || 'Không có';
          return (
            <div className="flex flex-col">
              <span className="font-medium text-foreground line-clamp-1">{customerName}</span>
              {order.shippingAddress?.province && (
                <span className="text-[11px] text-muted-foreground line-clamp-1">
                  {order.shippingAddress.province}
                </span>
              )}
            </div>
          );
        },
      },
      {
        header: 'Điện thoại',
        meta: { headerClassName: 'w-36' },
        cell: ({ row }) => {
          const phoneNumber = row.original.shippingAddress?.phoneNumber || '';
          return phoneNumber ? (
            <span className="font-mono text-xs">{phoneNumber}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      {
        header: 'Sản phẩm',
        meta: { headerClassName: 'w-28' },
        cell: ({ row }) => {
          const order = row.original;
          const itemsCount = order.items?.length || 0;
          const firstItemName = order.items?.[0]?.productName || '';
          return (
            <div className="flex flex-col">
              <span className="font-medium">{`${itemsCount} sản phẩm`}</span>
              {firstItemName && (
                <span className="text-[11px] text-muted-foreground line-clamp-1">
                  {firstItemName}
                </span>
              )}
            </div>
          );
        },
      },
      {
        header: 'Tổng thanh toán',
        meta: { headerClassName: 'w-32 text-right' },
        cell: ({ row }) => (
          <div className="text-right font-mono font-semibold">
            {formatVND(Number(row.original.totalAmount || 0))}
          </div>
        ),
      },
      {
        header: 'Trạng thái',
        meta: { headerClassName: 'w-28 text-center' },
        cell: ({ row }) => (
          <div className="text-center">
            <OrderStatusBadge status={row.original.status} />
          </div>
        ),
      },
      {
        header: 'Thanh toán',
        meta: { headerClassName: 'w-28 text-center' },
        cell: ({ row }) => (
          <div className="text-center">
            <PaymentStatusBadge status={row.original.paymentStatus} />
          </div>
        ),
      },
      {
        header: 'Ngày tạo',
        meta: { headerClassName: 'w-36' },
        cell: ({ row }) => (
          <span className="text-muted-foreground whitespace-nowrap">
            {formatDateTime(row.original.createdAt)}
          </span>
        ),
      },
      {
        header: 'Thao tác',
        meta: { headerClassName: 'w-20 text-right' },
        cell: ({ row }) => {
          const order = row.original;
          const canComplete =
            order.status === OrderStatus.CONFIRMED ||
            order.status === OrderStatus.PAID ||
            order.status === OrderStatus.SHIPPING;
          const canCancel =
            order.status !== OrderStatus.COMPLETED && order.status !== OrderStatus.CANCELLED;

          return (
            <div className="flex justify-end" onClick={e => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="cursor-pointer text-muted-foreground hover:text-foreground"
                  >
                    <MoreHorizontal className="size-4" />
                    <span className="sr-only">{'Hành động'}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={() => onSelectOrder(order)}
                    className="gap-2 cursor-pointer"
                  >
                    <Eye className="size-3.5 text-muted-foreground" />
                    <span>{'Xem chi tiết'}</span>
                  </DropdownMenuItem>

                  {order.conversationId && (
                    <DropdownMenuItem asChild className="gap-2 cursor-pointer">
                      <Link href={`/${workspaceSlug}/inbox?conversationId=${order.conversationId}`}>
                        <MessageSquare className="size-3.5 text-muted-foreground" />
                        <span>{'Xem hội thoại'}</span>
                      </Link>
                    </DropdownMenuItem>
                  )}

                  {(canComplete || canCancel) && <DropdownMenuSeparator />}

                  {canComplete && (
                    <DropdownMenuItem
                      onClick={() => onCompleteOrder(order)}
                      className="gap-2 text-success focus:text-success cursor-pointer"
                    >
                      <CheckCircle2 className="size-3.5" />
                      <span>{'Hoàn tất đơn'}</span>
                    </DropdownMenuItem>
                  )}

                  {canCancel && (
                    <DropdownMenuItem
                      onClick={() => onCancelOrder(order)}
                      className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                    >
                      <XCircle className="size-3.5" />
                      <span>{'Hủy đơn hàng'}</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [workspaceSlug, onSelectOrder, onCompleteOrder, onCancelOrder],
  );

  return (
    <DataTable
      data={orders}
      columns={columns}
      isLoading={isLoading}
      skeletonRows={5}
      getRowKey={order => order.id}
      onRowClick={onSelectOrder}
      className="rounded-md border bg-card overflow-hidden shadow-2xs [&_thead]:bg-muted/40 [&_thead]:text-[11px] [&_td]:py-2.5 [&_tbody_tr:hover_.order-id]:underline"
      emptyState={{
        icon: <ShoppingBag className="size-10 opacity-30" />,
        title: 'Không có đơn hàng nào phù hợp',
        description: 'Thử thay đổi bộ lọc hoặc tạo đơn hàng mới',
      }}
    />
  );
}
