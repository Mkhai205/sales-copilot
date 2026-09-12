'use client';

import * as React from 'react';
import { Search, RotateCcw, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlatformAuditAction, PlatformAuditTargetType } from '@sales-copilot/shared-contracts';
import { isValidDateFilterRange } from '../utils/audit-log-helpers';

export interface AuditLogFilterToolbarProps {
  searchEmail: string;
  onSearchEmailChange: (value: string) => void;
  targetId: string;
  onTargetIdChange: (value: string) => void;
  action: string;
  onActionChange: (action: string) => void;
  targetType: string;
  onTargetTypeChange: (type: string) => void;
  startDate: string;
  onStartDateChange: (date: string) => void;
  endDate: string;
  onEndDateChange: (date: string) => void;
  onReset: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function AuditLogFilterToolbar({
  searchEmail,
  onSearchEmailChange,
  targetId,
  onTargetIdChange,
  action,
  onActionChange,
  targetType,
  onTargetTypeChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  onReset,
  onRefresh,
  isRefreshing,
}: AuditLogFilterToolbarProps) {
  const isFiltered = Boolean(
    searchEmail || targetId || action !== 'ALL' || targetType !== 'ALL' || startDate || endDate,
  );

  const isDateRangeInvalid = !isValidDateFilterRange(startDate, endDate);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-1 flex-wrap items-center gap-2.5 min-w-[280px]">
          {/* Email Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchEmail}
              onChange={e => onSearchEmailChange(e.target.value)}
              placeholder="Tìm theo email quản trị viên..."
              className="pl-8.5 h-8 text-xs"
            />
          </div>

          {/* Target ID input */}
          <div className="relative flex-1 min-w-[150px] max-w-xs">
            <Input
              value={targetId}
              onChange={e => onTargetIdChange(e.target.value)}
              placeholder="Mã đối tượng (ID/Key)..."
              className="h-8 text-xs"
            />
          </div>

          {/* Action Filter */}
          <Select value={action} onValueChange={onActionChange}>
            <SelectTrigger className="h-8 text-xs min-w-[150px]">
              <SelectValue placeholder="Hành động" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả hành động</SelectItem>
              <SelectItem value={PlatformAuditAction.WORKSPACE_SUSPENDED}>Tạm khóa Shop</SelectItem>
              <SelectItem value={PlatformAuditAction.WORKSPACE_ACTIVATED}>
                Kích hoạt Shop
              </SelectItem>
              <SelectItem value={PlatformAuditAction.PLAN_CHANGED}>Đổi gói cước</SelectItem>
              <SelectItem value={PlatformAuditAction.QUOTA_UPDATED}>Cập nhật Quota</SelectItem>
              <SelectItem value={PlatformAuditAction.SYSTEM_SETTING_UPDATED}>
                Sửa cấu hình
              </SelectItem>
            </SelectContent>
          </Select>

          {/* TargetType Filter */}
          <Select value={targetType} onValueChange={onTargetTypeChange}>
            <SelectTrigger className="h-8 text-xs min-w-[130px]">
              <SelectValue placeholder="Loại đối tượng" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả đối tượng</SelectItem>
              <SelectItem value={PlatformAuditTargetType.WORKSPACE}>Workspace</SelectItem>
              <SelectItem value={PlatformAuditTargetType.SYSTEM_SETTING}>Cấu hình</SelectItem>
              <SelectItem value={PlatformAuditTargetType.USER}>Người dùng</SelectItem>
            </SelectContent>
          </Select>

          {/* Date Range: Start Date */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Từ:</span>
            <Input
              type="date"
              value={startDate}
              onChange={e => onStartDateChange(e.target.value)}
              className="h-8 text-xs w-[130px]"
            />
          </div>

          {/* Date Range: End Date */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Đến:</span>
            <Input
              type="date"
              value={endDate}
              onChange={e => onEndDateChange(e.target.value)}
              className="h-8 text-xs w-[130px]"
            />
          </div>

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

        {/* Refresh button */}
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-8 px-2.5 text-xs gap-1.5 shrink-0"
          >
            <RefreshCw className={`size-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </Button>
        )}
      </div>

      {isDateRangeInvalid && (
        <p className="text-[11px] font-medium text-destructive">
          * Ngày bắt đầu không được lớn hơn ngày kết thúc.
        </p>
      )}
    </div>
  );
}
