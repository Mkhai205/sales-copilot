'use client';

import * as React from 'react';
import { UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSendMessage } from './hooks/use-send-message';
import { useTypingIndicator } from './hooks/use-typing-indicator';
import { useComposerAttachments } from './hooks/use-composer-attachments';
import { useComposerContent, type ComposerMode } from './hooks/use-composer-content';
import { CannedResponsePicker } from './canned-response-picker';
import { AttachmentPreviewBar } from './attachment-preview-bar';
import { ComposerModeHeader } from './composer-mode-header';
import { ComposerActionToolbar } from './composer-action-toolbar';

export type { ComposerMode } from './hooks/use-composer-content';

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
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const { mutate: sendMessage, isPending } = useSendMessage({
    conversationId,
    workspaceId,
  });

  const { startTyping, stopTyping } = useTypingIndicator({
    conversationId,
    disabled: disabled || isPending,
  });

  const composerAttachments = useComposerAttachments({ disabled, isPending });

  const {
    content,
    textareaRef,
    pickerRef,
    setMode,
    isNote,
    isPickerOpen,
    setIsPickerOpen,
    pickerSearch,
    setPickerSearch,
    canSend,
    handleContentChange,
    handleKeyDown,
    handleSelectCannedResponse,
    handleInsertEmoji,
    handleSend,
  } = useComposerContent({
    defaultMode,
    disabled,
    isPending,
    startTyping,
    stopTyping,
    sendMessage,
    attachments: composerAttachments.attachments,
    setAttachments: composerAttachments.setAttachments,
    onSent,
  });

  const dynamicPlaceholder =
    placeholder ||
    (isNote
      ? 'Nhập ghi chú nội bộ (chỉ thành viên trong nhóm mới thấy)...'
      : 'Nhập tin nhắn trả lời... (Shift + Enter để xuống dòng)');

  return (
    <div
      onDragOver={composerAttachments.handleDragOver}
      onDragLeave={composerAttachments.handleDragLeave}
      onDrop={composerAttachments.handleDrop}
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
        onChange={composerAttachments.handleFileInputChange}
        multiple
        className="hidden"
        aria-hidden="true"
      />

      {/* Drag & Drop Visual Overlay */}
      {composerAttachments.isDraggingOver && (
        <div className="absolute inset-0 z-40 flex items-center justify-center rounded-lg bg-primary/10 backdrop-blur-xs border-2 border-dashed border-primary transition-all animate-in fade-in-0">
          <div className="flex items-center gap-2 text-primary font-medium text-xs bg-background/90 px-3 py-1.5 rounded-md shadow-md">
            <UploadCloud className="size-4 animate-bounce" />
            <span>{'Thả tệp vào đây để đính kèm'}</span>
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
            ? 'border-warning/50 bg-warning/[0.04] dark:bg-warning/[0.08] focus-within:border-warning focus-within:ring-1 focus-within:ring-warning/30'
            : 'border-border bg-background focus-within:border-ring focus-within:ring-1 focus-within:ring-ring',
        )}
      >
        {/* Mode Switcher Header */}
        <ComposerModeHeader
          isNote={isNote}
          disabled={disabled}
          isPending={isPending}
          setMode={setMode}
        />

        {/* Attachment Previews */}
        <AttachmentPreviewBar
          attachments={composerAttachments.attachments}
          onRemove={composerAttachments.handleRemoveAttachment}
          disabled={disabled || isPending}
        />

        {/* Text Input Area */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          onPaste={composerAttachments.handlePaste}
          placeholder={dynamicPlaceholder}
          disabled={disabled || isPending}
          rows={1}
          className={cn(
            'w-full resize-none bg-transparent p-3 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none max-h-40 overflow-y-auto leading-relaxed',
            isNote && 'placeholder:text-warning/60 dark:placeholder:text-warning/50',
          )}
          aria-label={isNote ? 'Ghi chú nội bộ' : 'Soạn tin nhắn'}
        />

        {/* Composer Action Toolbar */}
        <ComposerActionToolbar
          isNote={isNote}
          disabled={disabled}
          isPending={isPending}
          canSend={canSend}
          isPickerOpen={isPickerOpen}
          onAttachClick={() => fileInputRef.current?.click()}
          onTogglePicker={() => {
            setIsPickerOpen(prev => !prev);
            setPickerSearch('');
            textareaRef.current?.focus();
          }}
          onEmojiSelect={handleInsertEmoji}
          onSend={handleSend}
        />
      </div>
    </div>
  );
}
