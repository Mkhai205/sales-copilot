'use client';

import * as React from 'react';
import {
  WsServerEvent,
  type VietQrResponseDto,
  type OrderPaidEventPayload,
} from '@sales-copilot/shared-contracts';
import { toast } from 'sonner';
import { useSocketEvent } from '@/lib/socket/use-socket';
import {
  Copy,
  Check,
  QrCode,
  Building2,
  CreditCard,
  DollarSign,
  FileText,
  CheckCircle2,
  Maximize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VietQrDialog } from './vietqr-dialog';

interface VietQrChatCardProps {
  qrData: VietQrResponseDto;
  isPaid?: boolean;
}

export function VietQrChatCard({ qrData, isPaid = false }: VietQrChatCardProps) {
  const [copiedField, setCopiedField] = React.useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [localPaid, setLocalPaid] = React.useState(isPaid);

  React.useEffect(() => {
    if (isPaid) setLocalPaid(true);
  }, [isPaid]);

  // Real-time synchronization when order is paid via bank webhook
  useSocketEvent<OrderPaidEventPayload>(WsServerEvent.ORDER_PAID, data => {
    if (!data) return;
    if (data.orderId === qrData.orderId || data.displayId === qrData.displayId) {
      setLocalPaid(true);
    }
  });

  const isActuallyPaid = isPaid || localPaid;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast.success(`Đã sao chép ${label}: ${text}`);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  const formattedAmount = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(qrData.amount);

  return (
    <>
      <div className="w-full max-w-sm rounded-xl border border-border/90 bg-card p-3.5 shadow-sm flex flex-col gap-3 text-xs">
        {/* Card Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <div className="flex items-center gap-1.5 font-bold text-foreground">
            <div className="size-5 rounded bg-primary/10 flex items-center justify-center text-primary">
              <QrCode className="size-3.5" />
            </div>
            <span>VietQR Thanh toán</span>
            <span className="text-muted-foreground font-normal">#{qrData.displayId}</span>
          </div>

          {/* Status Badge */}
          {isActuallyPaid ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-3" />
              Đã thanh toán
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
              <span className="relative flex size-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full size-1.5 bg-amber-500"></span>
              </span>
              Chờ thanh toán
            </span>
          )}
        </div>

        {/* QR Code and Quick Specs Grid */}
        <div className="flex items-start gap-3">
          {/* QR Image Box */}
          <div
            onClick={() => setIsDialogOpen(true)}
            className="group/qr relative shrink-0 cursor-pointer rounded-lg border border-border/80 bg-white p-1.5 shadow-2xs hover:shadow-xs transition-all w-24 h-24 flex items-center justify-center"
            title="Bấm để phóng to mã QR"
          >
            <img
              src={qrData.qrUrl}
              alt={`QR #${qrData.displayId}`}
              className="w-full h-full object-contain rounded"
            />
            <div className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover/qr:opacity-100 transition-opacity flex items-center justify-center text-white">
              <Maximize2 className="size-4" />
            </div>
          </div>

          {/* Core Info Specs */}
          <div className="flex-1 flex flex-col gap-1 min-w-0">
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="text-muted-foreground truncate">{qrData.bankName}</span>
              <span className="font-mono text-muted-foreground text-[10px] uppercase">
                {qrData.bankCode}
              </span>
            </div>

            <div className="flex items-center justify-between gap-1">
              <span className="font-mono font-bold text-foreground text-xs truncate">
                {qrData.accountNumber}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-5 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => copyToClipboard(qrData.accountNumber, 'Số tài khoản')}
                title="Sao chép số tài khoản"
              >
                {copiedField === 'Số tài khoản' ? (
                  <Check className="size-3 text-emerald-600" />
                ) : (
                  <Copy className="size-3" />
                )}
              </Button>
            </div>

            <span className="text-[10px] text-muted-foreground uppercase truncate font-medium">
              {qrData.accountName}
            </span>

            <div className="flex items-center justify-between border-t border-border/40 pt-1 mt-0.5">
              <span className="font-bold text-primary text-xs">{formattedAmount}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-5 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => copyToClipboard(qrData.amount.toString(), 'Số tiền')}
                title="Sao chép số tiền"
              >
                {copiedField === 'Số tiền' ? (
                  <Check className="size-3 text-emerald-600" />
                ) : (
                  <Copy className="size-3" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Memo Row */}
        <div className="flex items-center justify-between rounded bg-muted/50 px-2.5 py-1.5 text-[11px] border border-border/60">
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-muted-foreground shrink-0">Nội dung:</span>
            <span className="font-mono font-bold text-amber-600 dark:text-amber-400 truncate">
              {qrData.memo}
            </span>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-5 shrink-0 text-muted-foreground hover:text-foreground ml-1"
            onClick={() => copyToClipboard(qrData.memo, 'Nội dung chuyển khoản')}
            title="Sao chép nội dung"
          >
            {copiedField === 'Nội dung chuyển khoản' ? (
              <Check className="size-3 text-emerald-600" />
            ) : (
              <Copy className="size-3" />
            )}
          </Button>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-0.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[11px] gap-1 font-medium w-full"
            onClick={() => setIsDialogOpen(true)}
          >
            <Maximize2 className="size-3" />
            Xem mã QR lớn & chi tiết
          </Button>
        </div>
      </div>

      <VietQrDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} qrData={qrData} />
    </>
  );
}
