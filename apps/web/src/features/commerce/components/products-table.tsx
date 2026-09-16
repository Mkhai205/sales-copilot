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
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StockStatusBadge } from './stock-status-badge';
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
import { formatVND } from '@/features/commerce/lib/currency';
import { TargetVariantForAdjustment } from './stock-adjustment-dialog';

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

  const toggleExpand = (id: string) => {
    setExpandedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground border rounded-lg bg-card/40">
        <Package className="size-10 opacity-30 mb-3" />
        <h3 className="text-sm font-semibold text-foreground">Không tìm thấy sản phẩm nào</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          Thử điều chỉnh bộ lọc hoặc từ khóa tìm kiếm, hoặc bấm "Thêm sản phẩm" để khởi tạo danh mục
          mới.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card overflow-hidden shadow-2xs">
      <Table>
        <TableHeader className="bg-muted/40 text-[11px]">
          <TableRow>
            <TableHead className="w-8 p-2"></TableHead>
            <TableHead className="w-12 p-2">Ảnh</TableHead>
            <TableHead className="min-w-[200px]">Tên sản phẩm & SKU</TableHead>
            <TableHead className="w-32">Danh mục</TableHead>
            <TableHead className="w-24 text-right">Giá niêm yết</TableHead>
            <TableHead className="w-28 text-center">Biến thể SKU</TableHead>
            <TableHead className="w-36 text-center">Tồn khả dụng</TableHead>
            <TableHead className="w-10 p-2"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="text-xs">
          {products.map(product => {
            const isExpanded = expandedRowIds.has(product.id);
            const variants = product.variants || [];
            const totalAvailable = product.totalAvailable ?? 0;

            return (
              <React.Fragment key={product.id}>
                <TableRow className="hover:bg-muted/30 transition-colors group">
                  {/* Expand Toggle */}
                  <TableCell className="p-2 text-center">
                    {variants.length > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleExpand(product.id)}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="size-3.5" />
                        ) : (
                          <ChevronRight className="size-3.5" />
                        )}
                      </button>
                    )}
                  </TableCell>

                  {/* Thumbnail Image */}
                  <TableCell className="p-2">
                    <div className="size-9 rounded-md border bg-muted/40 overflow-hidden flex items-center justify-center">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="size-full object-cover"
                        />
                      ) : (
                        <Package className="size-4 text-muted-foreground opacity-50" />
                      )}
                    </div>
                  </TableCell>

                  {/* Name & SKU */}
                  <TableCell className="py-2.5">
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground text-xs line-clamp-1">
                        {product.name}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <code className="text-[11px] font-mono text-muted-foreground">
                          {product.sku}
                        </code>
                        {!product.isActive && (
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1 py-0 h-3.5 border-dashed"
                          >
                            Đã ẩn
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* Category */}
                  <TableCell className="py-2.5">
                    {product.category ? (
                      <Badge variant="secondary" className="text-[10px] font-normal px-2 py-0.5">
                        <Tag className="size-2.5 mr-1 opacity-70" />
                        {product.category}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground/60 text-[11px]">—</span>
                    )}
                  </TableCell>

                  {/* Base Price */}
                  <TableCell className="py-2.5 text-right font-medium">
                    {formatVND(Number(product.basePrice))}
                  </TableCell>

                  {/* Variant Count */}
                  <TableCell className="py-2.5 text-center">
                    <Badge variant="outline" className="text-[11px] font-mono px-1.5 py-0">
                      {variants.length} SKU
                    </Badge>
                  </TableCell>

                  {/* Stock Badge */}
                  <TableCell className="py-2.5 text-center">
                    <StockStatusBadge availableStock={totalAvailable} />
                  </TableCell>

                  {/* Actions Dropdown */}
                  <TableCell className="p-2 text-right">
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
                  </TableCell>
                </TableRow>

                {/* EXPANDABLE ROW: VARIANTS LIST */}
                {isExpanded && variants.length > 0 && (
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
                                <td className="p-2 text-right font-medium">
                                  {formatVND(Number(v.price))}
                                </td>
                                <td className="p-2 text-center font-mono font-medium">
                                  {v.stockQuantity}
                                </td>
                                <td className="p-2 text-center font-mono text-amber-600 dark:text-amber-400 font-medium">
                                  {v.reservedQuantity}
                                </td>
                                <td className="p-2 text-center">
                                  <StockStatusBadge
                                    availableStock={v.availableStock}
                                    showCount={true}
                                  />
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
                )}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
