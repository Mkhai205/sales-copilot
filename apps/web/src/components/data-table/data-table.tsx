'use client';

import * as React from 'react';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

export interface DataTableEmptyState {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export interface DataTablePagination {
  page: number;
  totalPages: number;
  total?: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

interface DataTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, any>[];
  /** Stable row key — defaults to row index */
  getRowKey?: (row: TData, index: number) => string;
  isLoading?: boolean;
  skeletonRows?: number;
  emptyState?: DataTableEmptyState;
  pagination?: DataTablePagination;
  /** Render extra content under an expanded row (products variants table) */
  renderExpanded?: (row: TData, index: number) => React.ReactNode;
  onRowClick?: (row: TData) => void;
  className?: string;
}

/**
 * Shared data table built on TanStack Table (core row model + manual
 * pagination) and the shadcn table primitives. Rendering-heavy cells stay in
 * the caller's `columns` config — badges, links, dropdown actions, etc.
 */
export function DataTable<TData>({
  data,
  columns,
  getRowKey,
  isLoading = false,
  skeletonRows = 5,
  emptyState,
  pagination,
  renderExpanded,
  onRowClick,
  className,
}: DataTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    getRowId: getRowKey ? (row, index) => getRowKey(row, index) : undefined,
  });

  const rows = table.getRowModel().rows;
  const colSpan = columns.length;

  if (!isLoading && rows.length === 0 && emptyState) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center',
          className,
        )}
      >
        {emptyState.icon}
        <p className="text-sm font-medium text-foreground">{emptyState.title}</p>
        {emptyState.description && (
          <p className="text-xs text-muted-foreground">{emptyState.description}</p>
        )}
        {emptyState.action && <div className="mt-2">{emptyState.action}</div>}
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)}>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  const meta = header.column.columnDef.meta as
                    { headerClassName?: string } | undefined;
                  return (
                    <TableHead key={header.id} className={meta?.headerClassName}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: skeletonRows }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    {Array.from({ length: colSpan }).map((_, j) => (
                      <TableCell key={`skeleton-${i}-${j}`}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : rows.map(row => (
                  <React.Fragment key={row.id}>
                    <TableRow
                      className={onRowClick ? 'cursor-pointer' : undefined}
                      onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                      data-state={row.getIsSelected() ? 'selected' : undefined}
                    >
                      {row.getVisibleCells().map(cell => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                    {renderExpanded && renderExpanded(row.original, row.index)}
                  </React.Fragment>
                ))}
          </TableBody>
        </Table>
      </div>

      {pagination && (
        <div className="flex items-center justify-between gap-2 px-2 py-3">
          <p className="text-xs text-muted-foreground">
            {typeof pagination.total === 'number'
              ? `Tổng ${pagination.total} kết quả`
              : `Trang ${pagination.page} / ${pagination.totalPages}`}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={pagination.isLoading || pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="px-2 text-xs text-muted-foreground">
              {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={pagination.isLoading || pagination.page >= pagination.totalPages}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
