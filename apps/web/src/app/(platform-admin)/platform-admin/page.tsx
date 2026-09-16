'use client';

import * as React from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  usePlatformMetricsOverview,
  KpiMetricCards,
  QuickShortcuts,
} from '@/features/platform-admin';
import { useI18n } from '@/lib/i18n';

export default function AdminOverviewPage() {
  const { t } = useI18n();
  const {
    data: metrics,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = usePlatformMetricsOverview();

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t('admin.overview.centerTitle')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('admin.overview.centerSubtitle')}</p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2 text-xs"
          >
            <RefreshCw className={isFetching ? 'size-3.5 animate-spin' : 'size-3.5'} />
            <span>{t('common.refresh')}</span>
          </Button>
        </div>
      </div>

      {/* Main Body States */}
      {isLoading ? (
        <div className="flex flex-col gap-6">
          {/* Skeleton KPI Cards */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5"
              >
                <div className="flex items-center justify-between">
                  <Skeleton className="size-10 rounded-lg" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="h-4 w-32 mt-2" />
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-3 w-full mt-1" />
              </div>
            ))}
          </div>

          {/* Skeleton Quick Shortcuts */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5"
              >
                <Skeleton className="size-10 rounded-lg" />
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-8 w-full mt-4 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      ) : isError ? (
        <Alert variant="destructive" className="flex flex-col gap-2 p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4" />
            <AlertTitle>{t('admin.overview.loadMetricsFailed')}</AlertTitle>
          </div>
          <AlertDescription className="mt-1">
            {error?.message || t('admin.overview.connectError')}
          </AlertDescription>
          <div className="mt-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} className="text-xs">
              {t('common.retry')}
            </Button>
          </div>
        </Alert>
      ) : metrics ? (
        <div className="flex flex-col gap-6">
          {/* Reactive KPI Metric Cards */}
          <KpiMetricCards metrics={metrics} />

          {/* Quick Navigation Shortcuts */}
          <div className="flex flex-col gap-3 pt-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {t('admin.overview.quickShortcutsTitle')}
            </h2>
            <QuickShortcuts />
          </div>
        </div>
      ) : null}
    </div>
  );
}
