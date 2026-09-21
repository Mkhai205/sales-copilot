'use client';

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatVND } from '@/features/commerce/lib/currency';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  Link as LinkIcon,
  MoreHorizontal,
  XCircle,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';
import type {
  PaymentTransactionResponseDto,
  PaginationMeta,
} from '@sales-copilot/shared-contracts';

function formatDateTime(dateInput: Date | string): string {
  try {
    const d = new Date(dateInput);
    return d.toLocaleString('vi-VN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(dateInput);
  }
}

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
  if (isLoading) {
    return (
      <div className="rounded-md border bg-card overflow-hidden shadow-2xs">
        <Table>
          <TableHeader className="bg-muted/40 text-[11px]">
            <TableRow>
              <TableHead className="w-32">Mã GD / Cổng</TableHead>
              <TableHead className="w-36">Thời gian</TableHead>
              <TableHead className="w-36 text-right">Số tiền</TableHead>
              <TableHead className="min-w-[200px]">Nội dung (Memo)</TableHead>
              <TableHead className="w-48">Đơn hàng khớp</TableHead>
              <TableHead className="w-32 text-center">Trạng thái</TableHead>
              <TableHead className="w-16 text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, idx) => (
              <TableRow key={idx}>
                {Array.from({ length: 7 }).map((_, cIdx) => (
                  <TableCell key={cIdx} className="py-3">
                    <div className="h-4 w-full bg-muted/60 animate-pulse rounded" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="rounded-md border bg-card p-12 text-center shadow-2xs space-y-3">
        <div className="inline-flex p-3 rounded-full bg-muted text-muted-foreground">
          <HelpCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Không có giao dịch đối soát nào</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Chưa có biến động số dư ngân hàng nào phù hợp với bộ lọc hiện tại.
          </p>
        </div>
      </div>
    );
  }

  const currentPage = meta?.page || 1;
  const totalPages = meta?.totalPages || 1;

  return (
    <div className="space-y-3">
      <div className="rounded-md border bg-card overflow-hidden shadow-2xs">
        <Table>
          <TableHeader className="bg-muted/40 text-[11px]">
            <TableRow>
              <TableHead className="w-36">Mã GD / Cổng</TableHead>
              <TableHead className="w-36">Thời gian</TableHead>
              <TableHead className="w-36 text-right">Số tiền</TableHead>
              <TableHead className="min-w-[200px]">Nội dung (Memo)</TableHead>
              <TableHead className="w-52">Đơn hàng khớp</TableHead>
              <TableHead className="w-32 text-center">Trạng thái</TableHead>
              <TableHead className="w-16 text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map(tx => {
              const isSuccess = tx.status === 'SUCCESS';
              const isPending = tx.status === 'PENDING';

              return (
                <TableRow
                  key={tx.id}
                  className="hover:bg-muted/30 transition-colors text-xs cursor-pointer"
                  onClick={() => onSelectTransaction(tx)}
                >
                  {/* Transaction Code & Gateway */}
                  <TableCell className="font-mono">
                    <div className="space-y-0.5">
                      <span className="font-semibold text-foreground block truncate max-w-[120px]">
                        {tx.transactionCode || tx.id.slice(0, 8).toUpperCase()}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                        {tx.gateway}
                      </Badge>
                    </div>
                  </TableCell>

                  {/* Timestamp */}
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(tx.paidAt || tx.createdAt)}
                  </TableCell>

                  {/* Amount */}
                  <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">
                    +{formatVND(Number(tx.amount))}
                  </TableCell>

                  {/* Memo */}
                  <TableCell>
                    <p
                      className="font-medium text-foreground truncate max-w-[240px]"
                      title={tx.transferContent || ''}
                    >
                      {tx.transferContent || (
                        <span className="text-muted-foreground italic">Trống</span>
                      )}
                    </p>
                  </TableCell>

                  {/* Matched Order */}
                  <TableCell onClick={e => e.stopPropagation()}>
                    {tx.order ? (
                      <button
                        onClick={() => onSelectOrder(tx.order!.id)}
                        className="flex items-center gap-1.5 text-primary hover:underline font-semibold"
                      >
                        <span>#{tx.order.displayId || tx.order.orderNumber}</span>
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
                  </TableCell>

                  {/* Status Badge */}
                  <TableCell className="text-center">
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
                  </TableCell>

                  {/* Actions Dropdown */}
                  <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground"
                        >
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
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
          <span>
            Hiển thị trang {currentPage} trên {totalPages} (tổng số{' '}
            {meta?.total || transactions.length} giao dịch)
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="h-8 px-2"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-medium text-foreground px-2">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="h-8 px-2"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
