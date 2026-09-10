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
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Store,
} from 'lucide-react';
import type { PaginationMeta, PlatformWorkspaceListItemDto } from '@sales-copilot/shared-contracts';
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
  const [copiedSlug, setCopiedSlug] = React.useState<string | null>(null);

  const handleCopySlug = (slug: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(slug);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const totalPages = typeof meta?.totalPages === 'number' ? meta.totalPages : 1;
  const totalItems = typeof meta?.total === 'number' ? meta.total : workspaces.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent bg-muted/40">
              <TableHead className="text-xs font-semibold">Shop & Slug</TableHead>
              <TableHead className="text-xs font-semibold">Chủ sở hữu</TableHead>
              <TableHead className="text-xs font-semibold">Gói cước</TableHead>
              <TableHead className="text-xs font-semibold text-center">Nhân sự</TableHead>
              <TableHead className="text-xs font-semibold text-center">Kênh</TableHead>
              <TableHead className="text-xs font-semibold">Trạng thái</TableHead>
              <TableHead className="text-xs font-semibold">Ngày đăng ký</TableHead>
              <TableHead className="text-xs font-semibold text-right pr-4">Thao tác</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              // Loading Skeleton rows
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Skeleton className="size-8 rounded-md" />
                      <div className="flex flex-col gap-1">
                        <Skeleton className="h-3.5 w-28" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-3.5 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </TableCell>
                  <TableCell className="text-center">
                    <Skeleton className="h-3.5 w-6 mx-auto" />
                  </TableCell>
                  <TableCell className="text-center">
                    <Skeleton className="h-3.5 w-6 mx-auto" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-24 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-3.5 w-24" />
                  </TableCell>
                  <TableCell className="text-right pr-4">
                    <Skeleton className="size-7 rounded-md ml-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : workspaces.length === 0 ? (
              // Empty State
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Store className="size-8 stroke-[1.5]" />
                    <span className="text-xs font-medium text-foreground">
                      Không tìm thấy Workspace nào
                    </span>
                    <span className="text-[11px]">
                      Thử thay đổi từ khóa tìm kiếm hoặc điều chỉnh bộ lọc gói/trạng thái.
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              // Data Rows
              workspaces.map(ws => {
                const planBadge = getPlanBadgeConfig(ws.billingPlan);
                const statusBadge = getStatusBadgeConfig(ws.isSuspended);

                return (
                  <TableRow
                    key={ws.id}
                    className="hover:bg-muted/30 cursor-pointer text-xs"
                    onClick={() => onViewDetail(ws)}
                  >
                    {/* Shop & Slug */}
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary font-semibold text-xs">
                          {ws.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-foreground hover:underline">
                            {ws.name}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <code>{ws.slug}</code>
                            <button
                              type="button"
                              onClick={e => handleCopySlug(ws.slug, e)}
                              className="text-muted-foreground hover:text-foreground"
                              title="Sao chép slug"
                            >
                              {copiedSlug === ws.slug ? (
                                <Check className="size-2.5 text-emerald-600" />
                              ) : (
                                <Copy className="size-2.5" />
                              )}
                            </button>
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Owner */}
                    <TableCell className="py-2.5">
                      {ws.owner ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-foreground">{ws.owner.name}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {ws.owner.email}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">Chưa có</span>
                      )}
                    </TableCell>

                    {/* Plan */}
                    <TableCell className="py-2.5">
                      <Badge variant={planBadge.variant} className={planBadge.className}>
                        {planBadge.label}
                      </Badge>
                    </TableCell>

                    {/* Agents Count */}
                    <TableCell className="py-2.5 text-center font-medium">
                      {ws.memberCount}
                    </TableCell>

                    {/* Channels Count */}
                    <TableCell className="py-2.5 text-center font-medium">
                      {ws.channelCount}
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-2.5">
                      <Badge variant={statusBadge.variant} className={statusBadge.className}>
                        {statusBadge.label}
                      </Badge>
                    </TableCell>

                    {/* Created At */}
                    <TableCell className="py-2.5 text-muted-foreground">
                      {formatDateTime(ws.createdAt)}
                    </TableCell>

                    {/* Actions Menu */}
                    <TableCell
                      className="py-2.5 text-right pr-4"
                      onClick={e => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-foreground"
                          >
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">Hành động</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 text-xs">
                          <DropdownMenuItem onClick={() => onViewDetail(ws)} className="gap-2">
                            <Eye className="size-3.5" />
                            <span>Xem chi tiết</span>
                          </DropdownMenuItem>

                          <DropdownMenuItem asChild className="gap-2">
                            <Link href={`/admin/workspaces/${ws.id}`}>
                              <ExternalLink className="size-3.5" />
                              <span>Mở trang riêng</span>
                            </Link>
                          </DropdownMenuItem>

                          <DropdownMenuItem onClick={() => onUpdatePlan(ws)} className="gap-2">
                            <Sliders className="size-3.5" />
                            <span>Đổi gói & Quotas</span>
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          <DropdownMenuItem
                            onClick={() => onToggleStatus(ws)}
                            variant={ws.isSuspended ? 'default' : 'destructive'}
                            className="gap-2"
                          >
                            {ws.isSuspended ? (
                              <>
                                <ShieldCheck className="size-3.5 text-emerald-600" />
                                <span>Kích hoạt lại</span>
                              </>
                            ) : (
                              <>
                                <ShieldBan className="size-3.5 text-destructive" />
                                <span>Tạm khóa</span>
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination bar */}
      <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
        <div>
          Trang <span className="font-semibold text-foreground">{page}</span> /{' '}
          <span className="font-semibold text-foreground">{totalPages}</span> — Tổng{' '}
          <span className="font-semibold text-foreground">{totalItems}</span> shops
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
