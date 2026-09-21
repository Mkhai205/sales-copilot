'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatVND } from '@/features/commerce/lib/currency';
import { useQuery } from '@tanstack/react-query';
import { commerceApi } from '../api/commerce-client';
import { commerceKeys } from '@/lib/query-keys';
import { useManualMatchTransaction } from '../hooks/use-reconciliation';
import { Check, Loader2, Search, Sparkles } from 'lucide-react';
import type {
  OrderResponseDto,
  PaymentTransactionResponseDto,
} from '@sales-copilot/shared-contracts';

interface ManualMatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: PaymentTransactionResponseDto | null;
  workspaceId: string;
}

export function ManualMatchDialog({
  open,
  onOpenChange,
  transaction,
  workspaceId,
}: ManualMatchDialogProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [selectedOrderId, setSelectedOrderId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  React.useEffect(() => {
    if (open) {
      setSelectedOrderId(null);
      setSearchTerm('');
    }
  }, [open]);

  // Fetch unpaid or partially paid orders for candidate matching
  const { data: ordersData, isLoading: isLoadingOrders } = useQuery({
    queryKey: commerceKeys.orders(workspaceId, { search: debouncedSearch, limit: 30 }),
    queryFn: async () => {
      const res = await commerceApi.listOrders(workspaceId, {
        search: debouncedSearch || undefined,
        limit: 30,
      });
      return res.data;
    },
    enabled: open && Boolean(workspaceId),
  });

  const rawOrders: OrderResponseDto[] = ordersData?.items || [];

  // Filter eligible orders: not CANCELLED, and paymentStatus is UNPAID or PARTIALLY_PAID
  const eligibleOrders = React.useMemo(() => {
    const filtered = rawOrders.filter(
      o =>
        o.status !== 'CANCELLED' &&
        (o.paymentStatus === 'UNPAID' || o.paymentStatus === 'PARTIALLY_PAID'),
    );

    const txAmount = Number(transaction?.amount || 0);

    // Sort: exact amount match on top, then by created date
    return filtered.sort((a, b) => {
      const remA = Number(a.totalAmount) - Number(a.paidAmount);
      const remB = Number(b.totalAmount) - Number(b.paidAmount);
      const matchA = Math.abs(remA - txAmount) < 1;
      const matchB = Math.abs(remB - txAmount) < 1;
      if (matchA && !matchB) return -1;
      if (!matchA && matchB) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [rawOrders, transaction?.amount]);

  const { mutate: manualMatch, isPending: isMatching } = useManualMatchTransaction(workspaceId);

  const handleConfirmMatch = () => {
    if (!transaction || !selectedOrderId) return;

    manualMatch(
      {
        transactionId: transaction.id,
        dto: { orderId: selectedOrderId },
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      },
    );
  };

  const txAmount = Number(transaction?.amount || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-5 pb-3 border-b">
          <DialogTitle className="text-base font-semibold">
            Gán đơn hàng thủ công (Manual Match)
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Chọn đơn hàng cần liên kết với giao dịch chuyển khoản ngân hàng này.
          </DialogDescription>
        </DialogHeader>

        {/* Transaction Summary Card */}
        {transaction && (
          <div className="mx-5 my-3 p-3 rounded-lg border bg-muted/30 flex items-center justify-between text-xs">
            <div className="space-y-0.5">
              <span className="text-muted-foreground font-mono text-[11px]">
                {transaction.transactionCode || transaction.id.slice(0, 8).toUpperCase()}
              </span>
              <p className="font-semibold text-foreground truncate max-w-[280px]">
                &ldquo;{transaction.transferContent || 'Không có nội dung'}&rdquo;
              </p>
            </div>
            <div className="text-right">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm block">
                +{formatVND(Number(transaction.amount))}
              </span>
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-4 border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-950/20"
              >
                Chờ đối soát
              </Badge>
            </div>
          </div>
        )}

        {/* Search Order Input */}
        <div className="px-5 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm theo mã đơn (#1004), tên khách hoặc số điện thoại..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </div>
        </div>

        {/* Candidates List */}
        <div className="flex-1 overflow-y-auto px-5 py-2 space-y-2 min-h-[220px] max-h-[360px]">
          {isLoadingOrders ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-xs">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Đang tìm đơn hàng phù hợp...
            </div>
          ) : eligibleOrders.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-xs">
              Không tìm thấy đơn hàng nào chưa thanh toán phù hợp.
            </div>
          ) : (
            eligibleOrders.map(order => {
              const remaining = Math.max(0, Number(order.totalAmount) - Number(order.paidAmount));
              const isExactAmount = Math.abs(remaining - txAmount) < 1;
              const isSelected = selectedOrderId === order.id;

              return (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrderId(order.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between text-xs ${
                    isSelected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'hover:bg-muted/40 border-border'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">
                        #{order.displayId || order.orderNumber}
                      </span>
                      {isExactAmount && (
                        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] px-1.5 py-0 border-0 flex items-center gap-0.5">
                          <Sparkles className="w-3 h-3 inline" /> Khớp đúng số tiền
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                        {order.paymentStatus === 'PARTIALLY_PAID' ? 'Đã cọc' : 'Chưa trả'}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground">
                      Khách:{' '}
                      <span className="font-medium text-foreground">
                        {order.recipientName || 'Khách lẻ'}
                      </span>
                      {order.recipientPhone && ` • ${order.recipientPhone}`}
                    </p>
                  </div>

                  <div className="text-right space-y-0.5">
                    <span className="font-semibold text-foreground block">
                      {formatVND(Number(order.totalAmount))}
                    </span>
                    <span className="text-[11px] text-muted-foreground block">
                      Còn thiếu: <strong className="text-amber-600">{formatVND(remaining)}</strong>
                    </span>
                    {isSelected && (
                      <span className="inline-flex items-center text-primary text-[11px] font-semibold mt-0.5">
                        <Check className="w-3.5 h-3.5 mr-0.5" /> Đã chọn
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter className="p-4 border-t bg-muted/10 gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isMatching}
            className="text-xs"
          >
            Hủy
          </Button>
          <Button
            size="sm"
            disabled={!selectedOrderId || isMatching}
            onClick={handleConfirmMatch}
            className="text-xs"
          >
            {isMatching ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Đang đối soát...
              </>
            ) : (
              'Xác nhận khớp đơn'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
