'use client';

import * as React from 'react';
import type { VietQrResponseDto } from '@sales-copilot/shared-contracts';
import { toast } from 'sonner';
import {
  Copy,
  Check,
  QrCode,
  ExternalLink,
  Building2,
  CreditCard,
  DollarSign,
  FileText,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';

interface VietQrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  qrData?: VietQrResponseDto | null;
}

export function VietQrDialog({ open, onOpenChange, qrData }: VietQrDialogProps) {
  const { t } = useI18n();
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  if (!qrData) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast.success(t('commerce.vietQr.copiedSuccess', { label, text }));
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-5 flex flex-col gap-4">
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="text-base font-bold flex items-center justify-center gap-2">
            <QrCode className="size-5 text-primary" />
            {t('commerce.vietQr.napasTitle')}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {t('commerce.vietQr.napasSubtitle')}
          </DialogDescription>
        </DialogHeader>

        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-white border border-border/80 shadow-inner max-w-[260px] mx-auto w-full">
          <img
            src={qrData.qrUrl}
            alt={t('commerce.vietQr.orderQrAlt', { id: qrData.displayId })}
            className="w-full h-auto aspect-square object-contain rounded-lg"
          />
          <span className="text-[10px] text-gray-500 font-medium mt-1">NAPAS 247 • VIETQR</span>
        </div>

        {/* Bank Account Breakdown Details */}
        <div className="flex flex-col gap-2 rounded-lg border border-border/80 bg-muted/30 p-3 text-xs">
          {/* Bank */}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Building2 className="size-3.5" />
              {t('commerce.vietQr.bankLabel')}
            </span>
            <span className="font-semibold text-foreground">
              {qrData.bankName} {qrData.bankCode ? `(${qrData.bankCode})` : ''}
            </span>
          </div>

          {/* Account Number */}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <CreditCard className="size-3.5" />
              {t('commerce.vietQr.accountNumberLabel')}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-bold text-foreground text-sm">
                {qrData.accountNumber}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground hover:text-foreground"
                onClick={() =>
                  copyToClipboard(
                    qrData.accountNumber,
                    t('commerce.vietQr.accountNumberLabel').replace(':', ''),
                  )
                }
              >
                {copiedField === t('commerce.vietQr.accountNumberLabel').replace(':', '') ? (
                  <Check className="size-3.5 text-emerald-600" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </Button>
            </div>
          </div>

          {/* Account Name */}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('commerce.vietQr.accountHolder')}:</span>
            <span className="font-bold text-foreground uppercase">{qrData.accountName}</span>
          </div>

          {/* Amount */}
          <div className="flex items-center justify-between border-t border-border/60 pt-1.5">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <DollarSign className="size-3.5" />
              {t('commerce.vietQr.amountLabel')}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-primary text-sm">{formattedAmount}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground hover:text-foreground"
                onClick={() =>
                  copyToClipboard(
                    qrData.amount.toString(),
                    t('commerce.vietQr.amountLabel').replace(':', ''),
                  )
                }
              >
                {copiedField === t('commerce.vietQr.amountLabel').replace(':', '') ? (
                  <Check className="size-3.5 text-emerald-600" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </Button>
            </div>
          </div>

          {/* Memo / Transfer Content */}
          <div className="flex items-center justify-between border-t border-border/60 pt-1.5">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <FileText className="size-3.5" />
              {t('commerce.vietQr.memoLabel')}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                {qrData.memo}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground hover:text-foreground"
                onClick={() => copyToClipboard(qrData.memo, t('commerce.vietQr.transferContent'))}
              >
                {copiedField === t('commerce.vietQr.transferContent') ? (
                  <Check className="size-3.5 text-emerald-600" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs h-8 gap-1"
            onClick={() => window.open(qrData.qrUrl, '_blank')}
          >
            <ExternalLink className="size-3.5" />
            {t('commerce.vietQr.openLargeImage')}
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            className="text-xs h-8 px-4"
            onClick={() => onOpenChange(false)}
          >
            {t('commerce.vietQr.done')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
