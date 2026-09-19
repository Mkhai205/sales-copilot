'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  ShoppingBag,
  MessageSquare,
  Users,
  Bot,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import type { DashboardSummaryDto } from '@sales-copilot/shared-contracts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { formatVND } from '@/features/commerce/lib/currency';

interface KpiCardsProps {
  summary?: DashboardSummaryDto;
  isLoading: boolean;
  workspaceSlug: string;
}

export function KpiCards({ summary, isLoading, workspaceSlug }: KpiCardsProps) {
  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, idx) => (
          <Card key={idx} className="shadow-xs border-border/80">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-3 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const { orders, conversations, contacts, aiCopilot } = summary;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {/* 1. Doanh thu hôm nay */}
      <Card className="shadow-xs border-border/80 transition-shadow hover:shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium text-muted-foreground">
            Doanh thu hôm nay
          </CardTitle>
          <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="size-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold tracking-tight text-foreground truncate">
            {formatVND(orders.totalRevenueToday)}
          </div>
          <p className="mt-1 text-xs text-muted-foreground truncate">
            Thực thu:{' '}
            <span className="font-medium text-foreground">
              {formatVND(orders.paidRevenueToday)}
            </span>
          </p>
        </CardContent>
      </Card>

      {/* 2. Đơn hàng hôm nay */}
      <Card className="shadow-xs border-border/80 transition-shadow hover:shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium text-muted-foreground">
            Đơn hàng hôm nay
          </CardTitle>
          <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <ShoppingBag className="size-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold tracking-tight text-foreground">
            {orders.totalOrdersToday}{' '}
            <span className="text-sm font-normal text-muted-foreground">đơn</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {orders.totalOrdersToday > 0 ? 'Đang được xử lý & giao' : 'Chưa có đơn phát sinh'}
          </p>
        </CardContent>
      </Card>

      {/* 3. Cuộc hội thoại mới */}
      <Card className="shadow-xs border-border/80 transition-shadow hover:shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium text-muted-foreground">Hội thoại mới</CardTitle>
          <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <MessageSquare className="size-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold tracking-tight text-foreground">
            {conversations.newConversationsToday}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Khách gửi tin nhắn mới hôm nay</p>
        </CardContent>
      </Card>

      {/* 4. Khách hàng mới */}
      <Card className="shadow-xs border-border/80 transition-shadow hover:shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium text-muted-foreground">
            Khách hàng mới
          </CardTitle>
          <div className="flex size-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
            <Users className="size-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold tracking-tight text-foreground">
            {contacts.newContactsToday}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Danh bạ liên hệ được thêm mới</p>
        </CardContent>
      </Card>

      {/* 5. Trợ lý AI Copilot */}
      <Card className="shadow-xs border-border/80 transition-shadow hover:shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            AI Copilot
          </CardTitle>
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bot className="size-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {aiCopilot.isActive ? (
              <Badge
                variant="outline"
                className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 text-[11px] font-medium"
              >
                <span className="size-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                Hoạt động
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[11px] font-medium">
                Tạm dừng
              </Badge>
            )}
            <span className="text-xs text-muted-foreground truncate">
              {aiCopilot.enabledInboxesCount}/{aiCopilot.totalInboxesCount} inbox
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-1">
            <p className="text-xs text-muted-foreground truncate">
              Đã xử lý{' '}
              <span className="font-semibold text-foreground">
                {aiCopilot.handledConversationsToday}
              </span>{' '}
              chat
            </p>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-muted-foreground hover:text-foreground shrink-0"
              asChild
              title="Cài đặt AI"
            >
              <Link href={`/${workspaceSlug}/settings/inboxes`}>
                <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
