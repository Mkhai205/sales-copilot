'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { Smile } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Theme as EmojiTheme, EmojiStyle } from 'emoji-picker-react';
import type { EmojiClickData } from 'emoji-picker-react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

// Lazy load EmojiPicker to keep initial chat bundle small and fast
const DynamicEmojiPicker = dynamic(() => import('emoji-picker-react'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[380px] w-[320px] items-center justify-center bg-popover">
      <Spinner className="size-5 text-muted-foreground" />
    </div>
  ),
});

export interface EmojiPickerPopoverProps {
  onEmojiSelect: (emoji: string) => void;
  disabled?: boolean;
}

export function EmojiPickerPopover({ onEmojiSelect, disabled = false }: EmojiPickerPopoverProps) {
  const [open, setOpen] = React.useState(false);
  const [hasOpened, setHasOpened] = React.useState(false);
  const { resolvedTheme } = useTheme();

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen && !hasOpened) {
      setHasOpened(true);
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onEmojiSelect(emojiData.emoji);
  };

  const pickerTheme = resolvedTheme === 'dark' ? EmojiTheme.DARK : EmojiTheme.LIGHT;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <Tooltip open={open ? false : undefined}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant={open ? 'secondary' : 'ghost'}
              size="icon-xs"
              disabled={disabled}
              className={cn(
                'text-muted-foreground hover:text-foreground transition-colors',
                open && 'bg-primary/10 text-primary',
              )}
              aria-label="Insert emoji"
            >
              <Smile className="size-3.5" data-icon="inline-start" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">
          <span className="text-xs">Insert emoji</span>
        </TooltipContent>
      </Tooltip>

      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-auto p-0 border border-border/60 shadow-xl rounded-xl overflow-hidden bg-popover"
      >
        {hasOpened && (
          <DynamicEmojiPicker
            theme={pickerTheme}
            emojiStyle={EmojiStyle.NATIVE}
            onEmojiClick={handleEmojiClick}
            lazyLoadEmojis
            width={320}
            height={380}
            searchPlaceHolder="Search emoji..."
            previewConfig={{
              showPreview: false,
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
