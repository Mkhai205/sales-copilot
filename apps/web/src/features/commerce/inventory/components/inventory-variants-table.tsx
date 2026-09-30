'use client';

import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { StockStatusBadge } from './stock-status-badge';
import { Boxes, History, Package, SlidersHorizontal } from 'lucide-react';
import type { InventoryVariantItemDto } from '@sales-copilot/shared-contracts';
import { formatVND } from '@/features/commerce/shared/lib/currency';
import type { TargetVariantForAdjustment } from './stock-adjustment-dialog';
import Image from 'next/image';
import { DataTable } from '@/components/data-table/data-table';

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
  const columns = React.useMemo<ColumnDef<InventoryVariantItemDto, any>[]>(
    () => [
      {
        header: 'Ảnh',
        meta: { headerClassName: 'w-12 p-2' },
        cell: ({ row }) => {
          const variant = row.original;
          return (
            <div className="relative size-9 rounded-md border bg-muted/40 overflow-hidden flex items-center justify-center">
              {variant.productImageUrl ? (
                <Image
                  src={variant.productImageUrl}
                  alt={variant.name}
                  fill
                  sizes="36px"
                  unoptimized
                  className="size-full object-cover"
                />
              ) : (
                <Package className="size-4 text-muted-foreground opacity-50" />
              )}
            </div>
          );
        },
      },
      {
        header: 'Sản phẩm & Biến thể',
        meta: { headerClassName: 'min-w-[200px]' },
        cell: ({ row }) => {
          const variant = row.original;
          return (
            <div className="flex flex-col">
              <span className="text-[11px] text-muted-foreground line-clamp-1">
                {variant.productName}
              </span>
              <span className="font-semibold text-foreground text-xs line-clamp-1">
                {variant.name}
              </span>
            </div>
          );
        },
      },
      {
        header: 'Mã SKU & Barcode',
        meta: { headerClassName: 'w-36' },
        cell: ({ row }) => {
          const variant = row.original;
          return (
            <div className="flex flex-col font-mono">
              <code className="text-xs font-semibold text-foreground">{variant.sku}</code>
              {variant.barcode && (
                <span className="text-[10px] text-muted-foreground mt-0.5">{variant.barcode}</span>
              )}
            </div>
          );
        },
      },
      {
        header: 'Giá bán',
        meta: { headerClassName: 'w-24 text-right' },
        cell: ({ row }) => (
          <div className="text-right font-medium">{formatVND(Number(row.original.price))}</div>
        ),
      },
      {
        header: 'Tồn vật lý',
        meta: { headerClassName: 'w-24 text-center' },
        cell: ({ row }) => (
          <div className="text-center font-mono font-medium">{row.original.stockQuantity}</div>
        ),
      },
      {
        header: 'Tạm giữ',
        meta: { headerClassName: 'w-24 text-center' },
        cell: ({ row }) => (
          <div className="text-center font-mono text-warning dark:text-warning font-medium">
            {row.original.reservedQuantity}
          </div>
        ),
      },
      {
        header: 'Tồn khả dụng',
        meta: { headerClassName: 'w-32 text-center' },
        cell: ({ row }) => (
          <div className="text-center">
            <StockStatusBadge availableStock={row.original.availableStock} showCount={true} />
          </div>
        ),
      },
      {
        header: 'Thao tác',
        meta: { headerClassName: 'w-32 text-right' },
        cell: ({ row }) => {
          const variant = row.original;
          return (
            <div
              className="flex items-center justify-end gap-1.5"
              onClick={e => e.stopPropagation()}
            >
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
          );
        },
      },
    ],
    [onAdjustStock, onViewLedger],
  );

  return (
    <DataTable
      data={variants}
      columns={columns}
      getRowKey={variant => variant.id}
      className="rounded-md border bg-card overflow-hidden shadow-2xs [&_thead]:bg-muted/40 [&_thead]:text-[11px] [&_td]:py-2.5"
      emptyState={{
        icon: <Boxes className="size-10 opacity-30" />,
        title: 'Không có biến thể SKU nào',
        description: 'Thử thay đổi bộ lọc hoặc tìm kiếm theo SKU, tên sản phẩm hoặc mã vạch.',
      }}
    />
  );
}
