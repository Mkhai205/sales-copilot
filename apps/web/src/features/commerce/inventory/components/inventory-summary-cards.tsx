'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Boxes, CheckCircle2, Lock, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InventorySummaryCardsProps {
  summary?: {
    totalSkus: number;
    totalPhysicalStock: number;
    totalReservedStock: number;
    totalAvailableStock: number;
    lowStockSkus: number;
    outOfStockSkus: number;
  } | null;
  isLoading?: boolean;
}

export function InventorySummaryCards({ summary, isLoading }: InventorySummaryCardsProps) {
  const cards = [
    {
      title: 'Tổng SKU Biến Thể',
      value: summary?.totalSkus ?? 0,
      icon: Boxes,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Tồn Kho Vật Lý',
      value: summary?.totalPhysicalStock ?? 0,
      icon: Package,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Đang Tạm Giữ (Đơn Chat)',
      value: summary?.totalReservedStock ?? 0,
      icon: Lock,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-500/10',
    },
    {
      title: 'Tồn Khả Dụng Bán',
      value: summary?.totalAvailableStock ?? 0,
      icon: CheckCircle2,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-500/10',
    },
    {
      title: 'Sắp Hết / Hết Hàng',
      value: (summary?.lowStockSkus ?? 0) + (summary?.outOfStockSkus ?? 0),
      subtitle: `${summary?.outOfStockSkus ?? 0} hết hàng • ${summary?.lowStockSkus ?? 0} sắp hết`,
      icon: AlertCircle,
      color: 'text-rose-600 dark:text-rose-400',
      bgColor: 'bg-rose-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <Card key={idx} className="p-3 shadow-2xs border">
            <CardContent className="p-0 flex flex-col justify-between h-full gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground truncate">
                  {card.title}
                </span>
                <div className={cn('p-1.5 rounded-md', card.bgColor)}>
                  <Icon className={cn('size-3.5', card.color)} />
                </div>
              </div>

              <div>
                <span className="text-xl font-bold tracking-tight">
                  {isLoading ? '...' : card.value.toLocaleString('vi-VN')}
                </span>
                {card.subtitle && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    {card.subtitle}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
