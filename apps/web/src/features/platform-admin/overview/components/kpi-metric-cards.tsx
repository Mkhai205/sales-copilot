'use client';

import * as React from 'react';
import { Building2, Users, Activity, Clock } from 'lucide-react';
import type { PlatformMetricsOverviewDto } from '@sales-copilot/shared-contracts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  calculateActiveRatio,
  getHealthBadgeConfig,
  formatMetricNumber,
  formatAverageNumber,
} from '../utils/overview-helpers';
import { cn } from '@/lib/utils';

export interface KpiMetricCardsProps {
  metrics: PlatformMetricsOverviewDto;
}

export function KpiMetricCards({ metrics }: KpiMetricCardsProps) {
  const activeRatio = calculateActiveRatio(metrics.activeWorkspaces, metrics.totalWorkspaces);
  const avgUsersPerWs =
    metrics.activeWorkspaces > 0
      ? formatAverageNumber(metrics.totalUsers / metrics.activeWorkspaces)
      : '0';

  const pgConfig = getHealthBadgeConfig(metrics.systemHealth?.postgres);
  const redisConfig = getHealthBadgeConfig(metrics.systemHealth?.redis);
  const storageConfig = metrics.systemHealth?.storage
    ? getHealthBadgeConfig(metrics.systemHealth.storage)
    : null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Card 1: Quản trị Workspaces */}
      <Card className="flex flex-col justify-between border-border bg-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
              <Building2 className="size-5" />
            </div>
            <Badge variant="outline" className="text-xs font-semibold text-muted-foreground">
              {activeRatio}% hoạt động
            </Badge>
          </div>
          <CardTitle className="text-sm font-medium text-muted-foreground mt-2">
            Doanh nghiệp (Workspaces)
          </CardTitle>
          <div className="text-2xl font-bold tracking-tight text-foreground">
            {formatMetricNumber(metrics.totalWorkspaces)}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pt-0">
          <Progress value={activeRatio} className="h-2 w-full" />
          <div className="flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="size-2 rounded-full bg-emerald-500" />
              Đang hoạt động: {formatMetricNumber(metrics.activeWorkspaces)}
            </span>
            <span className="inline-flex items-center gap-1.5 text-destructive font-medium">
              <span className="size-2 rounded-full bg-destructive" />
              Tạm khóa: {formatMetricNumber(metrics.suspendedWorkspaces)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Người dùng Nền tảng */}
      <Card className="flex flex-col justify-between border-border bg-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex size-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
              <Users className="size-5" />
            </div>
            <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
              Toàn hệ thống
            </Badge>
          </div>
          <CardTitle className="text-sm font-medium text-muted-foreground mt-2">
            Người dùng Nền tảng
          </CardTitle>
          <div className="text-2xl font-bold tracking-tight text-foreground">
            {formatMetricNumber(metrics.totalUsers)}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 pt-0">
          <CardDescription className="text-xs">
            Trung bình ~<span className="font-semibold text-foreground">{avgUsersPerWs}</span> người
            dùng / workspace đang hoạt động
          </CardDescription>
          <p className="text-[11px] text-muted-foreground mt-1">
            Bao gồm chủ cửa hàng, quản lý và nhân viên tư vấn bán hàng.
          </p>
        </CardContent>
      </Card>

      {/* Card 3: Trạng thái Dịch vụ Hạ tầng */}
      <Card className="flex flex-col justify-between border-border bg-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <Activity className="size-5" />
            </div>
            <Badge
              variant="outline"
              className="flex items-center gap-1 text-[11px] text-muted-foreground font-normal"
            >
              <Clock className="size-3" />
              <span>Polling 30s</span>
            </Badge>
          </div>
          <CardTitle className="text-sm font-medium text-muted-foreground mt-2">
            Trạng thái Hạ tầng Hệ thống
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 pt-0">
          {/* PostgreSQL */}
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">PostgreSQL Database</span>
            <Badge
              variant={pgConfig.variant}
              className={cn('gap-1.5 text-[11px] font-medium', pgConfig.className)}
            >
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  pgConfig.dotClass,
                  pgConfig.pulse && 'animate-pulse',
                )}
              />
              {pgConfig.label}
            </Badge>
          </div>

          {/* Redis */}
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">Redis Cache & Queues</span>
            <Badge
              variant={redisConfig.variant}
              className={cn('gap-1.5 text-[11px] font-medium', redisConfig.className)}
            >
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  redisConfig.dotClass,
                  redisConfig.pulse && 'animate-pulse',
                )}
              />
              {redisConfig.label}
            </Badge>
          </div>

          {/* MinIO / S3 Storage */}
          {storageConfig && (
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">MinIO / S3 Storage</span>
              <Badge
                variant={storageConfig.variant}
                className={cn('gap-1.5 text-[11px] font-medium', storageConfig.className)}
              >
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    storageConfig.dotClass,
                    storageConfig.pulse && 'animate-pulse',
                  )}
                />
                {storageConfig.label}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
