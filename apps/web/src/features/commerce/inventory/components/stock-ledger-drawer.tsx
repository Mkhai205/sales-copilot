'use client';

import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { InventoryTransactionType } from '@sales-copilot/shared-contracts';
import { useInventoryTransactions } from '../hooks/use-inventory';
import {
  ArrowDown,
  ArrowUp,
  Clock,
  FileText,
  History,
  Lock,
  RotateCcw,
  ShoppingBag,
  Unlock,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StockLedgerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  variant: {
    id: string;
    productId?: string;
    productName: string;
    name: string;
    sku: string;
  } | null;
}

function getTransactionTypeConfig(type: InventoryTransactionType) {
  switch (type) {
    case InventoryTransactionType.STOCK_IN:
      return {
        label: 'Nhập kho',
        icon: ArrowDown,
        badgeClass:
          'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
        sign: '+',
      };
    case InventoryTransactionType.STOCK_OUT:
      return {
        label: 'Xuất kho',
        icon: ArrowUp,
        badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30',
        sign: '-',
      };
    case InventoryTransactionType.INVENTORY_AUDIT:
      return {
        label: 'Kiểm kê đếm',
        icon: RotateCcw,
        badgeClass: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30',
        sign: '',
      };
    case InventoryTransactionType.RESERVATION:
      return {
        label: 'Tạm giữ đơn chat',
        icon: Lock,
        badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
        sign: '',
      };
    case InventoryTransactionType.RELEASE_RESERVATION:
      return {
        label: 'Giải phóng giữ kho',
        icon: Unlock,
        badgeClass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
        sign: '',
      };
    case InventoryTransactionType.COMMIT_SALE:
      return {
        label: 'Chốt xuất bán',
        icon: ShoppingBag,
        badgeClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30',
        sign: '-',
      };
    default:
      return {
        label: type,
        icon: History,
        badgeClass: 'bg-muted text-muted-foreground border-border',
        sign: '',
      };
  }
}

function formatDate(dateInput: Date | string): string {
  try {
    const d = new Date(dateInput);
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return String(dateInput);
  }
}

export function StockLedgerDrawer({
  open,
  onOpenChange,
  workspaceId,
  variant,
}: StockLedgerDrawerProps) {
  const { data, isLoading } = useInventoryTransactions(workspaceId, {
    variantId: variant?.id,
    page: 1,
    limit: 50,
  });

  if (!variant) return null;

  const items = data?.items || [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center gap-2">
            <History className="size-4 text-primary" />
            <SheetTitle className="text-base font-semibold">Sổ Cái Biến Động Kho</SheetTitle>
          </div>
          <SheetDescription className="text-xs text-muted-foreground">
            {variant.productName} •{' '}
            <span className="font-medium text-foreground">{variant.name}</span> (SKU:{' '}
            <code className="bg-muted px-1 py-0.5 rounded text-[11px]">{variant.sku}</code>)
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 p-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-xs gap-2">
              <Spinner className="size-5" />
              <span>Đang tải nhật ký giao dịch kho...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <FileText className="size-8 opacity-40 mb-2" />
              <p className="text-sm font-medium">Chưa có bản ghi biến động nào</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">
                Mọi thao tác nhập hàng, kiểm kê hoặc giữ hàng cho đơn chat sẽ được ghi nhật ký bất
                biến tại đây.
              </p>
            </div>
          ) : (
            <div className="relative border-l border-border/80 pl-4 ml-2 flex flex-col gap-5 py-1">
              {items.map(tx => {
                const config = getTransactionTypeConfig(tx.type);
                const Icon = config.icon;
                const netChange = tx.newStock - tx.previousStock;

                return (
                  <div key={tx.id} className="relative group">
                    {/* Node Dot */}
                    <div className="absolute -left-[23px] top-1 size-3 rounded-full border-2 border-background bg-primary shadow-xs" />

                    <div className="flex flex-col gap-1.5 p-3 rounded-lg border bg-card/60 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[11px] font-medium gap-1 px-2 py-0.5',
                            config.badgeClass,
                          )}
                        >
                          <Icon className="size-3" />
                          {config.label}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="size-3" />
                          {formatDate(tx.createdAt)}
                        </span>
                      </div>

                      {/* Quantities */}
                      <div className="grid grid-cols-2 gap-2 text-xs py-1 border-y border-border/50">
                        <div>
                          <span className="text-muted-foreground text-[11px]">Tồn vật lý: </span>
                          <span className="font-semibold text-foreground">
                            {tx.previousStock} ➔ {tx.newStock}
                          </span>
                          {netChange !== 0 && (
                            <span
                              className={cn(
                                'ml-1 font-semibold text-[11px]',
                                netChange > 0 ? 'text-emerald-600' : 'text-rose-600',
                              )}
                            >
                              ({netChange > 0 ? `+${netChange}` : netChange})
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-muted-foreground text-[11px]">Tạm giữ: </span>
                          <span className="font-medium text-amber-600 dark:text-amber-400">
                            {tx.previousReserved} ➔ {tx.newReserved}
                          </span>
                        </div>
                      </div>

                      {/* Reason & Performed By */}
                      <div className="flex flex-col gap-1 text-xs">
                        {tx.reason && (
                          <div className="text-muted-foreground">
                            <span className="font-medium text-foreground">Lý do:</span> {tx.reason}
                          </div>
                        )}
                        {tx.order && (
                          <div className="text-muted-foreground flex items-center gap-1">
                            <span className="font-medium text-foreground">Đơn hàng:</span>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              #{tx.order.displayId} ({tx.order.orderNumber})
                            </Badge>
                          </div>
                        )}
                        {tx.performedByUser && (
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                            <User className="size-3" />
                            <span>
                              Thực hiện: {tx.performedByUser.name || tx.performedByUser.email}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
