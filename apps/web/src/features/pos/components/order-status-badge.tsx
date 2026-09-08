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
          Bản nháp
        </Badge>
      );
    case OrderStatus.CONFIRMED:
      return (
        <Badge
          variant="outline"
          className={cn(
            'text-[11px] font-medium px-2 py-0 border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400',
            className,
          )}
        >
          Đã xác nhận
        </Badge>
      );
    case OrderStatus.PAID:
      return (
        <Badge
          variant="outline"
          className={cn(
            'text-[11px] font-medium px-2 py-0 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
            className,
          )}
        >
          Đã thanh toán
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
          Đang giao
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
          Hoàn thành
        </Badge>
      );
    case OrderStatus.CANCELLED:
      return (
        <Badge variant="destructive" className={cn('text-[11px] font-medium px-2 py-0', className)}>
          Đã hủy
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
            'text-[10px] font-normal px-1.5 py-0 border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
            className,
          )}
        >
          Chưa trả
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
          Đã cọc
        </Badge>
      );
    case PaymentStatus.PAID:
      return (
        <Badge
          variant="outline"
          className={cn(
            'text-[10px] font-normal px-1.5 py-0 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
            className,
          )}
        >
          Đủ tiền
        </Badge>
      );
    case PaymentStatus.REFUNDED:
      return (
        <Badge
          variant="outline"
          className={cn(
            'text-[10px] font-normal px-1.5 py-0 border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400',
            className,
          )}
        >
          Hoàn trả
        </Badge>
      );
    default:
      return null;
  }
}
