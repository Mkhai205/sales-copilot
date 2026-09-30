'use client';

import * as React from 'react';
import { OrderStatus, PaymentStatus } from '@sales-copilot/shared-contracts';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  switch (status) {
    case OrderStatus.DRAFT:
      return (
        <Badge variant="secondary" className={cn('text-[11px] font-medium px-2 py-0', className)}>
          {'Bản nháp'}
        </Badge>
      );
    case OrderStatus.CONFIRMED:
      return (
        <Badge
          variant="outline"
          className={cn(
            'text-[11px] font-medium px-2 py-0 border-info/30 bg-info/10 text-info dark:text-info',
            className,
          )}
        >
          {'Đã xác nhận'}
        </Badge>
      );
    case OrderStatus.PAID:
      return (
        <Badge
          variant="outline"
          className={cn(
            'text-[11px] font-medium px-2 py-0 border-success/30 bg-success/10 text-success dark:text-success',
            className,
          )}
        >
          {'Đã thanh toán'}
        </Badge>
      );
    case OrderStatus.SHIPPING:
      return (
        <Badge
          variant="outline"
          className={cn(
            'text-[11px] font-medium px-2 py-0 border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
            className,
          )}
        >
          {'Đang giao'}
        </Badge>
      );
    case OrderStatus.COMPLETED:
      return (
        <Badge
          variant="outline"
          className={cn(
            'text-[11px] font-medium px-2 py-0 border-teal-500/30 bg-teal-500/10 text-teal-600 dark:text-teal-400',
            className,
          )}
        >
          {'Hoàn thành'}
        </Badge>
      );
    case OrderStatus.CANCELLED:
      return (
        <Badge variant="destructive" className={cn('text-[11px] font-medium px-2 py-0', className)}>
          {'Đã hủy'}
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className={cn('text-[11px]', className)}>
          {status}
        </Badge>
      );
  }
}

export function PaymentStatusBadge({
  status,
  className,
}: {
  status: PaymentStatus;
  className?: string;
}) {
  switch (status) {
    case PaymentStatus.UNPAID:
      return (
        <Badge
          variant="outline"
          className={cn(
            'text-[10px] font-normal px-1.5 py-0 border-warning/30 bg-warning/10 text-warning dark:text-warning',
            className,
          )}
        >
          {'Chưa thanh toán'}
        </Badge>
      );
    case PaymentStatus.PARTIALLY_PAID:
      return (
        <Badge
          variant="outline"
          className={cn(
            'text-[10px] font-normal px-1.5 py-0 border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400',
            className,
          )}
        >
          {'Thanh toán 1 phần'}
        </Badge>
      );
    case PaymentStatus.PAID:
      return (
        <Badge
          variant="outline"
          className={cn(
            'text-[10px] font-normal px-1.5 py-0 border-success/30 bg-success/10 text-success dark:text-success',
            className,
          )}
        >
          {'Đã thanh toán'}
        </Badge>
      );
    case PaymentStatus.REFUNDED:
      return (
        <Badge
          variant="outline"
          className={cn(
            'text-[10px] font-normal px-1.5 py-0 border-destructive/30 bg-destructive/10 text-destructive dark:text-destructive',
            className,
          )}
        >
          {'Đã hoàn tiền'}
        </Badge>
      );
    default:
      return null;
  }
}
