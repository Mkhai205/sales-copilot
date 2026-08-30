'use client';

import * as React from 'react';
import { Paperclip, Smile, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Kbd } from '@/components/ui/kbd';
import { cn } from '@/lib/utils';
import { useSendMessage } from './hooks/use-send-message';

export interface ChatComposerProps {
  conversationId: string;
  workspaceSlug?: string;
  workspaceId?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onSent?: () => void;
}

export function ChatComposer({
  conversationId,
  workspaceSlug,
  workspaceId,
  placeholder = "Type a message... (Press Enter to send, '/' for canned responses)",
  disabled = false,
  className,
  onSent,
}: ChatComposerProps) {
  const [content, setContent] = React.useState('');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const { mutate: sendMessage, isPending } = useSendMessage({
    conversationId,
    workspaceSlug,
    workspaceId,
  });

  const canSend = content.trim().length > 0 && !isPending && !disabled;

  // Auto-resize textarea height as content changes
  const adjustHeight = React.useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 160); // Max ~6-7 lines
    textarea.style.height = `${newHeight}px`;
  }, []);

  React.useEffect(() => {
    adjustHeight();
  }, [content, adjustHeight]);

  const handleSend = React.useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed || isPending || disabled) return;

    sendMessage(
      { content: trimmed },
      {
        onSuccess: () => {
          setContent('');
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.focus();
          }
          onSent?.();
        },
      },
    );
  }, [content, isPending, disabled, sendMessage, onSent]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ignore composition events (e.g. IME Vietnamese / Japanese / Chinese)
    if (e.nativeEvent.isComposing) return;

    // Send on Enter (without Shift) OR Cmd/Ctrl + Enter
    if ((e.key === 'Enter' && !e.shiftKey) || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className={cn(
        'shrink-0 border-t border-border/80 p-3 bg-card/30 transition-colors',
        disabled && 'opacity-60 pointer-events-none',
        className,
      )}
    >
      <div className="rounded-lg border border-border bg-background focus-within:border-ring focus-within:ring-1 focus-within:ring-ring transition-all shadow-xs">
        {/* Text Input Area */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isPending}
          rows={1}
          className="w-full resize-none bg-transparent p-3 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none max-h-40 overflow-y-auto leading-relaxed"
          aria-label="Message input"
        />

        {/* Composer Action Toolbar */}
        <div className="flex items-center justify-between border-t border-border/40 px-3 py-1.5 bg-muted/20">
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  disabled={disabled || isPending}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Attach file"
                >
                  <Paperclip className="size-3.5" data-icon="inline-start" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <span className="text-xs">Attach file (Coming soon)</span>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  disabled={disabled || isPending}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Insert emoji"
                >
                  <Smile className="size-3.5" data-icon="inline-start" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <span className="text-xs">Emoji & Canned responses</span>
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  disabled={!canSend}
                  onClick={handleSend}
                  className="h-7 text-xs font-medium gap-1.5 px-3 shadow-xs"
                >
                  {isPending ? (
                    <>
                      <Spinner className="size-3" data-icon="inline-start" />
                      <span>Sending</span>
                    </>
                  ) : (
                    <>
                      <span>Send</span>
                      <Send className="size-3" data-icon="inline-end" />
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="flex items-center gap-1.5">
                <span>Send message</span>
                <Kbd className="text-[10px] py-0 px-1 font-mono">↵ Enter</Kbd>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}
