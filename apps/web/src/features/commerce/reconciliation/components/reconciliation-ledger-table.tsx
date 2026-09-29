'use client';

import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatVND } from '@/features/commerce/shared/lib/currency';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  Link as LinkIcon,
  MoreHorizontal,
  HelpCircle,
  XCircle,
} from 'lucide-react';
import {
  PaymentTransactionStatus,
  type PaymentTransactionResponseDto,
  type PaginationMeta,
} from '@sales-copilot/shared-contracts';
import { formatDateTime } from '@/lib/format-date';
import { DataTable } from '@/components/data-table/data-table';

interface ReconciliationLedgerTableProps {
  transactions: PaymentTransactionResponseDto[];
  meta?: PaginationMeta;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
  onSelectTransaction: (tx: PaymentTransactionResponseDto) => void;
  onManualMatch: (tx: PaymentTransactionResponseDto) => void;
  onSelectOrder: (orderId: string) => void;
  isOwnerOrAdmin?: boolean;
}

export function ReconciliationLedgerTable({
  transactions,
  meta,
  isLoading = false,
  onPageChange,
  onSelectTransaction,
  onManualMatch,
  onSelectOrder,
  isOwnerOrAdmin = true,
}: ReconciliationLedgerTableProps) {
  const currentPage = meta?.page || 1;
  const totalPages = meta?.totalPages || 1;

  const columns = React.useMemo<ColumnDef<PaymentTransactionResponseDto, any>[]>(
    () => [
      {
        header: 'Mã GD / Cổng',
        meta: { headerClassName: 'w-36' },
        cell: ({ row }) => {
          const tx = row.original;
          return (
            <div className="space-y-0.5 font-mono">
              <span className="font-semibold text-foreground block truncate max-w-[120px]">
                {tx.transactionCode || tx.id.slice(0, 8).toUpperCase()}
              </span>
              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                {tx.gateway}
              </Badge>
            </div>
          );
        },
      },
      {
        header: 'Thời gian',
        meta: { headerClassName: 'w-36' },
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDateTime(row.original.paidAt || row.original.createdAt)}
          </span>
        ),
      },
      {
        header: 'Số tiền',
        meta: { headerClassName: 'w-36 text-right' },
        cell: ({ row }) => (
          <div className="text-right font-bold text-emerald-600 dark:text-emerald-400">
            +{formatVND(Number(row.original.amount))}
          </div>
        ),
      },
      {
        header: 'Nội dung (Memo)',
        meta: { headerClassName: 'min-w-[200px]' },
        cell: ({ row }) => (
          <p
            className="font-medium text-foreground truncate max-w-[240px]"
            title={row.original.transferContent || ''}
          >
            {row.original.transferContent || (
              <span className="text-muted-foreground italic">Trống</span>
            )}
          </p>
        ),
      },
      {
        header: 'Đơn hàng khớp',
        meta: { headerClassName: 'w-52' },
        cell: ({ row }) => {
          const tx = row.original;
          const isPending = tx.status === PaymentTransactionStatus.PENDING;
          const order = tx.order;
          return (
            <div onClick={e => e.stopPropagation()}>
              {order ? (
                <button
                  onClick={() => onSelectOrder(order.id)}
                  className="flex items-center gap-1.5 text-primary hover:underline font-semibold"
                >
                  <span>#{order.displayId || order.orderNumber}</span>
                  <ExternalLink className="w-3 h-3 text-muted-foreground" />
                </button>
              ) : isPending ? (
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="text-[10px] text-muted-foreground border-dashed"
                  >
                    Chưa gán
                  </Badge>
                  {isOwnerOrAdmin && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onManualMatch(tx)}
                      className="h-6 text-[11px] px-2 text-primary font-medium"
                    >
                      <LinkIcon className="w-3 h-3 mr-1" />
                      Gán đơn
                    </Button>
                  )}
                </div>
              ) : (
                <span className="text-muted-foreground text-[11px]">-</span>
              )}
            </div>
          );
        },
      },
      {
        header: 'Trạng thái',
        meta: { headerClassName: 'w-32 text-center' },
        cell: ({ row }) => {
          const tx = row.original;
          const isSuccess = tx.status === PaymentTransactionStatus.SUCCESS;
          const isPending = tx.status === PaymentTransactionStatus.PENDING;
          return (
            <div className="text-center">
              {isSuccess ? (
                <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[11px] px-2 py-0.5 border-0 inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Đã đối soát
                </Badge>
              ) : isPending ? (
                <Badge
                  variant="outline"
                  className="border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-950/20 text-[11px] px-2 py-0.5 inline-flex items-center gap-1"
                >
                  <Clock className="w-3 h-3" /> Chờ đối soát
                </Badge>
              ) : (
                <Badge
                  variant="destructive"
                  className="text-[11px] px-2 py-0.5 inline-flex items-center gap-1"
                >
                  <XCircle className="w-3 h-3" /> Thất bại
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        header: 'Thao tác',
        meta: { headerClassName: 'w-16 text-right' },
        cell: ({ row }) => {
          const tx = row.original;
          const isPending = tx.status === PaymentTransactionStatus.PENDING;
          return (
            <div className="flex justify-end" onClick={e => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="text-xs">
                  <DropdownMenuItem onClick={() => onSelectTransaction(tx)}>
                    <Eye className="w-3.5 h-3.5 mr-2" /> Xem chi tiết
                  </DropdownMenuItem>
                  {isPending && isOwnerOrAdmin && (
                    <DropdownMenuItem onClick={() => onManualMatch(tx)}>
                      <LinkIcon className="w-3.5 h-3.5 mr-2 text-primary" /> Gán đơn thủ công
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [onSelectTransaction, onManualMatch, onSelectOrder, isOwnerOrAdmin],
  );

  return (
    <DataTable
      data={transactions}
      columns={columns}
      isLoading={isLoading}
      skeletonRows={5}
      getRowKey={tx => tx.id}
      onRowClick={onSelectTransaction}
      className="rounded-md border bg-card overflow-hidden shadow-2xs [&_thead]:bg-muted/40 [&_thead]:text-[11px]"
      emptyState={{
        icon: (
          <div className="inline-flex p-3 rounded-full bg-muted text-muted-foreground">
            <HelpCircle className="w-6 h-6" />
          </div>
        ),
        title: 'Không có giao dịch đối soát nào',
        description: 'Chưa có biến động số dư ngân hàng nào phù hợp với bộ lọc hiện tại.',
      }}
      pagination={
        totalPages > 1
          ? {
              page: currentPage,
              totalPages,
              total: meta?.total || transactions.length,
              onPageChange,
              isLoading,
            }
          : undefined
      }
    />
  );
}
