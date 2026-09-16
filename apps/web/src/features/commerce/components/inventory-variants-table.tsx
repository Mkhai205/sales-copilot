'use client';

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { StockStatusBadge } from './stock-status-badge';
import { Boxes, History, Package, SlidersHorizontal } from 'lucide-react';
import type { InventoryVariantItemDto } from '@sales-copilot/shared-contracts';
import { formatVND } from '@/features/commerce/lib/currency';
import { TargetVariantForAdjustment } from './stock-adjustment-dialog';

interface InventoryVariantsTableProps {
  variants: InventoryVariantItemDto[];
  onAdjustStock: (variant: TargetVariantForAdjustment) => void;
  onViewLedger: (variant: {
    id: string;
    productId?: string;
    productName: string;
    name: string;
    sku: string;
  }) => void;
}

export function InventoryVariantsTable({
  variants,
  onAdjustStock,
  onViewLedger,
}: InventoryVariantsTableProps) {
  if (variants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground border rounded-lg bg-card/40">
        <Boxes className="size-10 opacity-30 mb-3" />
        <h3 className="text-sm font-semibold text-foreground">Không có biến thể SKU nào</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          Thử thay đổi bộ lọc hoặc tìm kiếm theo SKU, tên sản phẩm hoặc mã vạch.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card overflow-hidden shadow-2xs">
      <Table>
        <TableHeader className="bg-muted/40 text-[11px]">
          <TableRow>
            <TableHead className="w-12 p-2">Ảnh</TableHead>
            <TableHead className="min-w-[200px]">Sản phẩm & Biến thể</TableHead>
            <TableHead className="w-36">Mã SKU & Barcode</TableHead>
            <TableHead className="w-24 text-right">Giá bán</TableHead>
            <TableHead className="w-24 text-center">Tồn vật lý</TableHead>
            <TableHead className="w-24 text-center">Tạm giữ</TableHead>
            <TableHead className="w-32 text-center">Tồn khả dụng</TableHead>
            <TableHead className="w-32 text-right">Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="text-xs">
          {variants.map(variant => (
            <TableRow key={variant.id} className="hover:bg-muted/30 transition-colors">
              {/* Image */}
              <TableCell className="p-2">
                <div className="size-9 rounded-md border bg-muted/40 overflow-hidden flex items-center justify-center">
                  {variant.productImageUrl ? (
                    <img
                      src={variant.productImageUrl}
                      alt={variant.name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <Package className="size-4 text-muted-foreground opacity-50" />
                  )}
                </div>
              </TableCell>

              {/* Product & Variant Name */}
              <TableCell className="py-2.5">
                <div className="flex flex-col">
                  <span className="text-[11px] text-muted-foreground line-clamp-1">
                    {variant.productName}
                  </span>
                  <span className="font-semibold text-foreground text-xs line-clamp-1">
                    {variant.name}
                  </span>
                </div>
              </TableCell>

              {/* SKU & Barcode */}
              <TableCell className="py-2.5 font-mono">
                <div className="flex flex-col">
                  <code className="text-xs font-semibold text-foreground">{variant.sku}</code>
                  {variant.barcode && (
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      {variant.barcode}
                    </span>
                  )}
                </div>
              </TableCell>

              {/* Price */}
              <TableCell className="py-2.5 text-right font-medium">
                {formatVND(Number(variant.price))}
              </TableCell>

              {/* Physical Stock */}
              <TableCell className="py-2.5 text-center font-mono font-medium">
                {variant.stockQuantity}
              </TableCell>

              {/* Reserved Stock */}
              <TableCell className="py-2.5 text-center font-mono text-amber-600 dark:text-amber-400 font-medium">
                {variant.reservedQuantity}
              </TableCell>

              {/* Available Stock Badge */}
              <TableCell className="py-2.5 text-center">
                <StockStatusBadge availableStock={variant.availableStock} showCount={true} />
              </TableCell>

              {/* Actions */}
              <TableCell className="py-2.5 text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      onAdjustStock({
                        id: variant.id,
                        productId: variant.productId,
                        productName: variant.productName,
                        name: variant.name,
                        sku: variant.sku,
                        stockQuantity: variant.stockQuantity,
                        reservedQuantity: variant.reservedQuantity,
                        availableStock: variant.availableStock,
                      })
                    }
                    className="h-7 text-xs px-2 gap-1"
                  >
                    <SlidersHorizontal className="size-3" />
                    Chỉnh kho
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      onViewLedger({
                        id: variant.id,
                        productId: variant.productId,
                        productName: variant.productName,
                        name: variant.name,
                        sku: variant.sku,
                      })
                    }
                    className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground gap-1"
                  >
                    <History className="size-3" />
                    Sổ cái
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
