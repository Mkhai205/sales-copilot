'use client';

import * as React from 'react';
import { Search, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BillingPlanType } from '@sales-copilot/shared-contracts';

export interface WorkspaceFilterToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  plan: string;
  onPlanChange: (plan: string) => void;
  status: string;
  onStatusChange: (status: string) => void;
  onReset: () => void;
}

export function WorkspaceFilterToolbar({
  search,
  onSearchChange,
  plan,
  onPlanChange,
  status,
  onStatusChange,
  onReset,
}: WorkspaceFilterToolbarProps) {
  const isFiltered = Boolean(search || plan !== 'ALL' || status !== 'ALL');

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-1 flex-wrap items-center gap-2.5 min-w-[280px]">
        {/* Search input */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Tìm theo tên shop, slug, email owner..."
            className="pl-8.5 h-8 text-xs"
          />
        </div>

        {/* Plan Filter */}
        <Select value={plan} onValueChange={onPlanChange}>
          <SelectTrigger className="h-8 text-xs min-w-[130px]">
            <SelectValue placeholder="Gói cước" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tất cả gói</SelectItem>
            <SelectItem value={BillingPlanType.FREE}>Gói FREE</SelectItem>
            <SelectItem value={BillingPlanType.STANDARD}>Gói STANDARD</SelectItem>
            <SelectItem value={BillingPlanType.ENTERPRISE}>Gói ENTERPRISE</SelectItem>
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select value={status} onValueChange={onStatusChange}>
          <SelectTrigger className="h-8 text-xs min-w-[140px]">
            <SelectValue placeholder="Trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
            <SelectItem value="ACTIVE">Đang hoạt động</SelectItem>
            <SelectItem value="SUSPENDED">Đã tạm khóa</SelectItem>
          </SelectContent>
        </Select>

        {/* Reset button */}
        {isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
          >
            <RotateCcw className="size-3.5" />
            <span>Đặt lại</span>
          </Button>
        )}
      </div>
    </div>
  );
}
