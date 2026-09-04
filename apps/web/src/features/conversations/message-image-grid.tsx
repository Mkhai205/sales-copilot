'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { FileType, type AttachmentDto } from '@/lib/api/types';

interface MessageImageGridProps {
  attachments: AttachmentDto[];
  onImageClick: (index: number) => void;
  align?: 'start' | 'end';
}

export function isImageAttachment(att: AttachmentDto): boolean {
  if (att.fileType === FileType.IMAGE) return true;
  if (att.contentType?.startsWith('image/')) return true;
  if (/\.(jpg|jpeg|png|webp|gif|svg)$/i.test(att.fileName || '')) return true;
  return false;
}

export function isStickerAttachment(att: AttachmentDto): boolean {
  if (att.fileName?.toLowerCase().includes('sticker')) return true;
  if (
    att.fileSize !== undefined &&
    att.fileSize < 35000 &&
    (att.contentType?.startsWith('image/') || /\.(png|webp)$/i.test(att.fileName || ''))
  ) {
    return true;
  }
  return false;
}

export function MessageImageGrid({
  attachments,
  onImageClick,
  align = 'start',
}: MessageImageGridProps) {
  const images = React.useMemo(
    () => attachments.filter(att => isImageAttachment(att) && att.fileUrl),
    [attachments],
  );

  if (images.length === 0) return null;

  // Single sticker check
  if (images.length === 1 && isStickerAttachment(images[0])) {
    const sticker = images[0];
    return (
      <div
        className={cn(
          'relative inline-block my-1 max-w-[140px] select-none cursor-pointer transition-transform hover:scale-105 active:scale-95',
          align === 'end' ? 'ml-auto' : 'mr-auto',
        )}
        onClick={() => onImageClick(0)}
      >
        <img
          src={sticker.fileUrl}
          alt={sticker.fileName || 'Sticker'}
          className="w-auto h-auto max-h-[140px] max-w-full object-contain filter drop-shadow-xs"
          loading="lazy"
        />
      </div>
    );
  }

  // 1 Image
  if (images.length === 1) {
    const img = images[0];
    return (
      <div
        className={cn(
          'relative group overflow-hidden rounded-2xl border border-border/40 bg-muted/20 my-1 max-w-[340px] shadow-xs cursor-pointer',
          align === 'end' ? 'ml-auto' : 'mr-auto',
        )}
        onClick={() => onImageClick(0)}
      >
        <img
          src={img.fileUrl}
          alt={img.fileName || 'Image'}
          className="w-full max-h-[300px] object-cover rounded-2xl transition-transform duration-200 group-hover:scale-[1.01] group-hover:brightness-95"
          loading="lazy"
        />
      </div>
    );
  }

  // 2 Images: 2 columns
  if (images.length === 2) {
    return (
      <div
        className={cn(
          'grid grid-cols-2 gap-1.5 max-w-[360px] rounded-2xl overflow-hidden my-1',
          align === 'end' ? 'ml-auto' : 'mr-auto',
        )}
      >
        {images.map((img, idx) => (
          <div
            key={img.id || img.storagePath || idx}
            className="relative aspect-square overflow-hidden bg-muted/20 cursor-pointer group"
            onClick={() => onImageClick(idx)}
          >
            <img
              src={img.fileUrl}
              alt={img.fileName || `Image ${idx + 1}`}
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02] group-hover:brightness-95"
              loading="lazy"
            />
          </div>
        ))}
      </div>
    );
  }

  // 3 Images: 1 big on left, 2 stacked on right
  if (images.length === 3) {
    return (
      <div
        className={cn(
          'grid grid-cols-2 gap-1.5 max-w-[360px] rounded-2xl overflow-hidden my-1 h-[260px]',
          align === 'end' ? 'ml-auto' : 'mr-auto',
        )}
      >
        {/* Left tall image */}
        <div
          className="relative h-full overflow-hidden bg-muted/20 cursor-pointer group"
          onClick={() => onImageClick(0)}
        >
          <img
            src={images[0].fileUrl}
            alt={images[0].fileName || 'Image 1'}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02] group-hover:brightness-95"
            loading="lazy"
          />
        </div>

        {/* Right 2 stacked images */}
        <div className="flex flex-col gap-1.5 h-full">
          {images.slice(1, 3).map((img, idx) => (
            <div
              key={img.id || img.storagePath || idx}
              className="relative flex-1 overflow-hidden bg-muted/20 cursor-pointer group"
              onClick={() => onImageClick(idx + 1)}
            >
              <img
                src={img.fileUrl}
                alt={img.fileName || `Image ${idx + 2}`}
                className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02] group-hover:brightness-95"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 4 or more Images: 2x2 grid with +N badge on 4th image
  const displayImages = images.slice(0, 4);
  const remainingCount = images.length - 4;

  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-1.5 max-w-[360px] rounded-2xl overflow-hidden my-1',
        align === 'end' ? 'ml-auto' : 'mr-auto',
      )}
    >
      {displayImages.map((img, idx) => {
        const isLastAndHasMore = idx === 3 && remainingCount > 0;
        return (
          <div
            key={img.id || img.storagePath || idx}
            className="relative aspect-square overflow-hidden bg-muted/20 cursor-pointer group"
            onClick={() => onImageClick(idx)}
          >
            <img
              src={img.fileUrl}
              alt={img.fileName || `Image ${idx + 1}`}
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02] group-hover:brightness-95"
              loading="lazy"
            />
            {isLastAndHasMore && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[2px] transition-colors group-hover:bg-black/70 text-white font-bold text-xl tracking-wider">
                +{remainingCount}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
