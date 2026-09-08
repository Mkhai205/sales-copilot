'use client';

import * as React from 'react';
import { type OrderResponseDto } from '@sales-copilot/shared-contracts';
import { Package, Calendar, ChevronRight } from 'lucide-react';
import { OrderStatusBadge, PaymentStatusBadge } from './order-status-badge';
import { Button } from '@/components/ui/button';

interface OrderHistoryListProps {
  orders: OrderResponseDto[];
  activeOrderId?: string;
  onSelectOrder?: (order: OrderResponseDto) => void;
}

export function OrderHistoryList({ orders, activeOrderId, onSelectOrder }: OrderHistoryListProps) {
  const formatCurrency = (val: number | string) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(Number(val));
  };

  const formatDate = (dateVal: any) => {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (orders.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-muted-foreground">
        Chưa có lịch sử đơn hàng nào
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-border/60">
      {orders.map(order => {
        const isActive = order.id === activeOrderId;
        const itemCount =
          order.items?.reduce((acc, it) => acc + Number(it.quantity || 1), 0) ||
          order.items?.length ||
          0;

        return (
          <div
            key={order.id}
            className={`p-2.5 flex flex-col gap-1.5 transition-colors hover:bg-muted/40 text-xs ${
              isActive ? 'bg-muted/30 border-l-2 border-primary' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Package className="size-3.5 text-muted-foreground" />#{order.displayId}{' '}
                <span className="text-[11px] text-muted-foreground font-mono">
                  ({order.orderNumber})
                </span>
              </span>
              <div className="flex items-center gap-1">
                <OrderStatusBadge status={order.status} />
                <PaymentStatusBadge status={order.paymentStatus} />
              </div>
            </div>

            <div className="flex items-center justify-between text-muted-foreground text-[11px]">
              <span className="flex items-center gap-1">
                <Calendar className="size-3" />
                {formatDate(order.createdAt)}
              </span>
              <span>{itemCount} sản phẩm</span>
              <span className="font-bold text-foreground">{formatCurrency(order.totalAmount)}</span>
            </div>

            {onSelectOrder && (
              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px] text-primary gap-1"
                  onClick={() => onSelectOrder(order)}
                >
                  Xem chi tiết <ChevronRight className="size-3" />
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
