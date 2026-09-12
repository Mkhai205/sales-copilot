'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Eye,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  Shield,
  User,
  Globe,
  Clock,
} from 'lucide-react';
import type { PaginationMeta, PlatformAuditLogDto } from '@sales-copilot/shared-contracts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleCopyId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      navigator.clipboard?.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignore clipboard write failures
    }
  };

  const totalPages = typeof meta?.totalPages === 'number' ? meta.totalPages : 1;
  const totalItems = typeof meta?.total === 'number' ? meta.total : logs.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent bg-muted/40">
              <TableHead className="text-xs font-semibold w-[170px]">Thời điểm</TableHead>
              <TableHead className="text-xs font-semibold">Quản trị viên</TableHead>
              <TableHead className="text-xs font-semibold">Hành động</TableHead>
              <TableHead className="text-xs font-semibold">Đối tượng tác động</TableHead>
              <TableHead className="text-xs font-semibold">IP & Client</TableHead>
              <TableHead className="text-xs font-semibold text-right pr-4">Thao tác</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              // Loading Skeleton
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Skeleton className="size-6 rounded-full" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-24 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-36" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className="text-right pr-4">
                    <Skeleton className="h-7 w-20 ml-auto rounded-md" />
                  </TableCell>
                </TableRow>
              ))
            ) : logs.length === 0 ? (
              // Empty State
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Shield className="size-8 stroke-1 text-muted-foreground/50" />
                    <p className="text-sm font-medium">Không tìm thấy nhật ký kiểm toán nào</p>
                    <p className="text-xs">Hãy thử thay đổi điều kiện lọc hoặc từ khóa tìm kiếm.</p>
                    {onResetFilters && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onResetFilters}
                        className="mt-2 h-7 text-xs"
                      >
                        Đặt lại bộ lọc
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              logs.map(log => {
                const actionBadge = getActionBadgeConfig(log.action);
                const targetBadge = getTargetTypeBadgeConfig(log.targetType);

                return (
                  <TableRow
                    key={log.id}
                    className="cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => onViewDetail(log)}
                  >
                    {/* Timestamp */}
                    <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="size-3 text-muted-foreground/70 shrink-0" />
                        <span>{formatDateTime(log.createdAt)}</span>
                      </div>
                    </TableCell>

                    {/* Admin Actor */}
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <User className="size-3.5" />
                        </div>
                        <span className="text-xs font-medium text-foreground">
                          {log.actorEmail}
                        </span>
                      </div>
                    </TableCell>

                    {/* Action */}
                    <TableCell>
                      <Badge
                        variant={actionBadge.variant}
                        className={`text-xs font-medium px-2 py-0.5 ${actionBadge.className}`}
                      >
                        {actionBadge.label}
                      </Badge>
                    </TableCell>

                    {/* Target Object */}
                    <TableCell>
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
                            <button
                              type="button"
                              onClick={e => handleCopyId(log.targetId!, e)}
                              className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                              title="Sao chép ID"
                            >
                              {copiedId === log.targetId ? (
                                <Check className="size-3 text-emerald-600" />
                              ) : (
                                <Copy className="size-3" />
                              )}
                            </button>

                            {/* Quick Navigation link if applicable */}
                            {log.targetType === 'WORKSPACE' && (
                              <Link
                                href={`/admin/workspaces/${log.targetId}`}
                                onClick={e => e.stopPropagation()}
                                className="text-primary hover:text-primary/80 transition-colors p-0.5"
                                title="Mở trang quản trị workspace"
                              >
                                <ExternalLink className="size-3" />
                              </Link>
                            )}
                            {log.targetType === 'SYSTEM_SETTING' && (
                              <Link
                                href="/admin/settings"
                                onClick={e => e.stopPropagation()}
                                className="text-primary hover:text-primary/80 transition-colors p-0.5"
                                title="Mở cấu hình hệ thống"
                              >
                                <ExternalLink className="size-3" />
                              </Link>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>

                    {/* IP & User Agent */}
                    <TableCell>
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
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right pr-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={e => {
                          e.stopPropagation();
                          onViewDetail(log);
                        }}
                        className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                      >
                        <Eye className="size-3.5" />
                        <span>Chi tiết</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Bar */}
      <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
        <div>
          Trang <span className="font-semibold text-foreground">{page}</span> /{' '}
          <span className="font-semibold text-foreground">{totalPages}</span> — Tổng{' '}
          <span className="font-semibold text-foreground">{totalItems}</span> bản ghi
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || isLoading}
            className="h-7 px-2.5 text-xs gap-1"
          >
            <ChevronLeft className="size-3.5" />
            <span>Trước</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || isLoading}
            className="h-7 px-2.5 text-xs gap-1"
          >
            <span>Sau</span>
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
