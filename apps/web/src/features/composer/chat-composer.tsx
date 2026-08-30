'use client';

import * as React from 'react';
import { Paperclip, Smile, Send, Lock, MessageSquare, MessageSquareQuote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Kbd } from '@/components/ui/kbd';
import { cn } from '@/lib/utils';
import type { CannedResponseDto } from '@/lib/api/types';
import { useSendMessage } from './hooks/use-send-message';
import { CannedResponsePicker, type CannedResponsePickerHandle } from './canned-response-picker';

export type ComposerMode = 'reply' | 'note';

export interface ChatComposerProps {
  conversationId: string;
  workspaceSlug?: string;
  workspaceId?: string;
  placeholder?: string;
  defaultMode?: ComposerMode;
  disabled?: boolean;
  className?: string;
  onSent?: () => void;
}

function findSlashCommand(
  text: string,
  cursorPos: number,
): { slashIndex: number; query: string } | null {
  const textBeforeCursor = text.slice(0, cursorPos);
  const slashIndex = textBeforeCursor.lastIndexOf('/');

  if (slashIndex === -1) return null;

  // Ensure '/' is at the beginning of the text OR preceded by whitespace/newline
  if (slashIndex > 0) {
    const charBeforeSlash = textBeforeCursor[slashIndex - 1];
    if (!/\s/.test(charBeforeSlash)) {
      return null;
    }
  }

  // The text after '/' up to cursor
  const query = textBeforeCursor.slice(slashIndex + 1);

  // If query contains space or newline, it's no longer an active slash command
  if (/\s/.test(query)) {
    return null;
  }

  return { slashIndex, query };
}

export function ChatComposer({
  conversationId,
  workspaceSlug,
  workspaceId,
  placeholder,
  defaultMode = 'reply',
  disabled = false,
  className,
  onSent,
}: ChatComposerProps) {
  const [content, setContent] = React.useState('');
  const [mode, setMode] = React.useState<ComposerMode>(defaultMode);
  const [isPickerOpen, setIsPickerOpen] = React.useState(false);
  const [pickerSearch, setPickerSearch] = React.useState('');

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const pickerRef = React.useRef<CannedResponsePickerHandle>(null);

  const isNote = mode === 'note';

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

    setIsPickerOpen(false);

    sendMessage(
      {
        content: trimmed,
        isPrivate: isNote,
      },
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
  }, [content, isNote, isPending, disabled, sendMessage, onSent]);

  const handleSelectCannedResponse = (response: CannedResponseDto) => {
    const textarea = textareaRef.current;
    const currentContent = content;
    const cursorPos = textarea?.selectionStart ?? currentContent.length;

    const slashMatch = findSlashCommand(currentContent, cursorPos);

    let newContent: string;
    let newCursorPos: number;

    if (slashMatch) {
      // Replace from slashIndex to cursorPos with response.content
      const prefix = currentContent.slice(0, slashMatch.slashIndex);
      const suffix = currentContent.slice(cursorPos);
      newContent = `${prefix}${response.content}${suffix}`;
      newCursorPos = prefix.length + response.content.length;
    } else {
      // Insert at cursor
      const prefix = currentContent.slice(0, cursorPos);
      const suffix = currentContent.slice(cursorPos);
      newContent = `${prefix}${response.content}${suffix}`;
      newCursorPos = cursorPos + response.content.length;
    }

    setContent(newContent);
    setIsPickerOpen(false);
    setPickerSearch('');

    // Refocus and place cursor at the end of inserted content
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setContent(newText);

    // Check for slash command trigger
    const cursorPos = e.target.selectionStart;
    const slashMatch = findSlashCommand(newText, cursorPos);

    if (slashMatch !== null) {
      setIsPickerOpen(true);
      setPickerSearch(slashMatch.query);
    } else if (isPickerOpen) {
      setIsPickerOpen(false);
      setPickerSearch('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ignore composition events (e.g. IME Vietnamese / Japanese / Chinese)
    if (e.nativeEvent.isComposing) return;

    // If canned response picker is open, handle its navigation
    if (isPickerOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        pickerRef.current?.navigateDown();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        pickerRef.current?.navigateUp();
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (pickerRef.current && pickerRef.current.filteredCount > 0) {
          e.preventDefault();
          const selected = pickerRef.current.selectCurrent();
          if (selected) return;
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsPickerOpen(false);
        return;
      }
    }

    // Toggle note mode shortcut: Alt+N or Cmd/Ctrl + Shift + P
    if (
      (e.altKey && (e.key === 'n' || e.key === 'N')) ||
      ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'p' || e.key === 'P'))
    ) {
      e.preventDefault();
      setMode(prev => (prev === 'reply' ? 'note' : 'reply'));
      return;
    }

    // Send on Enter (without Shift) OR Cmd/Ctrl + Enter
    if ((e.key === 'Enter' && !e.shiftKey) || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
      e.preventDefault();
      handleSend();
    }
  };

  const dynamicPlaceholder =
    placeholder ||
    (isNote
      ? 'Add a private note (visible only to team members)... (Press Enter to add note)'
      : "Type a message... (Press Enter to send, '/' for canned responses)");

  return (
    <div
      className={cn(
        'relative shrink-0 border-t border-border/80 p-3 bg-card/30 transition-colors',
        disabled && 'opacity-60 pointer-events-none',
        className,
      )}
    >
      {/* Floating Canned Response Picker */}
      <CannedResponsePicker
        ref={pickerRef}
        isOpen={isPickerOpen}
        searchQuery={pickerSearch}
        onSelect={handleSelectCannedResponse}
        onClose={() => setIsPickerOpen(false)}
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
      />

      <div
        className={cn(
          'rounded-lg border transition-all shadow-xs overflow-hidden',
          isNote
            ? 'border-amber-500/50 bg-amber-500/[0.04] dark:bg-amber-500/[0.08] focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500/30'
            : 'border-border bg-background focus-within:border-ring focus-within:ring-1 focus-within:ring-ring',
        )}
      >
        {/* Mode Switcher Header */}
        <div
          className={cn(
            'flex items-center justify-between border-b px-2.5 py-1.5 transition-colors',
            isNote ? 'border-amber-500/20 bg-amber-500/10' : 'border-border/40 bg-muted/20',
          )}
        >
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMode('reply')}
              disabled={disabled || isPending}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-all cursor-pointer',
                !isNote
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/40',
              )}
            >
              <MessageSquare className="size-3.5" data-icon="inline-start" />
              <span>Reply</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('note')}
              disabled={disabled || isPending}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-all cursor-pointer',
                isNote
                  ? 'bg-amber-500/25 text-amber-700 dark:text-amber-300 font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/40',
              )}
            >
              <Lock className="size-3.5" data-icon="inline-start" />
              <span>Private Note</span>
            </button>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground/70 cursor-default select-none">
                <span>Toggle:</span>
                <Kbd className="text-[9px] py-0 px-1">Alt+N</Kbd>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              <span className="text-xs">Switch between Reply and Private Note (Alt+N)</span>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Text Input Area */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          placeholder={dynamicPlaceholder}
          disabled={disabled || isPending}
          rows={1}
          className={cn(
            'w-full resize-none bg-transparent p-3 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none max-h-40 overflow-y-auto leading-relaxed',
            isNote && 'placeholder:text-amber-700/60 dark:placeholder:text-amber-300/50',
          )}
          aria-label={isNote ? 'Private note input' : 'Message input'}
        />

        {/* Composer Action Toolbar */}
        <div
          className={cn(
            'flex items-center justify-between border-t px-3 py-1.5 transition-colors',
            isNote ? 'border-amber-500/20 bg-amber-500/5' : 'border-border/40 bg-muted/20',
          )}
        >
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

            {/* Canned Responses Trigger Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant={isPickerOpen ? 'secondary' : 'ghost'}
                  size="icon-xs"
                  disabled={disabled || isPending}
                  onClick={() => {
                    setIsPickerOpen(prev => !prev);
                    setPickerSearch('');
                    textareaRef.current?.focus();
                  }}
                  className={cn(
                    'text-muted-foreground hover:text-foreground',
                    isPickerOpen && 'bg-primary/10 text-primary',
                  )}
                  aria-label="Canned responses"
                >
                  <MessageSquareQuote className="size-3.5" data-icon="inline-start" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <span className="text-xs">Canned responses (Type &apos;/&apos;)</span>
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
                <span className="text-xs">Insert emoji (Coming soon)</span>
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
                  className={cn(
                    'h-7 text-xs font-medium gap-1.5 px-3 shadow-xs transition-colors',
                    isNote &&
                      'bg-amber-600 hover:bg-amber-500 text-white dark:bg-amber-600 dark:hover:bg-amber-500 focus-visible:ring-amber-500',
                  )}
                >
                  {isPending ? (
                    <>
                      <Spinner className="size-3" data-icon="inline-start" />
                      <span>{isNote ? 'Saving' : 'Sending'}</span>
                    </>
                  ) : isNote ? (
                    <>
                      <Lock className="size-3" data-icon="inline-start" />
                      <span>Add Note</span>
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
                <span>{isNote ? 'Save private note' : 'Send message'}</span>
                <Kbd className="text-[10px] py-0 px-1 font-mono">↵ Enter</Kbd>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}
