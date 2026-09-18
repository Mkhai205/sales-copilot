'use client';

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { formatVND } from '@/features/commerce/lib/currency';
import {
  Eye,
  MoreHorizontal,
  Printer,
  CheckCircle2,
  XCircle,
  MessageSquare,
  ShoppingBag,
} from 'lucide-react';
import Link from 'next/link';

function formatDateTime(dateInput: Date | string): string {
  try {
    const d = new Date(dateInput);
    return d.toLocaleString('vi-VN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(dateInput);
  }
}

export interface OrdersTableProps {
  orders: OrderResponseDto[];
  isLoading?: boolean;
  workspaceId: string;
  workspaceSlug: string;
  onSelectOrder: (order: OrderResponseDto) => void;
  onPrintOrder: (order: OrderResponseDto, format?: 'K80' | 'K58') => void;
  onCompleteOrder: (order: OrderResponseDto) => void;
  onCancelOrder: (order: OrderResponseDto) => void;
}

export function OrdersTable({
  orders,
  isLoading = false,
  workspaceId: _workspaceId,
  workspaceSlug,
  onSelectOrder,
  onPrintOrder,
  onCompleteOrder,
  onCancelOrder,
}: OrdersTableProps) {
  if (isLoading) {
    return (
      <div className="rounded-md border bg-card overflow-hidden shadow-2xs">
        <Table>
          <TableHeader className="bg-muted/40 text-[11px]">
            <TableRow>
              <TableHead className="w-28">{'Mã đơn'}</TableHead>
              <TableHead className="min-w-[160px]">{'Người nhận'}</TableHead>
              <TableHead className="w-36">{'Điện thoại'}</TableHead>
              <TableHead className="w-28">{'Sản phẩm'}</TableHead>
              <TableHead className="w-32 text-right">{'Tổng thanh toán'}</TableHead>
              <TableHead className="w-24 text-center">{'Phương thức'}</TableHead>
              <TableHead className="w-28 text-center">{'Trạng thái'}</TableHead>
              <TableHead className="w-28 text-center">{'Thanh toán'}</TableHead>
              <TableHead className="w-36">{'Ngày tạo'}</TableHead>
              <TableHead className="w-20 text-right">{'Thao tác'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, idx) => (
              <TableRow key={idx}>
                {Array.from({ length: 10 }).map((_, cIdx) => (
                  <TableCell key={cIdx} className="py-3">
                    <div className="h-4 w-full bg-muted/60 animate-pulse rounded" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground border rounded-lg bg-card/40">
        <ShoppingBag className="size-10 opacity-30 mb-3" />
        <h3 className="text-sm font-semibold text-foreground">{'Không có đơn hàng nào phù hợp'}</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          {'Thử thay đổi bộ lọc hoặc tạo đơn hàng mới'}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card overflow-hidden shadow-2xs">
      <Table>
        <TableHeader className="bg-muted/40 text-[11px]">
          <TableRow>
            <TableHead className="w-28">{'Mã đơn'}</TableHead>
            <TableHead className="min-w-[160px]">{'Người nhận'}</TableHead>
            <TableHead className="w-36">{'Điện thoại'}</TableHead>
            <TableHead className="w-28">{'Sản phẩm'}</TableHead>
            <TableHead className="w-32 text-right">{'Tổng thanh toán'}</TableHead>
            <TableHead className="w-24 text-center">{'Phương thức'}</TableHead>
            <TableHead className="w-28 text-center">{'Trạng thái'}</TableHead>
            <TableHead className="w-28 text-center">{'Thanh toán'}</TableHead>
            <TableHead className="w-36">{'Ngày tạo'}</TableHead>
            <TableHead className="w-20 text-right">{'Thao tác'}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="text-xs">
          {orders.map(order => {
            const customerName = order.shippingAddress?.recipientName || 'Không có';
            const phoneNumber = order.shippingAddress?.phoneNumber || '';
            const itemsCount = order.items?.length || 0;
            const firstItemName = order.items?.[0]?.productName || '';

            const canComplete =
              order.status === OrderStatus.CONFIRMED ||
              order.status === OrderStatus.PAID ||
              order.status === OrderStatus.SHIPPING;
            const canCancel =
              order.status !== OrderStatus.COMPLETED && order.status !== OrderStatus.CANCELLED;

            return (
              <TableRow
                key={order.id}
                className="hover:bg-muted/30 transition-colors cursor-pointer group"
                onClick={() => onSelectOrder(order)}
              >
                {/* Order ID */}
                <TableCell className="py-2.5 font-mono">
                  <span className="font-semibold text-primary group-hover:underline">
                    {order.displayId || order.orderNumber}
                  </span>
                </TableCell>

                {/* Customer */}
                <TableCell className="py-2.5">
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground line-clamp-1">{customerName}</span>
                    {order.shippingAddress?.province && (
                      <span className="text-[11px] text-muted-foreground line-clamp-1">
                        {order.shippingAddress.province}
                      </span>
                    )}
                  </div>
                </TableCell>

                {/* Phone & Telco */}
                <TableCell className="py-2.5">
                  {phoneNumber ? (
                    <span className="font-mono text-xs">{phoneNumber}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>

                {/* Items */}
                <TableCell className="py-2.5">
                  <div className="flex flex-col">
                    <span className="font-medium">{`${itemsCount} sản phẩm`}</span>
                    {firstItemName && (
                      <span className="text-[11px] text-muted-foreground line-clamp-1">
                        {firstItemName}
                      </span>
                    )}
                  </div>
                </TableCell>

                {/* Total Amount */}
                <TableCell className="py-2.5 text-right font-mono font-semibold">
                  {formatVND(Number(order.totalAmount || 0))}
                </TableCell>

                {/* Order Status */}
                <TableCell className="py-2.5 text-center">
                  <OrderStatusBadge status={order.status} />
                </TableCell>

                {/* Payment Status */}
                <TableCell className="py-2.5 text-center">
                  <PaymentStatusBadge status={order.paymentStatus} />
                </TableCell>

                {/* Created At */}
                <TableCell className="py-2.5 text-muted-foreground whitespace-nowrap">
                  {formatDateTime(order.createdAt)}
                </TableCell>

                {/* Actions */}
                <TableCell className="py-2.5 text-right" onClick={e => e.stopPropagation()}>
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

                      <DropdownMenuItem
                        onClick={() => onPrintOrder(order, 'K80')}
                        className="gap-2 cursor-pointer"
                      >
                        <Printer className="size-3.5 text-muted-foreground" />
                        <span>{'In phiếu gửi (K80)'}</span>
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => onPrintOrder(order, 'K58')}
                        className="gap-2 cursor-pointer"
                      >
                        <Printer className="size-3.5 text-muted-foreground" />
                        <span>{'In hóa đơn (K58)'}</span>
                      </DropdownMenuItem>

                      {order.conversationId && (
                        <DropdownMenuItem asChild className="gap-2 cursor-pointer">
                          <Link
                            href={`/${workspaceSlug}/inbox?conversationId=${order.conversationId}`}
                          >
                            <MessageSquare className="size-3.5 text-muted-foreground" />
                            <span>{'Xem hội thoại'}</span>
                          </Link>
                        </DropdownMenuItem>
                      )}

                      {(canComplete || canCancel) && <DropdownMenuSeparator />}

                      {canComplete && (
                        <DropdownMenuItem
                          onClick={() => onCompleteOrder(order)}
                          className="gap-2 text-emerald-600 focus:text-emerald-600 cursor-pointer"
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
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
