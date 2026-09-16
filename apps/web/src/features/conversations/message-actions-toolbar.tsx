'use client';

import * as React from 'react';
import { Copy, Download, Maximize2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { MessageResponseDto } from '@sales-copilot/shared-contracts';
import { isImageAttachment } from './message-image-grid';
import { useI18n } from '@/lib/i18n';

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
  const { t } = useI18n();
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
        toast.success(t('conversations.toolbar.copyMessageSuccess'));
        return;
      } catch {
        toast.error(t('conversations.toolbar.copyMessageError'));
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
        toast.success(t('conversations.toolbar.copyImageSuccess'));
      } catch {
        try {
          await navigator.clipboard.writeText(images[0].fileUrl);
          toast.success(t('conversations.toolbar.copyLinkSuccess'));
        } catch {
          toast.error(t('conversations.toolbar.copyImageError'));
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
              title={t('conversations.toolbar.copy')}
            >
              <Copy className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[11px] py-1 px-2">
            {hasText ? t('conversations.toolbar.copyText') : t('conversations.toolbar.copyImage')}
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
              title={t('conversations.toolbar.download')}
            >
              <Download className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[11px] py-1 px-2">
            {hasImages
              ? t('conversations.toolbar.downloadImage')
              : t('conversations.toolbar.downloadFile')}
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
              title={t('conversations.toolbar.viewFullscreen')}
            >
              <Maximize2 className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[11px] py-1 px-2">
            {t('conversations.toolbar.viewFullscreen')}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
