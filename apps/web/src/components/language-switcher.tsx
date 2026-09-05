'use client';

import * as React from 'react';
import { Globe, Check } from 'lucide-react';
import { useI18n, SUPPORTED_LOCALES, LOCALES_META, type Locale } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface LanguageSwitcherProps {
  variant?: 'button' | 'dropdown' | 'sub';
  className?: string;
}

/**
 * Dropdown sub-menu specifically designed for NavUser sidebar dropdown
 */
export function LanguageSwitcherSubMenu() {
  const { locale, setLocale, t } = useI18n();

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2 cursor-pointer">
        <Globe className="size-4" />
        <span>{t('common.language')}</span>
        <span className="ml-auto text-[11px] font-normal text-muted-foreground mr-1">
          {LOCALES_META[locale].nativeLabel}
        </span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="min-w-36">
        {SUPPORTED_LOCALES.map(loc => {
          const meta = LOCALES_META[loc];
          const isSelected = loc === locale;
          return (
            <DropdownMenuItem
              key={loc}
              className="gap-2 cursor-pointer justify-between"
              onClick={() => setLocale(loc)}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{meta.flag}</span>
                <span className={cn('text-xs', isSelected && 'font-medium text-foreground')}>
                  {meta.nativeLabel}
                </span>
              </div>
              {isSelected && <Check className="size-3.5 text-primary ml-2" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

/**
 * Standalone button / dropdown switcher (used in Auth header or Navbar)
 */
export function LanguageSwitcher({ variant = 'dropdown', className }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();
  const currentMeta = LOCALES_META[locale];

  if (variant === 'button') {
    const nextLocale: Locale = locale === 'vi' ? 'en' : 'vi';
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setLocale(nextLocale)}
        className={cn(
          'h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground',
          className,
        )}
        title={t('common.language')}
      >
        <Globe className="size-3.5" />
        <span>
          {currentMeta.flag} {currentMeta.nativeLabel}
        </span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-8 gap-2 px-2.5 text-xs bg-background/80 backdrop-blur-xs border-border/80 shadow-xs cursor-pointer hover:bg-accent',
            className,
          )}
        >
          <Globe className="size-3.5 text-muted-foreground" />
          <span className="font-medium">
            {currentMeta.flag} {currentMeta.nativeLabel}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        {SUPPORTED_LOCALES.map(loc => {
          const meta = LOCALES_META[loc];
          const isSelected = loc === locale;
          return (
            <DropdownMenuItem
              key={loc}
              className="gap-2 cursor-pointer justify-between"
              onClick={() => setLocale(loc)}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{meta.flag}</span>
                <span className={cn('text-xs', isSelected && 'font-medium text-foreground')}>
                  {meta.nativeLabel}
                </span>
              </div>
              {isSelected && <Check className="size-3.5 text-primary ml-2" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
