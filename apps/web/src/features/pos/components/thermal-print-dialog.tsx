'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer, Loader2, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { posApi } from '../api/pos-client';
import { ThermalWaybillK80 } from './thermal-waybill-k80';
import { ThermalReceiptK58 } from './thermal-receipt-k58';

interface ThermalPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  orderId: string;
  defaultFormat?: 'K80' | 'K58';
}

export function ThermalPrintDialog({
  open,
  onOpenChange,
  workspaceId,
  orderId,
  defaultFormat = 'K80',
}: ThermalPrintDialogProps) {
  const [paperFormat, setPaperFormat] = React.useState<'K80' | 'K58'>(defaultFormat);

  React.useEffect(() => {
    if (defaultFormat) {
      setPaperFormat(defaultFormat);
    }
  }, [defaultFormat, open]);

  const {
    data: labelResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['pos', 'shipping-label', workspaceId, orderId],
    queryFn: () => posApi.getShippingLabel(workspaceId, orderId),
    enabled: open && !!workspaceId && !!orderId,
    staleTime: 30000,
  });

  const labelData = labelResponse?.data;

  const handlePrint = () => {
    const printArea = document.getElementById('thermal-printable-area');
    if (!printArea) {
      window.print();
      return;
    }

    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        window.print();
        return;
      }

      const pageSize = paperFormat === 'K80' ? '80mm auto' : '58mm auto';
      const printableWidth = paperFormat === 'K80' ? '72mm' : '48mm';

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Phiếu in nhiệt #${labelData?.displayId || ''}</title>
            <style>
              @page {
                size: ${pageSize};
                margin: 0;
              }
              *, *::before, *::after {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
              }
              body {
                background: white !important;
                color: black !important;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                margin: 0;
                padding: 2mm 0;
                display: flex;
                justify-content: center;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .thermal-wrapper {
                width: ${printableWidth};
                margin: 0 auto;
              }
            </style>
            ${Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
              .map(node => node.outerHTML)
              .join('\\n')}
          </head>
          <body>
            <div class="thermal-wrapper">
              ${printArea.innerHTML}
            </div>
          </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1500);
      }, 300);
    } catch {
      window.print();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-5 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-left">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Printer className="size-5 text-primary" />
            In phiếu nhiệt (K80 / K58)
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Bản in tối ưu hóa vạch Code128 vector không khử răng cưa cho đầu in nhiệt 203 DPI
          </DialogDescription>
        </DialogHeader>

        {/* Format Selector */}
        <div className="flex items-center justify-between bg-muted/40 p-1.5 rounded-lg border">
          <span className="text-xs font-medium pl-1">Khổ giấy in:</span>
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant={paperFormat === 'K80' ? 'default' : 'outline'}
              className="h-7 text-xs px-2.5"
              onClick={() => setPaperFormat('K80')}
            >
              Phiếu giao hàng (K80)
            </Button>
            <Button
              type="button"
              size="sm"
              variant={paperFormat === 'K58' ? 'default' : 'outline'}
              className="h-7 text-xs px-2.5"
              onClick={() => setPaperFormat('K58')}
            >
              Hóa đơn mini (K58)
            </Button>
          </div>
        </div>

        {/* Dynamic Print CSS Injection */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @media print {
                body * {
                  visibility: hidden !important;
                }
                #thermal-printable-area, #thermal-printable-area * {
                  visibility: visible !important;
                }
                #thermal-printable-area {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: ${paperFormat === 'K80' ? '80mm' : '58mm'} !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  background: white !important;
                }
                @page {
                  size: ${paperFormat === 'K80' ? '80mm auto' : '58mm auto'};
                  margin: 0;
                }
              }
            `,
          }}
        />

        {/* Preview Area */}
        <div className="flex justify-center bg-neutral-100 dark:bg-neutral-900/60 p-4 rounded-lg border min-h-[300px] overflow-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground py-12">
              <Loader2 className="size-6 animate-spin" />
              <span className="text-xs">Đang tải dữ liệu phiếu in...</span>
            </div>
          ) : error || !labelData ? (
            <div className="flex flex-col items-center justify-center gap-1 text-destructive py-12 text-center">
              <span className="text-xs font-medium">Không thể lấy thông tin phiếu in</span>
              <span className="text-[11px] text-muted-foreground">Vui lòng thử lại sau</span>
            </div>
          ) : (
            <div id="thermal-printable-area" className="shadow-sm">
              {paperFormat === 'K80' ? (
                <ThermalWaybillK80 label={labelData} />
              ) : (
                <ThermalReceiptK58 label={labelData} />
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between gap-2 pt-1 border-t">
          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="size-3.5 text-emerald-600" />
            Trình duyệt Chrome / Edge tự ngắt trang
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Đóng
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              disabled={isLoading || !labelData}
              className="gap-1.5"
            >
              <Printer className="size-4" />
              In ngay
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
