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
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { InventoryTransactionType } from '@sales-copilot/shared-contracts';
import { useProductMutations } from '../hooks/use-product-mutations';
import { ArrowDown, ArrowUp, CheckCircle, RotateCcw, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TargetVariantForAdjustment {
  id: string;
  productId?: string;
  productName: string;
  name: string;
  sku: string;
  stockQuantity: number;
  reservedQuantity: number;
  availableStock: number;
}

interface StockAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  variant: TargetVariantForAdjustment | null;
  onSuccess?: () => void;
}

const QUICK_REASONS = [
  'Nhập thêm lô hàng mới',
  'Kiểm kê định kỳ cân bằng',
  'Hàng lỗi / rách / hỏng',
  'Xuất hàng tặng mẫu / quà tặng',
  'Thất thoát kiểm kê',
];

export function StockAdjustmentDialog({
  open,
  onOpenChange,
  workspaceId,
  variant,
  onSuccess,
}: StockAdjustmentDialogProps) {
  const { adjustInventory, isAdjusting } = useProductMutations(workspaceId);

  const [type, setType] = React.useState<InventoryTransactionType>(
    InventoryTransactionType.STOCK_IN,
  );
  const [quantity, setQuantity] = React.useState<number>(1);
  const [reason, setReason] = React.useState<string>('Nhập thêm lô hàng mới');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open && variant) {
      setType(InventoryTransactionType.STOCK_IN);
      setQuantity(1);
      setReason('Nhập thêm lô hàng mới');
      setErrorMsg(null);
    }
  }, [open, variant]);

  if (!variant) return null;

  const currentPhysical = variant.stockQuantity;
  const currentReserved = variant.reservedQuantity;
  const currentAvailable = variant.availableStock;

  // Compute preview values
  let newPhysical = currentPhysical;
  if (type === InventoryTransactionType.STOCK_IN) {
    newPhysical = currentPhysical + (Number(quantity) || 0);
  } else if (type === InventoryTransactionType.STOCK_OUT) {
    newPhysical = currentPhysical - (Number(quantity) || 0);
  } else if (type === InventoryTransactionType.INVENTORY_AUDIT) {
    newPhysical = Number(quantity) || 0;
  }
  const delta = newPhysical - currentPhysical;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const parsedQty = Number(quantity);
    if (isNaN(parsedQty)) {
      setErrorMsg('Vui lòng nhập số lượng hợp lệ');
      return;
    }

    if (type !== InventoryTransactionType.INVENTORY_AUDIT && parsedQty <= 0) {
      setErrorMsg('Số lượng phải lớn hơn 0');
      return;
    }

    if (type === InventoryTransactionType.INVENTORY_AUDIT && parsedQty < 0) {
      setErrorMsg('Số lượng kiểm kê không được âm');
      return;
    }

    if (type === InventoryTransactionType.STOCK_OUT && parsedQty > currentAvailable) {
      setErrorMsg(
        `Không thể xuất quá tồn khả dụng (${currentAvailable}). Đang có ${currentReserved} hàng tạm giữ cho đơn.`,
      );
      return;
    }

    if (type === InventoryTransactionType.INVENTORY_AUDIT && parsedQty < currentReserved) {
      setErrorMsg(
        `Số lượng kiểm kê (${parsedQty}) không được thấp hơn lượng hàng đang tạm giữ (${currentReserved}).`,
      );
      return;
    }

    if (!reason.trim() || reason.trim().length < 2) {
      setErrorMsg('Lý do điều chỉnh tối thiểu 2 ký tự');
      return;
    }

    try {
      await adjustInventory({
        productId: variant.productId,
        variantId: variant.id,
        dto: {
          type,
          quantity: parsedQty,
          reason: reason.trim(),
        },
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi cập nhật tồn kho');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Điều Chỉnh Tồn Kho SKU</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {variant.productName} •{' '}
            <span className="font-medium text-foreground">{variant.name}</span> (SKU:{' '}
            <code className="bg-muted px-1 py-0.5 rounded text-[11px]">{variant.sku}</code>)
          </DialogDescription>
        </DialogHeader>

        {/* 3-State Stock Overview */}
        <div className="grid grid-cols-3 gap-2.5 p-3 rounded-lg border bg-muted/40 text-center">
          <div className="flex flex-col items-center">
            <span className="text-[11px] text-muted-foreground">Tồn vật lý</span>
            <span className="text-lg font-bold tracking-tight">{currentPhysical}</span>
          </div>
          <div className="flex flex-col items-center border-x">
            <span className="text-[11px] text-muted-foreground">Tạm giữ (Đơn chat)</span>
            <span className="text-lg font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {currentReserved}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[11px] text-muted-foreground">Khả dụng để bán</span>
            <span
              className={cn(
                'text-lg font-bold tracking-tight',
                currentAvailable > 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-destructive',
              )}
            >
              {currentAvailable}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-1">
          {/* Adjustment Types Selection */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Nghiệp vụ điều chỉnh</Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setType(InventoryTransactionType.STOCK_IN);
                  setQuantity(1);
                  setReason('Nhập thêm lô hàng mới');
                  setErrorMsg(null);
                }}
                className={cn(
                  'flex items-center justify-center gap-1.5 p-2 rounded-md border text-xs font-medium transition-colors',
                  type === InventoryTransactionType.STOCK_IN
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 shadow-xs'
                    : 'border-border bg-background hover:bg-muted text-muted-foreground',
                )}
              >
                <ArrowDown className="size-3.5" />
                Nhập hàng
              </button>

              <button
                type="button"
                onClick={() => {
                  setType(InventoryTransactionType.STOCK_OUT);
                  setQuantity(1);
                  setReason('Hàng lỗi / rách / hỏng');
                  setErrorMsg(null);
                }}
                className={cn(
                  'flex items-center justify-center gap-1.5 p-2 rounded-md border text-xs font-medium transition-colors',
                  type === InventoryTransactionType.STOCK_OUT
                    ? 'border-rose-500 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 shadow-xs'
                    : 'border-border bg-background hover:bg-muted text-muted-foreground',
                )}
              >
                <ArrowUp className="size-3.5" />
                Xuất kho
              </button>

              <button
                type="button"
                onClick={() => {
                  setType(InventoryTransactionType.INVENTORY_AUDIT);
                  setQuantity(currentPhysical);
                  setReason('Kiểm kê định kỳ cân bằng');
                  setErrorMsg(null);
                }}
                className={cn(
                  'flex items-center justify-center gap-1.5 p-2 rounded-md border text-xs font-medium transition-colors',
                  type === InventoryTransactionType.INVENTORY_AUDIT
                    ? 'border-primary bg-primary/10 text-primary shadow-xs'
                    : 'border-border bg-background hover:bg-muted text-muted-foreground',
                )}
              >
                <RotateCcw className="size-3.5" />
                Kiểm kê đếm
              </button>
            </div>
          </div>

          {/* Quantity Input with Live Preview */}
          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="adj-qty" className="text-xs font-medium">
                {type === InventoryTransactionType.STOCK_IN && 'Số lượng nhập thêm (+)'}
                {type === InventoryTransactionType.STOCK_OUT && 'Số lượng xuất bớt (-)'}
                {type === InventoryTransactionType.INVENTORY_AUDIT && 'Số lượng đếm thực tế'}
              </Label>
              <Input
                id="adj-qty"
                type="number"
                min={type === InventoryTransactionType.INVENTORY_AUDIT ? 0 : 1}
                value={quantity}
                onChange={e => setQuantity(parseInt(e.target.value, 10))}
                className="h-9"
                required
              />
            </div>

            <div className="p-2 rounded-md border bg-muted/20 text-xs flex flex-col justify-center h-9">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-[11px]">Tồn sau chỉnh:</span>
                <div className="flex items-center gap-1 font-semibold">
                  <span>{newPhysical}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] px-1 py-0 h-3.5',
                      delta > 0 && 'text-emerald-600 bg-emerald-50 border-emerald-300',
                      delta < 0 && 'text-rose-600 bg-rose-50 border-rose-300',
                      delta === 0 && 'text-muted-foreground',
                    )}
                  >
                    {delta > 0 ? `+${delta}` : delta}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Reason Input */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adj-reason" className="text-xs font-medium">
              Lý do điều chỉnh <span className="text-destructive">*</span>
            </Label>
            <Input
              id="adj-reason"
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Nhập lý do chi tiết..."
              className="h-9 text-xs"
              required
            />
            <div className="flex flex-wrap gap-1.5 mt-1">
              {QUICK_REASONS.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className="text-[11px] px-2 py-0.5 rounded-full border bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 p-2.5 rounded-md bg-destructive/10 text-destructive text-xs">
              <AlertTriangle className="size-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <DialogFooter className="mt-2 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isAdjusting}
            >
              Hủy
            </Button>
            <Button type="submit" size="sm" disabled={isAdjusting}>
              {isAdjusting ? (
                <>
                  <Spinner className="mr-1.5 size-3.5" /> Đang cập nhật...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-1.5 size-3.5" /> Xác nhận lưu kho
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
