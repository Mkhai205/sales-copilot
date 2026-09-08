'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
  if (availableStock <= 0) {
    return (
      <Badge
        variant="destructive"
        className={cn('text-[10px] font-medium px-1.5 py-0 h-4 shrink-0', className)}
      >
        Hết hàng
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
        {showCount ? `Sắp hết (${availableStock})` : 'Sắp hết'}
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
      {showCount ? `Còn hàng (${availableStock})` : 'Còn hàng'}
    </Badge>
  );
}
