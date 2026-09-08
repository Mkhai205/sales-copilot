'use client';

import * as React from 'react';
import { Tag } from 'lucide-react';
import { useQuickTags } from './hooks/use-quick-tags';
import type { ConversationResponseDto } from '@/lib/api/types';
import { cn } from '@/lib/utils';

interface QuickTagActionBarProps {
  workspaceId?: string;
  conversationId?: string;
  conversation?: ConversationResponseDto | null;
  className?: string;
}

export function QuickTagActionBar({
  workspaceId,
  conversationId,
  conversation,
  className,
}: QuickTagActionBarProps) {
  const { quickTags, activeTagTitles, toggleQuickTag, isProcessing } = useQuickTags({
    workspaceId,
    conversationId,
    conversation,
  });

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 bg-muted/30 border-t border-border/60 overflow-x-auto scrollbar-none text-xs shrink-0',
        className,
      )}
    >
      <div className="flex items-center gap-1 text-muted-foreground font-medium text-[11px] shrink-0 mr-1 select-none">
        <Tag className="size-3 text-muted-foreground/70" />
        <span className="hidden sm:inline">Thẻ nhanh:</span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {quickTags.map(tag => {
          const isActive = activeTagTitles.has(tag.title) || activeTagTitles.has(tag.label);

          return (
            <button
              key={tag.index}
              type="button"
              onClick={() => toggleQuickTag(tag)}
              disabled={isProcessing}
              title={`Phím tắt: ${tag.shortcut}`}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all cursor-pointer select-none',
                isActive
                  ? 'border-transparent text-white shadow-xs font-semibold'
                  : 'bg-background hover:bg-muted text-muted-foreground border-border/80 hover:text-foreground',
                isProcessing && 'opacity-60 cursor-not-allowed',
              )}
              style={isActive ? { backgroundColor: tag.color, borderColor: tag.color } : undefined}
            >
              {!isActive && (
                <span
                  className="size-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
              )}
              <span>{tag.label}</span>
              <kbd
                className={cn(
                  'font-mono text-[9px] px-1 py-0 rounded leading-none transition-opacity',
                  isActive ? 'bg-black/20 text-white' : 'bg-muted text-muted-foreground',
                )}
              >
                {tag.shortcut}
              </kbd>
            </button>
          );
        })}
      </div>
    </div>
  );
}
