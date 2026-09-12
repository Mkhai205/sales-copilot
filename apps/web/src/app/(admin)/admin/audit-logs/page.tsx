'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ScrollText, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePlatformAuditLogs } from '@/features/platform-admin/audit-logs/hooks/use-platform-audit-logs';
import { AuditLogFilterToolbar } from '@/features/platform-admin/audit-logs/components/audit-log-filter-toolbar';
import { AuditLogsTable } from '@/features/platform-admin/audit-logs/components/audit-logs-table';
import { AuditLogDiffDialog } from '@/features/platform-admin/audit-logs/components/audit-log-diff-dialog';
import {
  isValidDateFilterRange,
  normalizeDateFilterRange,
} from '@/features/platform-admin/audit-logs/utils/audit-log-helpers';
import type {
  PlatformAuditAction,
  PlatformAuditLogDto,
  PlatformAuditTargetType,
} from '@sales-copilot/shared-contracts';

function AuditLogsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize filter state from URL search params for deep linking and bookmarking
  const initialEmail = searchParams.get('actorEmail') || searchParams.get('searchEmail') || '';
  const initialTargetId = searchParams.get('targetId') || '';
  const initialAction = searchParams.get('action') || 'ALL';
  const initialTargetType = searchParams.get('targetType') || 'ALL';
  const initialStartDate = searchParams.get('startDate') || '';
  const initialEndDate = searchParams.get('endDate') || '';
  const initialPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);

  const [searchEmail, setSearchEmail] = React.useState(initialEmail);
  const [debouncedSearchEmail, setDebouncedSearchEmail] = React.useState(initialEmail);

  const [targetId, setTargetId] = React.useState(initialTargetId);
  const [debouncedTargetId, setDebouncedTargetId] = React.useState(initialTargetId);

  const [action, setAction] = React.useState<string>(initialAction);
  const [targetType, setTargetType] = React.useState<string>(initialTargetType);
  const [startDate, setStartDate] = React.useState<string>(initialStartDate);
  const [endDate, setEndDate] = React.useState<string>(initialEndDate);
  const [page, setPage] = React.useState(initialPage);

  // Debounce email and targetId input by 300ms
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchEmail(searchEmail);
      setDebouncedTargetId(targetId);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchEmail, targetId]);

  // Synchronize state changes to URL search parameters without page reloads
  const isFirstRender = React.useRef(true);
  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const params = new URLSearchParams();
    if (debouncedSearchEmail.trim()) params.set('actorEmail', debouncedSearchEmail.trim());
    if (debouncedTargetId.trim()) params.set('targetId', debouncedTargetId.trim());
    if (action && action !== 'ALL') params.set('action', action);
    if (targetType && targetType !== 'ALL') params.set('targetType', targetType);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (page > 1) params.set('page', String(page));

    const newQueryString = params.toString();
    const targetUrl = newQueryString ? `${pathname}?${newQueryString}` : pathname;
    router.replace(targetUrl, { scroll: false });
  }, [
    debouncedSearchEmail,
    debouncedTargetId,
    action,
    targetType,
    startDate,
    endDate,
    page,
    pathname,
    router,
  ]);

  // Dialog state for viewing log diff
  const [selectedLog, setSelectedLog] = React.useState<PlatformAuditLogDto | null>(null);
  const [diffDialogOpen, setDiffDialogOpen] = React.useState(false);

  // Check date filter validity to prevent sending invalid date ranges to backend
  const isDateRangeValid = isValidDateFilterRange(startDate, endDate);

  // Query audit logs
  const queryParams = React.useMemo(() => {
    const { startDate: normalizedStart, endDate: normalizedEnd } = isDateRangeValid
      ? normalizeDateFilterRange(startDate, endDate)
      : { startDate: undefined, endDate: undefined };

    return {
      page,
      limit: 20,
      actorEmail: debouncedSearchEmail.trim() || undefined,
      targetId: debouncedTargetId.trim() || undefined,
      action: action !== 'ALL' ? (action as PlatformAuditAction) : undefined,
      targetType: targetType !== 'ALL' ? (targetType as PlatformAuditTargetType) : undefined,
      startDate: normalizedStart,
      endDate: normalizedEnd,
    };
  }, [
    page,
    debouncedSearchEmail,
    debouncedTargetId,
    action,
    targetType,
    startDate,
    endDate,
    isDateRangeValid,
  ]);

  const { data, isLoading, refetch, isRefetching } = usePlatformAuditLogs(queryParams);

  const handleResetFilters = () => {
    setSearchEmail('');
    setDebouncedSearchEmail('');
    setTargetId('');
    setDebouncedTargetId('');
    setAction('ALL');
    setTargetType('ALL');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const handleViewDetail = (log: PlatformAuditLogDto) => {
    setSelectedLog(log);
    setDiffDialogOpen(true);
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-6 gap-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ScrollText className="size-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Nhật ký kiểm toán nền tảng (Platform Audit Logs)
            </h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Lưu vết bất biến mọi hành vi can thiệp hệ thống, thay đổi gói cước, quota và cấu hình
            nền tảng của Super Admin.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading || isRefetching}
          className="h-8 text-xs gap-1.5"
        >
          <RefreshCw className={`size-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
          <span>Làm mới</span>
        </Button>
      </div>

      {/* Filter Toolbar */}
      <AuditLogFilterToolbar
        searchEmail={searchEmail}
        onSearchEmailChange={val => {
          setSearchEmail(val);
          setPage(1);
        }}
        targetId={targetId}
        onTargetIdChange={val => {
          setTargetId(val);
          setPage(1);
        }}
        action={action}
        onActionChange={a => {
          setAction(a);
          setPage(1);
        }}
        targetType={targetType}
        onTargetTypeChange={t => {
          setTargetType(t);
          setPage(1);
        }}
        startDate={startDate}
        onStartDateChange={d => {
          setStartDate(d);
          setPage(1);
        }}
        endDate={endDate}
        onEndDateChange={d => {
          setEndDate(d);
          setPage(1);
        }}
        onReset={handleResetFilters}
        onRefresh={() => refetch()}
        isRefreshing={isRefetching}
      />

      {/* Audit Logs Table */}
      <AuditLogsTable
        logs={data?.items ?? []}
        isLoading={isLoading}
        meta={data?.meta}
        page={page}
        onPageChange={setPage}
        onViewDetail={handleViewDetail}
        onResetFilters={handleResetFilters}
      />

      {/* Audit Log Diff Dialog */}
      <AuditLogDiffDialog
        log={selectedLog}
        open={diffDialogOpen}
        onOpenChange={setDiffDialogOpen}
      />
    </div>
  );
}

function AuditLogsLoadingSkeleton() {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-6 gap-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-80" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-96 w-full rounded-lg" />
    </div>
  );
}

export default function PlatformAuditLogsPage() {
  return (
    <React.Suspense fallback={<AuditLogsLoadingSkeleton />}>
      <AuditLogsPageContent />
    </React.Suspense>
  );
}
