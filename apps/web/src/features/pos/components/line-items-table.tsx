'use client';

import * as React from 'react';
import { Minus, Plus, Trash2, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface PosLineItem {
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  discountAmount: number;
  availableStock?: number;
}

interface LineItemsTableProps {
  items: PosLineItem[];
  onChangeItems: (items: PosLineItem[]) => void;
  disabled?: boolean;
}

export function LineItemsTable({ items, onChangeItems, disabled = false }: LineItemsTableProps) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleUpdateQuantity = (index: number, newQty: number) => {
    const updated = [...items];
    const item = updated[index];
    if (!item) return;

    const maxStock = item.availableStock ?? 9999;
    const finalQty = Math.max(1, Math.min(newQty, maxStock));
    updated[index] = { ...item, quantity: finalQty };
    onChangeItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    onChangeItems(updated);
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 rounded-lg border border-dashed border-border/80 bg-muted/20 text-center">
        <ShoppingCart className="size-8 text-muted-foreground/60 mb-2" />
        <p className="text-xs font-medium text-foreground">Chưa có sản phẩm nào trong đơn</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Nhấn <kbd className="font-mono bg-muted px-1 rounded border text-[10px]">Ctrl+K</kbd> hoặc
          dùng ô tìm kiếm để chọn sản phẩm và phân loại
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, index) => {
        const rowTotal = Math.max(0, item.unitPrice * item.quantity - (item.discountAmount || 0));

        return (
          <div
            key={`${item.variantId}-${index}`}
            className="flex flex-col p-2.5 rounded-lg border border-border bg-card/60 gap-2 text-xs shadow-2xs"
          >
            {/* Row 1: Product Name, Variant, SKU & Delete */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-foreground leading-tight truncate">
                  {item.productName}
                </span>
                <span className="text-[11px] text-muted-foreground mt-0.5">
                  {item.variantName} •{' '}
                  <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">
                    {item.sku}
                  </code>
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground hover:text-destructive p-0 shrink-0 cursor-pointer"
                onClick={() => handleRemoveItem(index)}
                disabled={disabled}
                title="Xóa khỏi đơn"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>

            {/* Row 2: Quantity Stepper & Price Calculation */}
            <div className="flex items-center justify-between pt-1.5 border-t border-border/40">
              {/* Stepper */}
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-6 p-0 rounded cursor-pointer"
                  onClick={() => handleUpdateQuantity(index, item.quantity - 1)}
                  disabled={disabled || item.quantity <= 1}
                >
                  <Minus className="size-3" />
                </Button>
                <Input
                  type="number"
                  min={1}
                  max={item.availableStock ?? 9999}
                  value={item.quantity}
                  onChange={e => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) {
                      handleUpdateQuantity(index, val);
                    }
                  }}
                  className="h-6 w-11 text-center text-xs p-0 font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  disabled={disabled}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-6 p-0 rounded cursor-pointer"
                  onClick={() => handleUpdateQuantity(index, item.quantity + 1)}
                  disabled={
                    disabled ||
                    (item.availableStock !== undefined && item.quantity >= item.availableStock)
                  }
                >
                  <Plus className="size-3" />
                </Button>
              </div>

              {/* Price */}
              <div className="flex items-center gap-1 text-right">
                <span className="text-[11px] text-muted-foreground">
                  {formatCurrency(item.unitPrice)}
                </span>
                <span className="text-muted-foreground/60 text-[10px]">x{item.quantity} =</span>
                <span className="font-semibold text-foreground text-xs">
                  {formatCurrency(rowTotal)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
