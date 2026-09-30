'use client';

import * as React from 'react';
import type { CannedResponseDto } from '@sales-copilot/shared-contracts';
import type { useSendMessage } from './use-send-message';
import type { CannedResponsePickerHandle } from '../canned-response-picker';
import { findSlashCommand } from '../slash-command';

export type ComposerMode = 'reply' | 'note';

type SendMessageFn = ReturnType<typeof useSendMessage>['mutate'];

interface UseComposerContentOptions {
  defaultMode: ComposerMode;
  disabled: boolean;
  isPending: boolean;
  startTyping: () => void;
  stopTyping: () => void;
  sendMessage: SendMessageFn;
  attachments: File[];
  setAttachments: React.Dispatch<React.SetStateAction<File[]>>;
  onSent?: () => void;
}

/**
 * Core composer input state: message content, reply/note mode and the canned
 * response picker state, plus every interaction that mutates them (typing,
 * keydown, canned response insertion, emoji insertion, send).
 */
export function useComposerContent({
  defaultMode,
  disabled,
  isPending,
  startTyping,
  stopTyping,
  sendMessage,
  attachments,
  setAttachments,
  onSent,
}: UseComposerContentOptions) {
  const [content, setContent] = React.useState('');
  const [mode, setMode] = React.useState<ComposerMode>(defaultMode);
  const [isPickerOpen, setIsPickerOpen] = React.useState(false);
  const [pickerSearch, setPickerSearch] = React.useState('');

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const pickerRef = React.useRef<CannedResponsePickerHandle>(null);

  const isNote = mode === 'note';

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
  }, [
    content,
    attachments,
    isNote,
    isPending,
    disabled,
    stopTyping,
    sendMessage,
    onSent,
    setAttachments,
  ]);

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

  const handleInsertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    const currentContent = content;
    const cursorPos = textarea?.selectionStart ?? currentContent.length;
    const prefix = currentContent.slice(0, cursorPos);
    const suffix = currentContent.slice(cursorPos);
    const newContent = `${prefix}${emoji}${suffix}`;
    const newCursorPos = cursorPos + emoji.length;

    setContent(newContent);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
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

  return {
    content,
    textareaRef,
    pickerRef,
    mode,
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
  };
}
