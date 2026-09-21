'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, RefreshCw, X, Calendar as CalendarIcon } from 'lucide-react';

export type DatePreset = 'all' | 'today' | '7days' | '30days' | 'custom';

export interface ReconciliationFilterValues {
  search: string;
  status: string;
  datePreset: DatePreset;
  from?: string;
  to?: string;
}

interface ReconciliationFilterToolbarProps {
  filters: ReconciliationFilterValues;
  onFilterChange: (newFilters: Partial<ReconciliationFilterValues>) => void;
  onRefresh: () => void;
  isFetching?: boolean;
}

export function ReconciliationFilterToolbar({
  filters,
  onFilterChange,
  onRefresh,
  isFetching = false,
}: ReconciliationFilterToolbarProps) {
  const [searchInput, setSearchInput] = React.useState(filters.search);

  // Debounce search input
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        onFilterChange({ search: searchInput });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, filters.search, onFilterChange]);

  const handlePresetClick = (preset: DatePreset) => {
    if (preset === 'all') {
      onFilterChange({ datePreset: 'all', from: undefined, to: undefined });
    } else if (preset === 'today') {
      const today = new Date().toISOString().slice(0, 10);
      onFilterChange({ datePreset: 'today', from: today, to: today });
    } else if (preset === '7days') {
      const now = new Date();
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      onFilterChange({
        datePreset: '7days',
        from: past.toISOString().slice(0, 10),
        to: now.toISOString().slice(0, 10),
      });
    } else if (preset === '30days') {
      const now = new Date();
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      onFilterChange({
        datePreset: '30days',
        from: past.toISOString().slice(0, 10),
        to: now.toISOString().slice(0, 10),
      });
    } else {
      onFilterChange({ datePreset: 'custom' });
    }
  };

  const hasActiveFilters =
    filters.search ||
    (filters.status && filters.status !== 'ALL') ||
    filters.datePreset !== 'all' ||
    filters.from ||
    filters.to;

  const handleReset = () => {
    setSearchInput('');
    onFilterChange({
      search: '',
      status: 'ALL',
      datePreset: 'all',
      from: undefined,
      to: undefined,
    });
  };

  return (
    <div className="space-y-3 bg-card border rounded-lg p-3 shadow-2xs">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo memo, mã GD, số tiền..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="pl-8 text-sm h-9"
          />
          {searchInput && (
            <button
              onClick={() => {
                setSearchInput('');
                onFilterChange({ search: '' });
              }}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap justify-end">
          {/* Status Filter */}
          <Select value={filters.status} onValueChange={val => onFilterChange({ status: val })}>
            <SelectTrigger className="w-[145px] h-9 text-xs">
              <SelectValue placeholder="Trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
              <SelectItem value="SUCCESS">Đã đối soát</SelectItem>
              <SelectItem value="PENDING">Chờ đối soát</SelectItem>
              <SelectItem value="FAILED">Thất bại</SelectItem>
            </SelectContent>
          </Select>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Đặt lại
            </Button>
          )}

          {/* Refresh button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isFetching}
            className="h-9 px-2.5 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>
        </div>
      </div>

      {/* Date Presets Row */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t text-xs flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-muted-foreground font-medium mr-1.5 flex items-center">
            <CalendarIcon className="w-3.5 h-3.5 mr-1 inline" /> Thời gian:
          </span>
          {(
            [
              { key: 'all', label: 'Tất cả' },
              { key: 'today', label: 'Hôm nay' },
              { key: '7days', label: '7 ngày qua' },
              { key: '30days', label: '30 ngày qua' },
              { key: 'custom', label: 'Tùy chỉnh' },
            ] as const
          ).map(p => (
            <Button
              key={p.key}
              variant={filters.datePreset === p.key ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => handlePresetClick(p.key)}
              className={`h-7 px-2 text-xs ${
                filters.datePreset === p.key ? 'font-semibold shadow-2xs' : 'text-muted-foreground'
              }`}
            >
              {p.label}
            </Button>
          ))}
        </div>

        {/* Custom date range inputs */}
        {filters.datePreset === 'custom' && (
          <div className="flex items-center gap-1.5 animate-in fade-in duration-200">
            <Input
              type="date"
              value={filters.from || ''}
              onChange={e => onFilterChange({ from: e.target.value })}
              className="h-7 text-xs w-32 px-2"
            />
            <span className="text-muted-foreground">-</span>
            <Input
              type="date"
              value={filters.to || ''}
              onChange={e => onFilterChange({ to: e.target.value })}
              className="h-7 text-xs w-32 px-2"
            />
          </div>
        )}
      </div>
    </div>
  );
}
