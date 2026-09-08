'use client';

import * as React from 'react';
import { DiscountType, PaymentMethod } from '@sales-copilot/shared-contracts';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface OrderFinancialSummaryProps {
  subtotal: number;
  discountAmount: number;
  discountType: DiscountType;
  discountReason?: string;
  shippingFee: number;
  paymentMethod: PaymentMethod;
  onChange: (updates: {
    discountAmount?: number;
    discountType?: DiscountType;
    discountReason?: string;
    shippingFee?: number;
    paymentMethod?: PaymentMethod;
  }) => void;
  disabled?: boolean;
}

const SHIPPING_PRESETS = [
  { label: 'Freeship', value: 0 },
  { label: 'Đồng giá', value: 25000 },
  { label: 'Tiêu chuẩn', value: 30000 },
  { label: 'Hỏa tốc', value: 45000 },
];

export function OrderFinancialSummary({
  subtotal,
  discountAmount,
  discountType,
  discountReason,
  shippingFee,
  paymentMethod,
  onChange,
  disabled = false,
}: OrderFinancialSummaryProps) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const calculatedDiscount = React.useMemo(() => {
    if (discountType === DiscountType.PERCENTAGE) {
      return Math.min(subtotal, Math.round((subtotal * Math.min(100, discountAmount || 0)) / 100));
    }
    return Math.min(subtotal, discountAmount || 0);
  }, [subtotal, discountAmount, discountType]);

  const totalAmount = Math.max(0, subtotal - calculatedDiscount + shippingFee);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 text-xs">
      <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider text-muted-foreground">
        Tổng kết thanh toán
      </h4>

      {/* Subtotal */}
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Tạm tính:</span>
        <span className="font-medium text-foreground">{formatCurrency(subtotal)}</span>
      </div>

      {/* Discount Section */}
      <div className="flex flex-col gap-1.5 pt-1 border-t border-border/50">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Chiết khấu:</span>
          <span className="font-medium text-destructive">
            -{formatCurrency(calculatedDiscount)}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex rounded-md border border-input overflow-hidden shrink-0">
            <button
              type="button"
              className={cn(
                'px-2 py-0.5 text-[11px] font-medium transition-colors',
                discountType === DiscountType.FIXED_AMOUNT
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted',
              )}
              onClick={() => onChange({ discountType: DiscountType.FIXED_AMOUNT })}
              disabled={disabled}
            >
              ₫
            </button>
            <button
              type="button"
              className={cn(
                'px-2 py-0.5 text-[11px] font-medium transition-colors',
                discountType === DiscountType.PERCENTAGE
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted',
              )}
              onClick={() => onChange({ discountType: DiscountType.PERCENTAGE })}
              disabled={disabled}
            >
              %
            </button>
          </div>

          <Input
            type="number"
            min={0}
            max={discountType === DiscountType.PERCENTAGE ? 100 : subtotal}
            placeholder={discountType === DiscountType.PERCENTAGE ? '0 - 100%' : 'Số tiền ₫'}
            value={discountAmount || ''}
            onChange={e => {
              const val = Math.max(0, parseInt(e.target.value, 10) || 0);
              onChange({ discountAmount: val });
            }}
            className="h-7 text-xs flex-1"
            disabled={disabled}
          />
        </div>

        <Input
          placeholder="Lý do chiết khấu (tùy chọn)..."
          value={discountReason || ''}
          onChange={e => onChange({ discountReason: e.target.value })}
          className="h-6 text-[11px] text-muted-foreground"
          disabled={disabled}
        />
      </div>

      {/* Shipping Fee Presets */}
      <div className="flex flex-col gap-1.5 pt-1 border-t border-border/50">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Phí vận chuyển:</span>
          <span className="font-medium text-foreground">{formatCurrency(shippingFee)}</span>
        </div>

        <div className="flex flex-wrap gap-1">
          {SHIPPING_PRESETS.map(preset => {
            const isSelected = shippingFee === preset.value;
            return (
              <Button
                key={preset.label}
                type="button"
                variant={isSelected ? 'default' : 'outline'}
                size="sm"
                className={cn('h-6 px-2 text-[11px] rounded', isSelected && 'font-semibold')}
                onClick={() => onChange({ shippingFee: preset.value })}
                disabled={disabled}
              >
                {preset.label} ({preset.value === 0 ? '0₫' : `${preset.value / 1000}k`})
              </Button>
            );
          })}
        </div>

        <Input
          type="number"
          min={0}
          placeholder="Nhập phí ship tùy chỉnh ₫..."
          value={shippingFee || ''}
          onChange={e => {
            const val = Math.max(0, parseInt(e.target.value, 10) || 0);
            onChange({ shippingFee: val });
          }}
          className="h-6 text-[11px] mt-0.5"
          disabled={disabled}
        />
      </div>

      {/* Payment Method */}
      <div className="flex flex-col gap-1 pt-1 border-t border-border/50">
        <span className="text-muted-foreground">Phương thức thanh toán:</span>
        <Select
          value={paymentMethod}
          onValueChange={val => onChange({ paymentMethod: val as PaymentMethod })}
          disabled={disabled}
        >
          <SelectTrigger className="w-full h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value={PaymentMethod.COD} className="text-xs">
              COD (Thanh toán khi nhận hàng)
            </SelectItem>
            <SelectItem value={PaymentMethod.VIETQR} className="text-xs">
              VietQR (Chuyển khoản tự động xác thực)
            </SelectItem>
            <SelectItem value={PaymentMethod.BANK_TRANSFER} className="text-xs">
              Chuyển khoản ngân hàng thủ công
            </SelectItem>
            <SelectItem value={PaymentMethod.CASH} className="text-xs">
              Tiền mặt tại quầy (CASH)
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grand Total */}
      <div className="flex items-center justify-between pt-2 border-t border-border text-sm font-bold">
        <span className="text-foreground">Tổng thanh toán:</span>
        <span className="text-primary text-base font-extrabold">{formatCurrency(totalAmount)}</span>
      </div>
    </div>
  );
}
