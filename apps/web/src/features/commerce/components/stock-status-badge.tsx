'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

interface StockStatusBadgeProps {
  availableStock: number;
  className?: string;
  showCount?: boolean;
}

export function StockStatusBadge({
  availableStock,
  className,
  showCount = true,
}: StockStatusBadgeProps) {
  const { t } = useI18n();

  if (availableStock <= 0) {
    return (
      <Badge
        variant="destructive"
        className={cn('text-[10px] font-medium px-1.5 py-0 h-4 shrink-0', className)}
      >
        {t('commerce.stock.outOfStock')}
      </Badge>
    );
  }

  if (availableStock <= 5) {
    return (
      <Badge
        variant="outline"
        className={cn(
          'text-[10px] font-medium px-1.5 py-0 h-4 shrink-0 border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
          className,
        )}
      >
        {showCount
          ? `${t('commerce.stock.lowStock')} (${availableStock})`
          : t('commerce.stock.lowStock')}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[10px] font-medium px-1.5 py-0 h-4 shrink-0 border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        className,
      )}
    >
      {showCount
        ? `${t('commerce.stock.inStock')} (${availableStock})`
        : t('commerce.stock.inStock')}
    </Badge>
  );
}
