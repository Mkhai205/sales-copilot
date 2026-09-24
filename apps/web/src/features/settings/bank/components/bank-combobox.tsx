'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { VIETNAM_BANKS, type VietnamBank } from '../constants/vietnam-banks';
import Image from 'next/image';

interface BankComboboxProps {
  selectedBin: string;
  onSelectBank: (bank: VietnamBank) => void;
  disabled?: boolean;
}

export function BankCombobox({ selectedBin, onSelectBank, disabled }: BankComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const selectedBank = React.useMemo(
    () => VIETNAM_BANKS.find(b => b.bin === selectedBin),
    [selectedBin],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between h-14 px-3.5 text-left font-normal bg-background hover:bg-muted/30 border-border/80 shadow-2xs"
        >
          {selectedBank ? (
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="relative h-9 w-24 flex items-center justify-center overflow-hidden">
                {selectedBank.logo ? (
                  <Image
                    src={selectedBank.logo}
                    alt={selectedBank.shortName}
                    fill
                    sizes="96px"
                    unoptimized
                    className="h-full w-full object-contain"
                    onError={e => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <Landmark className="w-5 h-5 text-muted-foreground shrink-0" />
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground text-sm">
                    {selectedBank.shortName}
                  </span>
                  <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                    BIN: {selectedBank.bin}
                  </span>
                </div>
                <span className="text-[11.5px] text-muted-foreground truncate">
                  {selectedBank.name}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-muted-foreground text-xs py-1">
              <div className="h-9 w-14 rounded-md bg-muted/50 border border-dashed border-border/80 flex items-center justify-center shrink-0">
                <Landmark className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-foreground text-xs">Chưa chọn ngân hàng</span>
                <span className="text-[11px] text-muted-foreground">
                  Bấm để chọn ngân hàng thụ hưởng (VietinBank, MB, VCB, Techcombank...)
                </span>
              </div>
            </div>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full" align="start">
        <Command>
          <CommandInput
            placeholder="Tìm theo tên (VietinBank, MB, VCB, TCB...), mã BIN..."
            className="text-xs h-10"
          />
          <CommandList>
            <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">
              Không tìm thấy ngân hàng phù hợp.
            </CommandEmpty>
            <CommandGroup heading="Danh sách ngân hàng hỗ trợ VietQR">
              {VIETNAM_BANKS.map(bank => {
                const isSelected = bank.bin === selectedBin;
                return (
                  <CommandItem
                    key={bank.bin}
                    value={`${bank.shortName} ${bank.code} ${bank.bin} ${bank.name}`}
                    onSelect={() => {
                      onSelectBank(bank);
                      setOpen(false);
                    }}
                    className="flex items-center justify-between p-2 cursor-pointer text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative h-8 w-20 flex items-center justify-center overflow-hidden">
                        <Image
                          src={bank.logo}
                          alt={bank.shortName}
                          fill
                          sizes="80px"
                          unoptimized
                          className="h-full w-full object-contain"
                          onError={e => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-foreground text-xs">
                            {bank.shortName}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono bg-muted/60 px-1 py-0.5 rounded">
                            BIN: {bank.bin}
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground truncate max-w-[280px]">
                          {bank.name}
                        </span>
                      </div>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
