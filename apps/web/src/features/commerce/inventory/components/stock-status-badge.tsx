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
        {'Hết hàng'}
      </Badge>
    );
  }

  if (availableStock <= 5) {
    return (
      <Badge
        variant="outline"
        className={cn(
          'text-[10px] font-medium px-1.5 py-0 h-4 shrink-0 border border-warning/30 bg-warning/10 text-warning dark:text-warning',
          className,
        )}
      >
        {showCount ? `Sắp hết hàng (${availableStock})` : 'Sắp hết hàng'}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[10px] font-medium px-1.5 py-0 h-4 shrink-0 border border-success/30 bg-success/10 text-success dark:text-success',
        className,
      )}
    >
      {showCount ? `Còn hàng (${availableStock})` : 'Còn hàng'}
    </Badge>
  );
}
