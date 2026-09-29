'use client';

import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { TableCell, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StockStatusBadge } from '@/features/commerce/inventory/components/stock-status-badge';
import {
  ChevronDown,
  ChevronRight,
  Edit2,
  History,
  MoreHorizontal,
  Package,
  SlidersHorizontal,
  Tag,
  Trash2,
} from 'lucide-react';
import type {
  ProductResponseDto,
  ProductVariantResponseDto,
} from '@sales-copilot/shared-contracts';
import { formatVND } from '@/features/commerce/shared/lib/currency';
import type { TargetVariantForAdjustment } from '@/features/commerce/inventory/components/stock-adjustment-dialog';
import Image from 'next/image';
import { DataTable } from '@/components/data-table/data-table';

interface ProductsTableProps {
  products: ProductResponseDto[];
  workspaceId: string;
  onEditProduct: (product: ProductResponseDto) => void;
  onDeleteProduct: (id: string) => void;
  onAdjustStock: (variant: TargetVariantForAdjustment) => void;
  onViewLedger: (variant: {
    id: string;
    productId?: string;
    productName: string;
    name: string;
    sku: string;
  }) => void;
}

export function ProductsTable({
  products,
  onEditProduct,
  onDeleteProduct,
  onAdjustStock,
  onViewLedger,
}: ProductsTableProps) {
  const [expandedRowIds, setExpandedRowIds] = React.useState<Set<string>>(new Set());

  const columns = React.useMemo<ColumnDef<ProductResponseDto, any>[]>(
    () => [
      {
        header: '',
        meta: { headerClassName: 'w-8 p-2' },
        cell: ({ row }) => {
          const product = row.original;
          const variants = product.variants || [];
          if (variants.length === 0) return null;
          return (
            <div className="text-center">
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setExpandedRowIds(prev => {
                    const next = new Set(prev);
                    if (next.has(product.id)) {
                      next.delete(product.id);
                    } else {
                      next.add(product.id);
                    }
                    return next;
                  });
                }}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                {expandedRowIds.has(product.id) ? (
                  <ChevronDown className="size-3.5" />
                ) : (
                  <ChevronRight className="size-3.5" />
                )}
              </button>
            </div>
          );
        },
      },
      {
        header: 'Ảnh',
        meta: { headerClassName: 'w-12 p-2' },
        cell: ({ row }) => {
          const product = row.original;
          return (
            <div className="relative size-9 rounded-md border bg-muted/40 overflow-hidden flex items-center justify-center">
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt={product.name}
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
        header: 'Tên sản phẩm & SKU',
        meta: { headerClassName: 'min-w-[200px]' },
        cell: ({ row }) => {
          const product = row.original;
          return (
            <div className="flex flex-col">
              <span className="font-semibold text-foreground text-xs line-clamp-1">
                {product.name}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <code className="text-[11px] font-mono text-muted-foreground">{product.sku}</code>
                {!product.isActive && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 border-dashed">
                    Đã ẩn
                  </Badge>
                )}
              </div>
            </div>
          );
        },
      },
      {
        header: 'Danh mục',
        meta: { headerClassName: 'w-32' },
        cell: ({ row }) =>
          row.original.category ? (
            <Badge variant="secondary" className="text-[10px] font-normal px-2 py-0.5">
              <Tag className="size-2.5 mr-1 opacity-70" />
              {row.original.category}
            </Badge>
          ) : (
            <span className="text-muted-foreground/60 text-[11px]">—</span>
          ),
      },
      {
        header: 'Giá niêm yết',
        meta: { headerClassName: 'w-24 text-right' },
        cell: ({ row }) => (
          <div className="text-right font-medium">{formatVND(Number(row.original.basePrice))}</div>
        ),
      },
      {
        header: 'Biến thể SKU',
        meta: { headerClassName: 'w-28 text-center' },
        cell: ({ row }) => (
          <div className="text-center">
            <Badge variant="outline" className="text-[11px] font-mono px-1.5 py-0">
              {(row.original.variants || []).length} SKU
            </Badge>
          </div>
        ),
      },
      {
        header: 'Tồn khả dụng',
        meta: { headerClassName: 'w-36 text-center' },
        cell: ({ row }) => (
          <div className="text-center">
            <StockStatusBadge availableStock={row.original.totalAvailable ?? 0} />
          </div>
        ),
      },
      {
        header: '',
        meta: { headerClassName: 'w-10 p-2' },
        cell: ({ row }) => {
          const product = row.original;
          const variants = product.variants || [];
          return (
            <div className="flex justify-end" onClick={e => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="text-xs">
                  <DropdownMenuItem onClick={() => onEditProduct(product)}>
                    <Edit2 className="size-3.5 mr-2" /> Chỉnh sửa sản phẩm
                  </DropdownMenuItem>
                  {variants.length === 1 && (
                    <DropdownMenuItem
                      onClick={() =>
                        onAdjustStock({
                          id: variants[0].id,
                          productId: product.id,
                          productName: product.name,
                          name: variants[0].name,
                          sku: variants[0].sku,
                          stockQuantity: variants[0].stockQuantity,
                          reservedQuantity: variants[0].reservedQuantity,
                          availableStock: variants[0].availableStock,
                        })
                      }
                    >
                      <SlidersHorizontal className="size-3.5 mr-2" /> Điều chỉnh tồn kho
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDeleteProduct(product.id)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="size-3.5 mr-2" /> Lưu trữ / Ẩn sản phẩm
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [onEditProduct, onDeleteProduct, onAdjustStock, onViewLedger, expandedRowIds],
  );

  return (
    <DataTable
      data={products}
      columns={columns}
      getRowKey={product => product.id}
      className="rounded-md border bg-card overflow-hidden shadow-2xs [&_thead]:bg-muted/40 [&_thead]:text-[11px] [&_td]:py-2.5"
      emptyState={{
        icon: <Package className="size-10 opacity-30" />,
        title: 'Không tìm thấy sản phẩm nào',
        description:
          'Thử điều chỉnh bộ lọc hoặc từ khóa tìm kiếm, hoặc bấm "Thêm sản phẩm" để khởi tạo danh mục mới.',
      }}
      renderExpanded={product => {
        const variants = product.variants || [];
        if (!expandedRowIds.has(product.id) || variants.length === 0) return null;
        return (
          <TableRow className="bg-muted/15 border-b hover:bg-muted/20">
            <TableCell colSpan={8} className="p-0 pl-10 pr-4 py-2">
              <div className="rounded-md border border-border/70 bg-background/80 overflow-hidden my-1">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-muted/50 text-muted-foreground border-b text-[10px]">
                    <tr>
                      <th className="p-2 font-medium">Tên biến thể</th>
                      <th className="p-2 font-medium">Mã SKU</th>
                      <th className="p-2 font-medium text-right">Giá bán</th>
                      <th className="p-2 font-medium text-center">Tồn vật lý</th>
                      <th className="p-2 font-medium text-center">Tạm giữ</th>
                      <th className="p-2 font-medium text-center">Khả dụng</th>
                      <th className="p-2 font-medium text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v: ProductVariantResponseDto) => (
                      <tr key={v.id} className="border-b last:border-b-0 hover:bg-muted/30">
                        <td className="p-2 font-medium text-foreground">{v.name}</td>
                        <td className="p-2 font-mono text-muted-foreground">{v.sku}</td>
                        <td className="p-2 text-right font-medium">{formatVND(Number(v.price))}</td>
                        <td className="p-2 text-center font-mono font-medium">{v.stockQuantity}</td>
                        <td className="p-2 text-center font-mono text-amber-600 dark:text-amber-400 font-medium">
                          {v.reservedQuantity}
                        </td>
                        <td className="p-2 text-center">
                          <StockStatusBadge availableStock={v.availableStock} showCount={true} />
                        </td>
                        <td className="p-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                onAdjustStock({
                                  id: v.id,
                                  productId: product.id,
                                  productName: product.name,
                                  name: v.name,
                                  sku: v.sku,
                                  stockQuantity: v.stockQuantity,
                                  reservedQuantity: v.reservedQuantity,
                                  availableStock: v.availableStock,
                                })
                              }
                              className="h-6 text-[10px] px-1.5 gap-1"
                            >
                              <SlidersHorizontal className="size-3" />
                              Kho
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                onViewLedger({
                                  id: v.id,
                                  productId: product.id,
                                  productName: product.name,
                                  name: v.name,
                                  sku: v.sku,
                                })
                              }
                              className="h-6 text-[10px] px-1.5 gap-1 text-muted-foreground hover:text-foreground"
                            >
                              <History className="size-3" />
                              Sổ cái
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TableCell>
          </TableRow>
        );
      }}
    />
  );
}
