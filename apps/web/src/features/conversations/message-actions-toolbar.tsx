'use client';

import * as React from 'react';
import { Copy, Download, Maximize2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { MessageResponseDto } from '@/lib/api/types';
import { isImageAttachment } from './message-image-grid';

interface MessageActionsToolbarProps {
  message: MessageResponseDto;
  align?: 'start' | 'end';
  onOpenLightbox?: (index?: number) => void;
  className?: string;
}

export function MessageActionsToolbar({
  message,
  align: _align,
  onOpenLightbox,
  className,
}: MessageActionsToolbarProps) {
  const images = (message.attachments || []).filter(att => isImageAttachment(att) && att.fileUrl);
  const files = message.attachments || [];
  const hasText = Boolean(message.content && message.content.trim().length > 0);
  const hasImages = images.length > 0;
  const hasFiles = files.length > 0;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (hasText && message.content) {
      try {
        await navigator.clipboard.writeText(message.content);
        toast.success('Đã sao chép tin nhắn');
        return;
      } catch {
        toast.error('Không thể sao chép tin nhắn');
        return;
      }
    }

    if (hasImages && images[0]?.fileUrl) {
      try {
        const response = await fetch(images[0].fileUrl);
        const blob = await response.blob();
        const pngBlob = blob.type === 'image/png' ? blob : new Blob([blob], { type: 'image/png' });

        await navigator.clipboard.write([
          new ClipboardItem({
            [pngBlob.type]: pngBlob,
          }),
        ]);
        toast.success('Đã sao chép ảnh vào bộ nhớ tạm');
      } catch {
        try {
          await navigator.clipboard.writeText(images[0].fileUrl);
          toast.success('Đã sao chép liên kết ảnh');
        } catch {
          toast.error('Không thể sao chép ảnh');
        }
      }
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const targetAtt = hasImages ? images[0] : files[0];
    if (!targetAtt?.fileUrl) return;

    const link = document.createElement('a');
    link.href = targetAtt.fileUrl;
    link.download = targetAtt.fileName || 'download';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenLightbox = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenLightbox) {
      onOpenLightbox(0);
    }
  };

  return (
    <div
      className={cn(
        'flex items-center gap-0.5 rounded-lg border border-border/60 bg-background/95 px-1 py-0.5 shadow-xs backdrop-blur-xs transition-opacity duration-150',
        'opacity-0 group-hover/msg:opacity-100 focus-within:opacity-100',
        className,
      )}
    >
      {/* Copy Button */}
      {(hasText || hasImages) && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleCopy}
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Sao chép"
            >
              <Copy className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[11px] py-1 px-2">
            {hasText ? 'Sao chép văn bản' : 'Sao chép ảnh'}
          </TooltipContent>
        </Tooltip>
      )}

      {/* Download Button */}
      {hasFiles && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleDownload}
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Tải xuống"
            >
              <Download className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[11px] py-1 px-2">
            Tải xuống {hasImages ? 'ảnh' : 'tệp'}
          </TooltipContent>
        </Tooltip>
      )}

      {/* Fullscreen View Button */}
      {hasImages && onOpenLightbox && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleOpenLightbox}
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Xem to"
            >
              <Maximize2 className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[11px] py-1 px-2">
            Xem toàn màn hình
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
