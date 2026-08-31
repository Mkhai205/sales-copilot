'use client';

import * as React from 'react';
import { useTypingUsers } from './hooks/use-typing-users';
import { cn } from '@/lib/utils';

export interface TypingIndicatorProps {
  conversationId?: string | null;
  className?: string;
}

export function TypingIndicator({ conversationId, className }: TypingIndicatorProps) {
  const { isTyping, typingLabel } = useTypingUsers(conversationId);

  if (!isTyping || !typingLabel) {
    return null;
  }

  return (
    <div
      data-slot="typing-indicator"
      className={cn(
        'flex items-center gap-2 px-4 py-1.5 text-xs text-muted-foreground bg-background/50 border-t border-border/30 select-none animate-in fade-in-0 slide-in-from-bottom-1 duration-150',
        className,
      )}
    >
      {/* Animated Bouncing Dots */}
      <span className="flex items-center gap-0.5 shrink-0" aria-hidden="true">
        <span className="size-1 rounded-full bg-primary animate-bounce [animation-delay:-0.32s]" />
        <span className="size-1 rounded-full bg-primary animate-bounce [animation-delay:-0.16s]" />
        <span className="size-1 rounded-full bg-primary animate-bounce" />
      </span>

      <span className="truncate italic font-normal text-[11px] leading-none">{typingLabel}</span>
    </div>
  );
}
