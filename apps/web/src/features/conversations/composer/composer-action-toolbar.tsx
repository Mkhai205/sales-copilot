'use client';

import { Paperclip, Send, Lock, MessageSquareQuote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Kbd } from '@/components/ui/kbd';
import { cn } from '@/lib/utils';
import { EmojiPickerPopover } from './emoji-picker-popover';

interface ComposerActionToolbarProps {
  isNote: boolean;
  disabled: boolean;
  isPending: boolean;
  canSend: boolean;
  isPickerOpen: boolean;
  onAttachClick: () => void;
  onTogglePicker: () => void;
  onEmojiSelect: (emoji: string) => void;
  onSend: () => void;
}

export function ComposerActionToolbar({
  isNote,
  disabled,
  isPending,
  canSend,
  isPickerOpen,
  onAttachClick,
  onTogglePicker,
  onEmojiSelect,
  onSend,
}: ComposerActionToolbarProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between border-t px-3 py-1.5 transition-colors',
        isNote ? 'border-warning/20 bg-warning/5' : 'border-border/40 bg-muted/20',
      )}
    >
      <div className="flex items-center gap-1">
        {/* Attachment File Trigger */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={disabled || isPending}
              onClick={onAttachClick}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Đính kèm tệp"
            >
              <Paperclip className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <span className="text-xs">{'Đính kèm tệp (Hình ảnh, PDF, tài liệu tối đa 10MB)'}</span>
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
              onClick={onTogglePicker}
              className={cn(
                'text-muted-foreground hover:text-foreground',
                isPickerOpen && 'bg-primary/10 text-primary',
              )}
              aria-label="Tin nhắn mẫu"
            >
              <MessageSquareQuote className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <span className="text-xs">{"Tin nhắn mẫu (Gõ '/')"}</span>
          </TooltipContent>
        </Tooltip>

        <EmojiPickerPopover onEmojiSelect={onEmojiSelect} disabled={disabled || isPending} />
      </div>

      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="sm"
              disabled={!canSend}
              onClick={onSend}
              className={cn(
                'h-7 text-xs font-medium gap-1.5 px-3 shadow-xs transition-colors',
                isNote &&
                  'bg-warning hover:bg-warning text-white dark:bg-warning dark:hover:bg-warning focus-visible:ring-warning',
              )}
            >
              {isPending ? (
                <>
                  <Spinner className="size-3" />
                  <span>{isNote ? 'Đang lưu...' : 'Gửi'}</span>
                </>
              ) : isNote ? (
                <>
                  <Lock className="size-3" />
                  <span>{'Ghi chú nội bộ'}</span>
                </>
              ) : (
                <>
                  <span>{'Gửi'}</span>
                  <Send className="size-3" data-icon="inline-end" />
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="flex items-center gap-1.5">
            <span>{isNote ? 'Lưu ghi chú nội bộ' : 'Gửi tin nhắn'}</span>
            <Kbd className="text-[10px] py-0 px-1 font-mono">↵ Enter</Kbd>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
