'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import {
  InventoryTransactionType,
  adjustInventorySchema,
  type AdjustInventoryDto,
} from '@sales-copilot/shared-contracts';
import { useProductMutations } from '@/features/commerce/products/hooks/use-product-mutations';
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
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const defaultValues = React.useMemo<AdjustInventoryDto>(
    () => ({
      type: InventoryTransactionType.STOCK_IN,
      quantity: 1,
      reason: 'Nhập thêm lô hàng mới',
    }),
    [variant?.id],
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<AdjustInventoryDto>({
    resolver: zodResolver(adjustInventorySchema),
    values: defaultValues,
    resetOptions: {
      keepDirtyValues: true,
    },
    mode: 'onChange',
  });

  const type = watch('type');
  const quantity = watch('quantity');

  if (!variant) return null;

  const currentPhysical = variant.stockQuantity;
  const currentReserved = variant.reservedQuantity;
  const currentAvailable = variant.availableStock;

  // Compute preview values
  let newPhysical = currentPhysical;
  const parsedQty = Number(quantity) || 0;
  if (type === InventoryTransactionType.STOCK_IN) {
    newPhysical = currentPhysical + parsedQty;
  } else if (type === InventoryTransactionType.STOCK_OUT) {
    newPhysical = currentPhysical - parsedQty;
  } else if (type === InventoryTransactionType.INVENTORY_AUDIT) {
    newPhysical = parsedQty;
  }
  const delta = newPhysical - currentPhysical;

  const onSubmit = async (values: AdjustInventoryDto) => {
    setErrorMsg(null);

    const qty = Number(values.quantity);

    if (values.type !== InventoryTransactionType.INVENTORY_AUDIT && qty <= 0) {
      setErrorMsg('Số lượng phải lớn hơn 0');
      return;
    }

    if (values.type === InventoryTransactionType.INVENTORY_AUDIT && qty < 0) {
      setErrorMsg('Số lượng kiểm kê không được âm');
      return;
    }

    if (values.type === InventoryTransactionType.STOCK_OUT && qty > currentAvailable) {
      setErrorMsg(
        `Không thể xuất quá tồn khả dụng (${currentAvailable}). Đang có ${currentReserved} hàng tạm giữ cho đơn.`,
      );
      return;
    }

    if (values.type === InventoryTransactionType.INVENTORY_AUDIT && qty < currentReserved) {
      setErrorMsg(
        `Số lượng kiểm kê (${qty}) không được thấp hơn lượng hàng đang tạm giữ (${currentReserved}).`,
      );
      return;
    }

    try {
      await adjustInventory({
        productId: variant.productId,
        variantId: variant.id,
        dto: {
          type: values.type,
          quantity: qty,
          reason: values.reason.trim(),
        },
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi cập nhật tồn kho');
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={o => {
        if (!o) {
          reset();
          setErrorMsg(null);
        }
        onOpenChange(o);
      }}
    >
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
            <span className="text-lg font-bold tracking-tight text-warning dark:text-warning">
              {currentReserved}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[11px] text-muted-foreground">Khả dụng để bán</span>
            <span
              className={cn(
                'text-lg font-bold tracking-tight',
                currentAvailable > 0 ? 'text-success dark:text-success' : 'text-destructive',
              )}
            >
              {currentAvailable}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-1">
          {/* Adjustment Types Selection */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Nghiệp vụ điều chỉnh</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setValue('type', InventoryTransactionType.STOCK_IN, { shouldValidate: true });
                  setValue('quantity', 1, { shouldValidate: true });
                  setValue('reason', 'Nhập thêm lô hàng mới', { shouldValidate: true });
                  setErrorMsg(null);
                }}
                className={cn(
                  'h-auto w-auto',
                  'flex items-center justify-center gap-1.5 p-2 rounded-md border text-xs font-medium transition-colors',
                  type === InventoryTransactionType.STOCK_IN
                    ? 'border-success bg-success/10 text-success dark:bg-success/40 dark:text-success shadow-xs'
                    : 'border-border bg-background hover:bg-muted text-muted-foreground',
                )}
              >
                <ArrowDown className="size-3.5" />
                Nhập hàng
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setValue('type', InventoryTransactionType.STOCK_OUT, { shouldValidate: true });
                  setValue('quantity', 1, { shouldValidate: true });
                  setValue('reason', 'Hàng lỗi / rách / hỏng', { shouldValidate: true });
                  setErrorMsg(null);
                }}
                className={cn(
                  'h-auto w-auto',
                  'flex items-center justify-center gap-1.5 p-2 rounded-md border text-xs font-medium transition-colors',
                  type === InventoryTransactionType.STOCK_OUT
                    ? 'border-destructive bg-destructive/10 text-destructive dark:bg-destructive/40 dark:text-destructive shadow-xs'
                    : 'border-border bg-background hover:bg-muted text-muted-foreground',
                )}
              >
                <ArrowUp className="size-3.5" />
                Xuất kho
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setValue('type', InventoryTransactionType.INVENTORY_AUDIT, {
                    shouldValidate: true,
                  });
                  setValue('quantity', currentPhysical, { shouldValidate: true });
                  setValue('reason', 'Kiểm kê định kỳ cân bằng', { shouldValidate: true });
                  setErrorMsg(null);
                }}
                className={cn(
                  'h-auto w-auto',
                  'flex items-center justify-center gap-1.5 p-2 rounded-md border text-xs font-medium transition-colors',
                  type === InventoryTransactionType.INVENTORY_AUDIT
                    ? 'border-primary bg-primary/10 text-primary shadow-xs'
                    : 'border-border bg-background hover:bg-muted text-muted-foreground',
                )}
              >
                <RotateCcw className="size-3.5" />
                Kiểm kê đếm
              </Button>
            </div>
          </div>

          {/* Quantity Input with Live Preview */}
          <div className="grid grid-cols-2 gap-3 items-start">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="adj-qty" className="text-xs font-medium">
                {type === InventoryTransactionType.INVENTORY_AUDIT
                  ? 'Số lượng thực tế sau kiểm kê'
                  : 'Số lượng thay đổi'}
              </Label>
              <Input
                id="adj-qty"
                type="number"
                min={0}
                {...register('quantity', { valueAsNumber: true })}
                className="h-9 text-xs"
                required
              />
              {errors.quantity && (
                <span className="text-[11px] text-destructive">{errors.quantity.message}</span>
              )}
            </div>

            {/* Calculated Preview Box */}
            <div className="flex flex-col gap-1.5 p-2 rounded-md bg-muted/30 border text-xs">
              <span className="text-[11px] text-muted-foreground font-medium">
                Dự kiến tồn kho sau điều chỉnh:
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-base font-bold">{newPhysical}</span>
                <Badge
                  variant={delta > 0 ? 'default' : delta < 0 ? 'destructive' : 'secondary'}
                  className="text-[10px] px-1 py-0 h-4 font-mono"
                >
                  {delta > 0 ? `+${delta}` : delta}
                </Badge>
              </div>
              <span className="text-[10px] text-muted-foreground">
                Tồn khả dụng mới: {Math.max(0, newPhysical - currentReserved)}
              </span>
            </div>
          </div>

          {/* Reason Input & Quick Suggestions */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adj-reason" className="text-xs font-medium">
              Lý do điều chỉnh <span className="text-destructive">*</span>
            </Label>
            <Input
              id="adj-reason"
              {...register('reason')}
              placeholder="Ghi rõ lý do nhập/xuất kho..."
              className="h-9 text-xs"
              required
            />
            {errors.reason && (
              <span className="text-[11px] text-destructive">{errors.reason.message}</span>
            )}

            {/* Quick Reason Pills */}
            <div className="flex flex-wrap gap-1 mt-1">
              {QUICK_REASONS.map(r => (
                <Badge
                  key={r}
                  variant="outline"
                  onClick={() => setValue('reason', r, { shouldValidate: true })}
                  className="cursor-pointer text-[10px] py-0 px-1.5 text-muted-foreground hover:text-foreground hover:bg-muted font-normal transition-colors"
                >
                  {r}
                </Badge>
              ))}
            </div>
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-md bg-destructive/10 text-destructive text-xs flex items-center gap-2 border border-destructive/20">
              <AlertTriangle className="size-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Hủy
            </Button>
            <Button type="submit" size="sm" disabled={isAdjusting} className="text-xs gap-1.5">
              {isAdjusting ? (
                <Spinner className="size-3.5" />
              ) : (
                <CheckCircle className="size-3.5" />
              )}
              Xác nhận điều chỉnh
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
