'use client';

import * as React from 'react';
import Link from 'next/link';
import { Eye, ExternalLink, Copy, Check, Shield, User, Globe, Clock } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { PaginationMeta, PlatformAuditLogDto } from '@sales-copilot/shared-contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table/data-table';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import {
  formatDateTime,
  getActionBadgeConfig,
  getTargetTypeBadgeConfig,
} from '../utils/audit-log-helpers';

export interface AuditLogsTableProps {
  logs: PlatformAuditLogDto[];
  isLoading: boolean;
  meta?: PaginationMeta;
  page: number;
  onPageChange: (page: number) => void;
  onViewDetail: (log: PlatformAuditLogDto) => void;
  onResetFilters?: () => void;
}

export function AuditLogsTable({
  logs,
  isLoading,
  meta,
  page,
  onPageChange,
  onViewDetail,
  onResetFilters,
}: AuditLogsTableProps) {
  const { copiedValue, copy } = useCopyToClipboard();

  const handleCopyId = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    copy(id);
  };

  const totalPages = typeof meta?.totalPages === 'number' ? meta.totalPages : 1;
  const totalItems = typeof meta?.total === 'number' ? meta.total : logs.length;

  const columns = React.useMemo<ColumnDef<PlatformAuditLogDto, any>[]>(
    () => [
      {
        header: 'Thời gian',
        meta: { headerClassName: 'text-xs font-semibold w-[170px]' },
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground whitespace-nowrap">
            <Clock className="size-3 text-muted-foreground/70 shrink-0" />
            <span>{formatDateTime(row.original.createdAt)}</span>
          </div>
        ),
      },
      {
        header: 'Người thực hiện',
        meta: { headerClassName: 'text-xs font-semibold' },
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="size-3.5" />
            </div>
            <span className="text-xs font-medium text-foreground">{row.original.actorEmail}</span>
          </div>
        ),
      },
      {
        header: 'Hành động',
        meta: { headerClassName: 'text-xs font-semibold' },
        cell: ({ row }) => {
          const actionBadge = getActionBadgeConfig(row.original.action);
          return (
            <Badge
              variant={actionBadge.variant}
              className={`text-xs font-medium px-2 py-0.5 ${actionBadge.className}`}
            >
              {actionBadge.label}
            </Badge>
          );
        },
      },
      {
        header: 'Đối tượng tác động',
        meta: { headerClassName: 'text-xs font-semibold' },
        cell: ({ row }) => {
          const log = row.original;
          const targetBadge = getTargetTypeBadgeConfig(log.targetType);

          return (
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant={targetBadge.variant}
                className={`text-[10px] px-1.5 py-0 font-medium ${targetBadge.className}`}
              >
                {targetBadge.label}
              </Badge>

              {log.targetId ? (
                <div className="flex items-center gap-1">
                  <span
                    className="font-mono text-xs text-foreground/80 max-w-[150px] truncate"
                    title={log.targetId}
                  >
                    {log.targetId}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={e => handleCopyId(e, log.targetId!)}
                    className="h-auto w-auto text-muted-foreground hover:text-foreground transition-colors p-0.5"
                    title={'Sao chép ID'}
                  >
                    {copiedValue === log.targetId ? (
                      <Check className="size-3 text-emerald-600" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                  </Button>

                  {/* Quick Navigation link if applicable */}
                  {log.targetType === 'WORKSPACE' && (
                    <Link
                      href={`/platform-admin/workspaces/${log.targetId}`}
                      onClick={e => e.stopPropagation()}
                      className="text-primary hover:text-primary/80 transition-colors p-0.5"
                      title="Workspace"
                    >
                      <ExternalLink className="size-3" />
                    </Link>
                  )}
                  {log.targetType === 'SYSTEM_SETTING' && (
                    <Link
                      href="/platform-admin/settings"
                      onClick={e => e.stopPropagation()}
                      className="text-primary hover:text-primary/80 transition-colors p-0.5"
                      title="Settings"
                    >
                      <ExternalLink className="size-3" />
                    </Link>
                  )}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">-</span>
              )}
            </div>
          );
        },
      },
      {
        header: 'IP & Client',
        meta: { headerClassName: 'text-xs font-semibold' },
        cell: ({ row }) => {
          const log = row.original;
          return (
            <div className="flex flex-col text-xs text-muted-foreground">
              <div className="flex items-center gap-1 font-mono">
                <Globe className="size-3 shrink-0 text-muted-foreground/60" />
                <span>{log.ipAddress || 'Unknown IP'}</span>
              </div>
              {log.userAgent && (
                <span
                  className="text-[11px] text-muted-foreground/70 max-w-[140px] truncate"
                  title={log.userAgent}
                >
                  {log.userAgent}
                </span>
              )}
            </div>
          );
        },
      },
      {
        header: 'Thao tác',
        meta: { headerClassName: 'text-xs font-semibold text-right pr-4' },
        cell: ({ row }) => (
          <div className="flex justify-end" onClick={e => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewDetail(row.original)}
              className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Eye className="size-3.5" />
              <span>{'Chi tiết'}</span>
            </Button>
          </div>
        ),
      },
    ],
    [copiedValue, handleCopyId, onViewDetail],
  );

  return (
    <div className="flex flex-col gap-3">
      <DataTable
        data={logs}
        columns={columns}
        isLoading={isLoading}
        skeletonRows={6}
        getRowKey={log => log.id}
        onRowClick={onViewDetail}
        className="rounded-lg border border-border bg-card overflow-hidden [&_thead]:bg-muted/40 [&_thead_tr:hover]:bg-transparent [&_tbody_tr:hover]:bg-muted/40 [&_th]:text-xs [&_th]:font-semibold [&_td:last-child]:pr-4"
        emptyState={{
          icon: <Shield className="size-8 stroke-1 text-muted-foreground/50" />,
          title: 'Không tìm thấy nhật ký kiểm toán nào',
          description: 'Hãy thử thay đổi điều kiện lọc hoặc từ khóa tìm kiếm.',
          action: onResetFilters ? (
            <Button variant="outline" size="sm" onClick={onResetFilters} className="h-7 text-xs">
              {'Đặt lại'}
            </Button>
          ) : undefined,
        }}
        pagination={{
          page,
          totalPages,
          total: totalItems,
          onPageChange,
          isLoading,
        }}
      />
    </div>
  );
}
