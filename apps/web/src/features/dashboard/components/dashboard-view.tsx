'use client';

import * as React from 'react';
import { RefreshCw, AlertCircle, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useDashboardSummary } from '../hooks/use-dashboard-summary';
import { KpiCards } from './kpi-cards';

interface DashboardViewProps {
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
}

export function DashboardView({ workspaceId, workspaceSlug, workspaceName }: DashboardViewProps) {
  const { data: summary, isLoading, isFetching, error, refetch } = useDashboardSummary(workspaceId);

  // Format today's date in Vietnamese locale
  const formattedToday = React.useMemo(() => {
    try {
      const now = new Date();
      return new Intl.DateTimeFormat('vi-VN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(now);
    } catch {
      return '';
    }
  }, []);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-background p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        {/* Header Section */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Tổng quan hoạt động
            </h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="size-3.5" />
              <span className="capitalize">{formattedToday}</span>
              <span>•</span>
              <span className="font-medium text-foreground">{workspaceName}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-8.5 text-xs font-medium cursor-pointer"
            >
              <RefreshCw className={`mr-1.5 size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              Làm mới
            </Button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Không thể tải dữ liệu tổng quan</AlertTitle>
            <AlertDescription className="mt-1 flex items-center justify-between text-xs">
              <span>
                {error instanceof Error ? error.message : 'Đã có lỗi xảy ra khi kết nối máy chủ.'}
              </span>
              <Button
                variant="outline"
                size="xs"
                onClick={() => refetch()}
                className="bg-background text-foreground hover:bg-muted"
              >
                Thử lại
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* KPI Cards Grid */}
        <KpiCards summary={summary} isLoading={isLoading} workspaceSlug={workspaceSlug} />
      </div>
    </div>
  );
}
