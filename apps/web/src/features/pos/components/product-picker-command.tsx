'use client';

import * as React from 'react';
import { ShoppingBag } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { usePosProducts, type FlatProductVariant } from '../hooks/use-pos-products';
import { StockStatusBadge } from './stock-status-badge';
import { cn } from '@/lib/utils';

interface ProductPickerCommandProps {
  workspaceId?: string;
  onSelectVariant: (variant: FlatProductVariant) => void;
  disabled?: boolean;
}

export function ProductPickerCommand({
  workspaceId,
  onSelectVariant,
  disabled = false,
}: ProductPickerCommandProps) {
  const [search, setSearch] = React.useState('');
  const [isOpen, setIsOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const { searchVariants, isLoading } = usePosProducts(workspaceId);

  const filteredVariants = React.useMemo(() => {
    return searchVariants(search);
  }, [search, searchVariants]);

  // Click-outside listener
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global Ctrl+K hotkey to focus product picker
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <Command
        className="rounded-lg border border-input shadow-xs bg-background overflow-visible"
        shouldFilter={false} // We do smart Vietnamese diacritic search ourselves
      >
        <div className="relative">
          <CommandInput
            ref={inputRef}
            placeholder="Tìm sản phẩm theo tên, SKU, mã vạch... (Ctrl+K)"
            className="text-xs"
            value={search}
            onValueChange={val => {
              setSearch(val);
              if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            disabled={disabled}
          />
          <kbd className="pointer-events-none absolute right-8 top-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
            <span className="text-xs">Ctrl</span>K
          </kbd>
        </div>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-md border bg-popover text-popover-foreground shadow-lg max-h-72 overflow-y-auto">
            <CommandList>
              {isLoading ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  Đang tải danh mục sản phẩm...
                </div>
              ) : filteredVariants.length === 0 ? (
                <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">
                  Không tìm thấy sản phẩm nào phù hợp
                </CommandEmpty>
              ) : (
                <CommandGroup heading={`Tìm thấy ${filteredVariants.length} phân loại`}>
                  {filteredVariants.map(v => {
                    const isOutOfStock = v.availableStock <= 0;
                    return (
                      <CommandItem
                        key={v.variantId}
                        value={v.variantId}
                        disabled={isOutOfStock || disabled}
                        onSelect={() => {
                          if (isOutOfStock) return;
                          onSelectVariant(v);
                          setIsOpen(false);
                          setSearch('');
                        }}
                        className={cn(
                          'flex items-center justify-between gap-3 px-3 py-2 cursor-pointer text-xs',
                          isOutOfStock && 'opacity-50 cursor-not-allowed',
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="size-8 rounded border bg-muted/40 flex items-center justify-center shrink-0 overflow-hidden">
                            {v.imageUrl ? (
                              <img
                                src={v.imageUrl}
                                alt={v.productName}
                                className="size-full object-cover"
                              />
                            ) : (
                              <ShoppingBag className="size-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium text-foreground truncate">
                              {v.productName}
                            </span>
                            <span className="text-[11px] text-muted-foreground truncate">
                              {v.variantName} • <code className="font-mono">{v.sku}</code>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-semibold text-xs text-foreground">
                            {formatCurrency(v.price)}
                          </span>
                          <StockStatusBadge availableStock={v.availableStock} />
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </div>
        )}
      </Command>
    </div>
  );
}
