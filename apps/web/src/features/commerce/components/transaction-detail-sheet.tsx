'use client';

import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatVND } from '@/features/commerce/lib/currency';
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Layers,
  Link as LinkIcon,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import type { PaymentTransactionResponseDto } from '@sales-copilot/shared-contracts';

interface TransactionDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: PaymentTransactionResponseDto | null;
  onOpenOrderSheet?: (orderId: string) => void;
  onOpenManualMatch?: (tx: PaymentTransactionResponseDto) => void;
  isOwnerOrAdmin?: boolean;
}

export function TransactionDetailSheet({
  open,
  onOpenChange,
  transaction,
  onOpenOrderSheet,
  onOpenManualMatch,
  isOwnerOrAdmin = true,
}: TransactionDetailSheetProps) {
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  if (!transaction) return null;

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`Đã sao chép ${fieldName}`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const isPending = transaction.status === 'PENDING';
  const isSuccess = transaction.status === 'SUCCESS';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md w-full overflow-y-auto p-6 space-y-6">
        <SheetHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-muted-foreground">
              {transaction.transactionCode || transaction.id.slice(0, 10).toUpperCase()}
            </span>
            {isSuccess ? (
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0 flex items-center gap-1 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 inline" /> Đã đối soát
              </Badge>
            ) : isPending ? (
              <Badge
                variant="outline"
                className="border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-950/20 flex items-center gap-1 text-xs"
              >
                <Clock className="w-3.5 h-3.5 inline" /> Chờ đối soát
              </Badge>
            ) : (
              <Badge variant="destructive" className="flex items-center gap-1 text-xs">
                <XCircle className="w-3.5 h-3.5 inline" /> Thất bại
              </Badge>
            )}
          </div>
          <SheetTitle className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 pt-1">
            +{formatVND(Number(transaction.amount))}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Giao dịch tiếp nhận từ cổng {transaction.gateway.toUpperCase()}
          </SheetDescription>
        </SheetHeader>

        <Separator />

        {/* Transfer Memo */}
        <div className="space-y-2 bg-muted/30 p-3 rounded-lg border">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Nội dung chuyển khoản (Memo)</span>
            <button
              onClick={() => copyToClipboard(transaction.transferContent || '', 'Nội dung')}
              className="text-primary hover:underline flex items-center gap-1"
            >
              <Copy className="w-3 h-3" />
              {copiedField === 'Nội dung' ? 'Đã chép' : 'Sao chép'}
            </button>
          </div>
          <p className="text-sm font-semibold text-foreground break-words">
            {transaction.transferContent || 'Không có nội dung'}
          </p>
        </div>

        {/* Account & Bank Info */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" /> Thông tin tài khoản thụ hưởng
          </h4>
          <div className="grid grid-cols-2 gap-2 text-xs border rounded-lg p-3 bg-card">
            <div>
              <span className="text-muted-foreground block text-[11px]">Ngân hàng</span>
              <span className="font-semibold">{transaction.bankCode || 'VietQR'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Số tài khoản nhận</span>
              <span className="font-semibold font-mono">
                {transaction.accountNumber || 'Mặc định'}
              </span>
            </div>
            <div className="pt-2">
              <span className="text-muted-foreground block text-[11px]">Cổng xử lý</span>
              <Badge variant="outline" className="text-[10px] mt-0.5">
                {transaction.gateway}
              </Badge>
            </div>
            <div className="pt-2">
              <span className="text-muted-foreground block text-[11px]">Thời gian ghi nhận</span>
              <span className="text-[11px] text-foreground">
                {new Date(transaction.paidAt || transaction.createdAt).toLocaleString('vi-VN')}
              </span>
            </div>
          </div>
        </div>

        {/* Linked Order Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <LinkIcon className="w-3.5 h-3.5" /> Đơn hàng liên kết
          </h4>

          {transaction.order ? (
            <div className="border rounded-lg p-3.5 bg-primary/5 border-primary/20 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-primary">
                  #{transaction.order.displayId || transaction.order.orderNumber}
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {transaction.order.paymentStatus}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>
                  Khách: <strong>{transaction.order.contact?.fullName || 'Khách lẻ'}</strong>
                </span>
                <span>
                  Tổng: <strong>{formatVND(Number(transaction.order.totalAmount))}</strong>
                </span>
              </div>
              {onOpenOrderSheet && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenOrderSheet(transaction.order!.id)}
                  className="w-full text-xs h-8 mt-1 gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Xem chi tiết đơn hàng
                </Button>
              )}
            </div>
          ) : (
            <div className="border border-dashed rounded-lg p-4 text-center space-y-2.5">
              <p className="text-xs text-muted-foreground">
                Giao dịch chưa được liên kết với đơn hàng nào trong hệ thống.
              </p>
              {isPending && isOwnerOrAdmin && onOpenManualMatch && (
                <Button
                  size="sm"
                  onClick={() => {
                    onOpenChange(false);
                    onOpenManualMatch(transaction);
                  }}
                  className="text-xs h-8"
                >
                  Gán đơn hàng ngay
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Raw Webhook Payload */}
        {transaction.rawWebhookPayload && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" /> Dữ liệu Webhook thô (Raw Payload)
            </h4>
            <div className="p-3 bg-muted/40 rounded-lg text-[11px] font-mono max-h-48 overflow-auto border">
              <pre>{JSON.stringify(transaction.rawWebhookPayload, null, 2)}</pre>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
