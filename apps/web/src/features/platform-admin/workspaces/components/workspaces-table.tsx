'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  MoreHorizontal,
  Eye,
  Sliders,
  ShieldBan,
  ShieldCheck,
  Copy,
  Check,
  ExternalLink,
  Store,
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { PaginationMeta, PlatformWorkspaceListItemDto } from '@sales-copilot/shared-contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table/data-table';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  formatDateTime,
  getPlanBadgeConfig,
  getStatusBadgeConfig,
} from '../utils/workspace-helpers';

export interface WorkspacesTableProps {
  workspaces: PlatformWorkspaceListItemDto[];
  isLoading: boolean;
  meta?: PaginationMeta;
  page: number;
  onPageChange: (page: number) => void;
  onViewDetail: (workspace: PlatformWorkspaceListItemDto) => void;
  onUpdatePlan: (workspace: PlatformWorkspaceListItemDto) => void;
  onToggleStatus: (workspace: PlatformWorkspaceListItemDto) => void;
}

export function WorkspacesTable({
  workspaces,
  isLoading,
  meta,
  page,
  onPageChange,
  onViewDetail,
  onUpdatePlan,
  onToggleStatus,
}: WorkspacesTableProps) {
  const { copiedValue, copy } = useCopyToClipboard();

  const handleCopySlug = (e: React.MouseEvent, slug: string) => {
    e.stopPropagation();
    copy(slug);
  };

  const totalPages = typeof meta?.totalPages === 'number' ? meta.totalPages : 1;
  const totalItems = typeof meta?.total === 'number' ? meta.total : workspaces.length;

  const columns = React.useMemo<ColumnDef<PlatformWorkspaceListItemDto, any>[]>(
    () => [
      {
        header: 'Shop & Slug',
        meta: { headerClassName: 'text-xs font-semibold' },
        cell: ({ row }) => {
          const ws = row.original;
          return (
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary font-semibold text-xs">
                {ws.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold text-foreground hover:underline">{ws.name}</span>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <code>{ws.slug}</code>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={e => handleCopySlug(e, ws.slug)}
                    className="h-auto w-auto text-muted-foreground hover:text-foreground"
                    title={'Sao chép slug'}
                  >
                    {copiedValue === ws.slug ? (
                      <Check className="size-2.5 text-success" />
                    ) : (
                      <Copy className="size-2.5" />
                    )}
                  </Button>
                </span>
              </div>
            </div>
          );
        },
      },
      {
        header: 'Chủ sở hữu',
        meta: { headerClassName: 'text-xs font-semibold' },
        cell: ({ row }) => {
          const ws = row.original;
          return ws.owner ? (
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-foreground">{ws.owner.name}</span>
              <span className="text-[11px] text-muted-foreground">{ws.owner.email}</span>
            </div>
          ) : (
            <span className="text-muted-foreground italic">{'Chưa có'}</span>
          );
        },
      },
      {
        header: 'Gói cước',
        meta: { headerClassName: 'text-xs font-semibold' },
        cell: ({ row }) => {
          const planBadge = getPlanBadgeConfig(row.original.billingPlan);
          return (
            <Badge variant={planBadge.variant} className={planBadge.className}>
              {planBadge.label}
            </Badge>
          );
        },
      },
      {
        header: 'Nhân sự',
        meta: { headerClassName: 'text-xs font-semibold text-center' },
        cell: ({ row }) => (
          <div className="text-center font-medium">{row.original.memberCount}</div>
        ),
      },
      {
        header: 'Kênh',
        meta: { headerClassName: 'text-xs font-semibold text-center' },
        cell: ({ row }) => (
          <div className="text-center font-medium">{row.original.channelCount}</div>
        ),
      },
      {
        header: 'Trạng thái',
        meta: { headerClassName: 'text-xs font-semibold' },
        cell: ({ row }) => {
          const ws = row.original;
          const statusBadge = getStatusBadgeConfig(ws.isSuspended);
          return (
            <Badge variant={statusBadge.variant} className={statusBadge.className}>
              {ws.isSuspended ? 'Đã tạm dừng' : 'Đang hoạt động'}
            </Badge>
          );
        },
      },
      {
        header: 'Ngày đăng ký',
        meta: { headerClassName: 'text-xs font-semibold' },
        cell: ({ row }) => (
          <span className="text-muted-foreground">{formatDateTime(row.original.createdAt)}</span>
        ),
      },
      {
        header: 'Thao tác',
        meta: { headerClassName: 'text-xs font-semibold text-right pr-4' },
        cell: ({ row }) => {
          const ws = row.original;
          return (
            <div className="flex justify-end" onClick={e => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-foreground"
                  >
                    <MoreHorizontal className="size-4" />
                    <span className="sr-only">{'Thao tác'}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 text-xs">
                  <DropdownMenuItem onClick={() => onViewDetail(ws)} className="gap-2">
                    <Eye className="size-3.5" />
                    <span>{'Xem chi tiết'}</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem asChild className="gap-2">
                    <Link href={`/platform-admin/workspaces/${ws.id}`}>
                      <ExternalLink className="size-3.5" />
                      <span>{'Mở trang riêng'}</span>
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={() => onUpdatePlan(ws)} className="gap-2">
                    <Sliders className="size-3.5" />
                    <span>{'Đổi gói & Quotas'}</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={() => onToggleStatus(ws)}
                    variant={ws.isSuspended ? 'default' : 'destructive'}
                    className="gap-2"
                  >
                    {ws.isSuspended ? (
                      <>
                        <ShieldCheck className="size-3.5 text-success" />
                        <span>{'Kích hoạt lại'}</span>
                      </>
                    ) : (
                      <>
                        <ShieldBan className="size-3.5 text-destructive" />
                        <span>{'Tạm khóa'}</span>
                      </>
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [copiedValue, handleCopySlug, onViewDetail, onUpdatePlan, onToggleStatus],
  );

  return (
    <div className="flex flex-col gap-3">
      <DataTable
        data={workspaces}
        columns={columns}
        isLoading={isLoading}
        skeletonRows={5}
        getRowKey={ws => ws.id}
        onRowClick={onViewDetail}
        className="rounded-lg border border-border bg-card overflow-hidden [&_thead]:bg-muted/40 [&_thead_tr:hover]:bg-transparent [&_tbody_tr:hover]:bg-muted/30 [&_th]:text-xs [&_th]:font-semibold [&_td]:py-2.5 [&_td:last-child]:pr-4"
        emptyState={{
          icon: <Store className="size-8 stroke-[1.5] text-muted-foreground" />,
          title: 'Không tìm thấy Workspace nào',
          description: 'Thử thay đổi từ khóa tìm kiếm hoặc điều chỉnh bộ lọc gói/trạng thái.',
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
