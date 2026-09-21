'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { formatVND } from '@/features/commerce/lib/currency';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import type { ReconciliationStatsResponseDto } from '@sales-copilot/shared-contracts';

interface ReconciliationSummaryBarProps {
  stats?: ReconciliationStatsResponseDto;
  isLoading?: boolean;
}

export function ReconciliationSummaryBar({
  stats,
  isLoading = false,
}: ReconciliationSummaryBarProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-3 w-24 bg-muted rounded" />
                <div className="h-6 w-32 bg-muted rounded" />
                <div className="h-3 w-20 bg-muted rounded" />
              </div>
              <div className="h-10 w-10 bg-muted rounded-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: 'Đã đối soát',
      subtitle: `${stats?.reconciled?.count ?? 0} giao dịch thành công`,
      amount: stats?.reconciled?.totalAmount ?? 0,
      icon: CheckCircle2,
      textColor: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
      borderColor: 'border-emerald-200/60 dark:border-emerald-800/40',
    },
    {
      title: 'Chờ đối soát',
      subtitle: `${stats?.pending?.count ?? 0} giao dịch chưa khớp đơn`,
      amount: stats?.pending?.totalAmount ?? 0,
      icon: Clock,
      textColor: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-950/30',
      borderColor: 'border-amber-200/60 dark:border-amber-800/40',
    },
    {
      title: 'Thất bại / Đã hủy',
      subtitle: `${stats?.failed?.count ?? 0} giao dịch không hợp lệ`,
      amount: stats?.failed?.totalAmount ?? 0,
      icon: XCircle,
      textColor: 'text-rose-600 dark:text-rose-400',
      bgColor: 'bg-rose-50 dark:bg-rose-950/30',
      borderColor: 'border-rose-200/60 dark:border-rose-800/40',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((item, index) => {
        const Icon = item.icon;
        return (
          <Card key={index} className={`border ${item.borderColor} shadow-2xs`}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {item.title}
                </p>
                <p className={`text-xl font-bold tracking-tight ${item.textColor}`}>
                  {formatVND(item.amount)}
                </p>
                <p className="text-xs text-muted-foreground">{item.subtitle}</p>
              </div>
              <div
                className={`p-3 rounded-full flex items-center justify-center ${item.bgColor} ${item.textColor}`}
              >
                <Icon className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
