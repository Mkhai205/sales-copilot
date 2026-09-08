'use client';

import * as React from 'react';
import { Minus, Plus, Trash2, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
    <div className="rounded-md border border-border overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/40 text-[11px]">
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-8">Sản phẩm</TableHead>
            <TableHead className="h-8 w-24 text-right">Đơn giá</TableHead>
            <TableHead className="h-8 w-28 text-center">Số lượng</TableHead>
            <TableHead className="h-8 w-24 text-right">Thành tiền</TableHead>
            <TableHead className="h-8 w-8 p-0 text-center"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, index) => {
            const rowTotal = Math.max(
              0,
              item.unitPrice * item.quantity - (item.discountAmount || 0),
            );

            return (
              <TableRow key={`${item.variantId}-${index}`} className="text-xs">
                <TableCell className="py-2">
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground leading-tight">
                      {item.productName}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {item.variantName} • <code className="font-mono">{item.sku}</code>
                    </span>
                  </div>
                </TableCell>

                <TableCell className="py-2 text-right font-medium">
                  {formatCurrency(item.unitPrice)}
                </TableCell>

                <TableCell className="py-2">
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-6 p-0 rounded"
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
                      className="h-6 w-10 text-center text-xs p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      disabled={disabled}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-6 p-0 rounded"
                      onClick={() => handleUpdateQuantity(index, item.quantity + 1)}
                      disabled={
                        disabled ||
                        (item.availableStock !== undefined && item.quantity >= item.availableStock)
                      }
                    >
                      <Plus className="size-3" />
                    </Button>
                  </div>
                </TableCell>

                <TableCell className="py-2 text-right font-semibold text-foreground">
                  {formatCurrency(rowTotal)}
                </TableCell>

                <TableCell className="py-2 text-center p-0 pr-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6 text-muted-foreground hover:text-destructive p-0"
                    onClick={() => handleRemoveItem(index)}
                    disabled={disabled}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
