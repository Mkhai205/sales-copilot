'use client';

import * as React from 'react';
import { QrCode, Smartphone } from 'lucide-react';
import { VIETNAM_BANKS } from '../../constants/vietnam-banks';

interface LiveVietQrCardProps {
  bankBin: string;
  bankCode?: string;
  bankName?: string;
  accountNumber: string;
  accountName: string;
  isVietinBank?: boolean;
}

export function LiveVietQrCard({
  bankBin,
  bankCode: _bankCode,
  bankName,
  accountNumber,
  accountName,
  isVietinBank,
}: LiveVietQrCardProps) {
  const [imgError, setImgError] = React.useState(false);

  const selectedBank = React.useMemo(() => VIETNAM_BANKS.find(b => b.bin === bankBin), [bankBin]);

  const isConfigured = Boolean(bankBin && accountNumber.trim());

  const memo = isVietinBank ? 'SEVQR TEST' : 'ORD TEST';
  const qrUrl = React.useMemo(() => {
    if (!isConfigured) return '';
    return `https://img.vietqr.io/image/${bankBin}-${accountNumber.trim()}-compact2.png?amount=50000&addInfo=${encodeURIComponent(
      memo,
    )}&accountName=${encodeURIComponent(accountName || '')}`;
  }, [bankBin, accountNumber, accountName, memo, isConfigured]);

  React.useEffect(() => {
    setImgError(false);
  }, [qrUrl]);

  const displayBankName = selectedBank?.shortName || bankName || 'Ngân hàng';

  return (
    <div className="flex flex-col items-center justify-center w-full h-full py-1">
      {isConfigured ? (
        <div className="flex flex-col items-center gap-2 w-full">
          {/* VietQR Image - To rõ, sắc nét, kích thước mở rộng max-w-[340px] */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-2.5 max-w-[340px] w-full flex items-center justify-center overflow-hidden">
            {!imgError ? (
              <img
                src={qrUrl}
                alt={`Mã VietQR ${displayBankName}`}
                className="w-full h-full object-contain"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground gap-2 p-4 text-center">
                <QrCode className="w-12 h-12 text-muted-foreground/40" />
                <span className="text-xs">Không tải được ảnh mã QR từ VietQR CDN</span>
              </div>
            )}
          </div>

          <span className="text-[11.5px] text-muted-foreground flex items-center gap-1.5 pt-0.5">
            <Smartphone className="w-3.5 h-3.5 text-primary shrink-0" />
            Dùng app ngân hàng quét thử
          </span>
        </div>
      ) : (
        <div className="p-8 rounded-2xl border border-dashed border-border/80 bg-muted/20 max-w-[340px] w-full aspect-square flex flex-col items-center justify-center text-center gap-3">
          <QrCode className="w-12 h-12 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">Nhập số tài khoản để hiển thị mã VietQR</p>
        </div>
      )}
    </div>
  );
}
