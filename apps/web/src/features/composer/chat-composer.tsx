'use client';

import * as React from 'react';
import {
  Paperclip,
  Smile,
  Send,
  Lock,
  MessageSquare,
  MessageSquareQuote,
  UploadCloud,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Kbd } from '@/components/ui/kbd';
import { cn } from '@/lib/utils';
import type { CannedResponseDto } from '@/lib/api/types';
import { useSendMessage } from './hooks/use-send-message';
import { useTypingIndicator } from './hooks/use-typing-indicator';
import { CannedResponsePicker, type CannedResponsePickerHandle } from './canned-response-picker';
import { AttachmentPreviewBar } from './attachment-preview-bar';

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

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

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

import { useI18n } from '@/lib/i18n';

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
  const { t } = useI18n();
  const [content, setContent] = React.useState('');
  const [attachments, setAttachments] = React.useState<File[]>([]);
  const [mode, setMode] = React.useState<ComposerMode>(defaultMode);
  const [isPickerOpen, setIsPickerOpen] = React.useState(false);
  const [pickerSearch, setPickerSearch] = React.useState('');
  const [isDraggingOver, setIsDraggingOver] = React.useState(false);

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const pickerRef = React.useRef<CannedResponsePickerHandle>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const isNote = mode === 'note';

  const { mutate: sendMessage, isPending } = useSendMessage({
    conversationId,
    workspaceSlug,
    workspaceId,
  });

  const { startTyping, stopTyping } = useTypingIndicator({
    conversationId,
    disabled: disabled || isPending,
  });

  const canSend = (content.trim().length > 0 || attachments.length > 0) && !isPending && !disabled;

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

  const addFiles = React.useCallback((newFiles: FileList | File[]) => {
    const validFiles: File[] = [];

    Array.from(newFiles).forEach(file => {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast.error(`File "${file.name}" exceeds 10MB limit`, {
          description: 'Please select a file smaller than 10MB.',
        });
      } else {
        validFiles.push(file);
      }
    });

    if (validFiles.length > 0) {
      setAttachments(prev => [...prev, ...validFiles]);
    }
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      e.target.value = ''; // Reset input to allow selecting same file again
    }
  };

  const handleRemoveAttachment = (indexToRemove: number) => {
    setAttachments(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Clipboard paste handler for direct image paste (Ctrl+V / Cmd+V)
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const clipboardData = e.clipboardData;
    if (!clipboardData || !clipboardData.items) return;

    const pastedFiles: File[] = [];

    for (let i = 0; i < clipboardData.items.length; i++) {
      const item = clipboardData.items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          // Generate nice filename for pasted screenshot if generic
          const fileName =
            file.name === 'image.png' || !file.name
              ? `screenshot-${new Date().toISOString().replace(/[:.]/g, '-')}.png`
              : file.name;
          const renamedFile = new File([file], fileName, { type: file.type });
          pastedFiles.push(renamedFile);
        }
      }
    }

    if (pastedFiles.length > 0) {
      addFiles(pastedFiles);
      toast.success(
        pastedFiles.length === 1
          ? 'Image attached from clipboard'
          : `${pastedFiles.length} images attached from clipboard`,
      );
    }
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingOver && !disabled && !isPending) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    if (disabled || isPending) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleSend = React.useCallback(() => {
    const trimmed = content.trim();
    if ((!trimmed && attachments.length === 0) || isPending || disabled) return;

    setIsPickerOpen(false);
    stopTyping();

    sendMessage(
      {
        content: trimmed || undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
        isPrivate: isNote,
      },
      {
        onSuccess: () => {
          setContent('');
          setAttachments([]);
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.focus();
          }
          onSent?.();
        },
      },
    );
  }, [content, attachments, isNote, isPending, disabled, stopTyping, sendMessage, onSent]);

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

    // Trigger typing indicator
    if (!isNote && newText.length > 0) {
      startTyping();
    } else if (newText.length === 0) {
      stopTyping();
    }

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
      ? t('conversations.composer.placeholderPrivateNote')
      : t('conversations.composer.placeholderReply'));

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'relative shrink-0 border-t border-border/80 p-3 bg-card/30 transition-colors',
        disabled && 'opacity-60 pointer-events-none',
        className,
      )}
    >
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        multiple
        className="hidden"
        aria-hidden="true"
      />

      {/* Drag & Drop Visual Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-40 flex items-center justify-center rounded-lg bg-primary/10 backdrop-blur-xs border-2 border-dashed border-primary transition-all animate-in fade-in-0">
          <div className="flex items-center gap-2 text-primary font-medium text-xs bg-background/90 px-3 py-1.5 rounded-md shadow-md">
            <UploadCloud className="size-4 animate-bounce" />
            <span>Drop files here to attach</span>
          </div>
        </div>
      )}

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
              <span>{t('conversations.composer.replyTab')}</span>
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
              <span>{t('conversations.composer.privateNoteTab')}</span>
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

        {/* Attachment Previews */}
        <AttachmentPreviewBar
          attachments={attachments}
          onRemove={handleRemoveAttachment}
          disabled={disabled || isPending}
        />

        {/* Text Input Area */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
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
            {/* Attachment File Trigger */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  disabled={disabled || isPending}
                  onClick={() => fileInputRef.current?.click()}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Attach file"
                >
                  <Paperclip className="size-3.5" data-icon="inline-start" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <span className="text-xs">Attach files (Images, PDFs, Docs up to 10MB)</span>
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
                      <span>{isNote ? t('common.saving') : t('conversations.composer.send')}</span>
                    </>
                  ) : isNote ? (
                    <>
                      <Lock className="size-3" data-icon="inline-start" />
                      <span>{t('conversations.composer.privateNoteTab')}</span>
                    </>
                  ) : (
                    <>
                      <span>{t('conversations.composer.send')}</span>
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
