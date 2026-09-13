'use client';

import * as React from 'react';
import { OrderStatus, PaymentStatus } from '@sales-copilot/shared-contracts';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

export function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  const { t } = useI18n();

  switch (status) {
    case OrderStatus.DRAFT:
      return (
        <Badge variant="secondary" className={cn('text-[11px] font-medium px-2 py-0', className)}>
          {t('pos.status.draft')}
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
          {t('pos.status.confirmed')}
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
          {t('pos.status.paid')}
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
          {t('pos.status.shipping')}
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
          {t('pos.status.completed')}
        </Badge>
      );
    case OrderStatus.CANCELLED:
      return (
        <Badge variant="destructive" className={cn('text-[11px] font-medium px-2 py-0', className)}>
          {t('pos.status.cancelled')}
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
  const { t } = useI18n();

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
          {t('pos.payment.unpaid')}
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
          {t('pos.payment.partial')}
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
          {t('pos.payment.paid')}
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
          {t('pos.payment.refunded')}
        </Badge>
      );
    default:
      return null;
  }
}
