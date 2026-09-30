'use client';

import { Lock, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Kbd } from '@/components/ui/kbd';
import { cn } from '@/lib/utils';
import type { ComposerMode } from './hooks/use-composer-content';

interface ComposerModeHeaderProps {
  isNote: boolean;
  disabled: boolean;
  isPending: boolean;
  setMode: (mode: ComposerMode) => void;
}

export function ComposerModeHeader({
  isNote,
  disabled,
  isPending,
  setMode,
}: ComposerModeHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between border-b px-2.5 py-1.5 transition-colors',
        isNote ? 'border-warning/20 bg-warning/10' : 'border-border/40 bg-muted/20',
      )}
    >
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setMode('reply')}
          disabled={disabled || isPending}
          className={cn(
            'h-auto w-auto flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-all cursor-pointer',
            !isNote
              ? 'bg-background text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/40',
          )}
        >
          <MessageSquare className="size-3.5" />
          <span>{'Trả lời'}</span>
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={() => setMode('note')}
          disabled={disabled || isPending}
          className={cn(
            'h-auto w-auto flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-all cursor-pointer',
            isNote
              ? 'bg-warning/25 text-warning dark:text-warning font-semibold shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/40',
          )}
        >
          <Lock className="size-3.5" />
          <span>{'Ghi chú nội bộ'}</span>
        </Button>
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <div className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground/70 cursor-default select-none">
            <span>{'Chuyển đổi:'}</span>
            <Kbd className="text-[9px] py-0 px-1">Alt+N</Kbd>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <span className="text-xs">{'Chuyển đổi giữa Trả lời và Ghi chú nội bộ (Alt+N)'}</span>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
