'use client';

import * as React from 'react';
import { toast } from 'sonner';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

interface UseComposerAttachmentsOptions {
  disabled: boolean;
  isPending: boolean;
}

/**
 * Attachment pipeline for the chat composer: file selection, clipboard paste,
 * drag & drop, size validation and removal.
 */
export function useComposerAttachments({ disabled, isPending }: UseComposerAttachmentsOptions) {
  const [attachments, setAttachments] = React.useState<File[]>([]);
  const [isDraggingOver, setIsDraggingOver] = React.useState(false);

  const addFiles = React.useCallback((newFiles: FileList | File[]) => {
    const validFiles: File[] = [];

    Array.from(newFiles).forEach(file => {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast.error(`Tệp "${file.name}" vượt quá giới hạn 10MB`, {
          description: 'Vui lòng chọn tệp nhỏ hơn 10MB.',
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
          ? 'Đã đính kèm ảnh từ bộ nhớ tạm'
          : `Đã đính kèm ${pastedFiles.length} ảnh từ bộ nhớ tạm`,
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

  return {
    attachments,
    setAttachments,
    handleFileInputChange,
    handleRemoveAttachment,
    handlePaste,
    isDraggingOver,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
