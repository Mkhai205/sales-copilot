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
import { useI18n } from '@/lib/i18n';

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
  const { t } = useI18n();
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
              <TableHead className="text-xs font-semibold">
                {t('admin.workspaces.colShopSlug')}
              </TableHead>
              <TableHead className="text-xs font-semibold">
                {t('admin.workspaces.colOwner')}
              </TableHead>
              <TableHead className="text-xs font-semibold">
                {t('admin.workspaces.colPlan')}
              </TableHead>
              <TableHead className="text-xs font-semibold text-center">
                {t('admin.workspaces.colStaff')}
              </TableHead>
              <TableHead className="text-xs font-semibold text-center">
                {t('admin.workspaces.colChannels')}
              </TableHead>
              <TableHead className="text-xs font-semibold">
                {t('admin.workspaces.colStatus')}
              </TableHead>
              <TableHead className="text-xs font-semibold">
                {t('admin.workspaces.colRegisteredDate')}
              </TableHead>
              <TableHead className="text-xs font-semibold text-right pr-4">
                {t('admin.workspaces.colActions')}
              </TableHead>
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
                      {t('admin.workspaces.emptyTitle')}
                    </span>
                    <span className="text-[11px]">{t('admin.workspaces.emptyDesc')}</span>
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
                              title={t('admin.workspaces.copySlug')}
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
                        <span className="text-muted-foreground italic">
                          {t('admin.workspaces.noOwner')}
                        </span>
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
                        {ws.isSuspended
                          ? t('admin.workspaces.suspended')
                          : t('admin.workspaces.active')}
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
                            <span className="sr-only">{t('admin.workspaces.colActions')}</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 text-xs">
                          <DropdownMenuItem onClick={() => onViewDetail(ws)} className="gap-2">
                            <Eye className="size-3.5" />
                            <span>{t('admin.workspaces.viewDetail')}</span>
                          </DropdownMenuItem>

                          <DropdownMenuItem asChild className="gap-2">
                            <Link href={`/platform-admin/workspaces/${ws.id}`}>
                              <ExternalLink className="size-3.5" />
                              <span>{t('admin.workspaces.openDedicatedPage')}</span>
                            </Link>
                          </DropdownMenuItem>

                          <DropdownMenuItem onClick={() => onUpdatePlan(ws)} className="gap-2">
                            <Sliders className="size-3.5" />
                            <span>{t('admin.workspaces.changePlanQuotas')}</span>
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
                                <span>{t('admin.workspaces.reactivateShop')}</span>
                              </>
                            ) : (
                              <>
                                <ShieldBan className="size-3.5 text-destructive" />
                                <span>{t('admin.workspaces.suspendShop')}</span>
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
        <div>{t('admin.workspaces.pagination', { page, totalPages, total: totalItems })}</div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || isLoading}
            className="h-7 px-2.5 text-xs gap-1"
          >
            <ChevronLeft className="size-3.5" />
            <span>{t('admin.workspaces.prevPage')}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || isLoading}
            className="h-7 px-2.5 text-xs gap-1"
          >
            <span>{t('admin.workspaces.nextPage')}</span>
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
