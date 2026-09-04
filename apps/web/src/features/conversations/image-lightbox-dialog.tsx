'use client';

import * as React from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { X, ChevronLeft, ChevronRight, Download, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { AttachmentDto } from '@/lib/api/types';

interface ImageLightboxDialogProps {
  images: AttachmentDto[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
}

export function ImageLightboxDialog({
  images,
  initialIndex = 0,
  isOpen,
  onClose,
}: ImageLightboxDialogProps) {
  const [currentIndex, setCurrentIndex] = React.useState(initialIndex);

  // Sync currentIndex with initialIndex when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.min(Math.max(0, initialIndex), Math.max(0, images.length - 1)));
    }
  }, [isOpen, initialIndex, images.length]);

  const currentImage = images[currentIndex];

  const handlePrev = React.useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
    },
    [images.length],
  );

  const handleNext = React.useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
    },
    [images.length],
  );

  // Keyboard navigation
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handlePrev, handleNext]);

  const handleCopyImage = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentImage?.fileUrl) return;

    try {
      const response = await fetch(currentImage.fileUrl);
      const blob = await response.blob();
      const pngBlob = blob.type === 'image/png' ? blob : new Blob([blob], { type: 'image/png' });

      await navigator.clipboard.write([
        new ClipboardItem({
          [pngBlob.type]: pngBlob,
        }),
      ]);
      toast.success('Đã sao chép ảnh vào bộ nhớ tạm');
    } catch {
      // Fallback: Copy URL if clipboard image write fails
      try {
        await navigator.clipboard.writeText(currentImage.fileUrl);
        toast.success('Đã sao chép liên kết ảnh');
      } catch {
        toast.error('Không thể sao chép ảnh');
      }
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentImage?.fileUrl) return;

    const link = document.createElement('a');
    link.href = currentImage.fileUrl;
    link.download = currentImage.fileName || 'image.png';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen || images.length === 0 || !currentImage) {
    return null;
  }

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xs duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex flex-col justify-between select-none outline-none"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">
            Xem ảnh {currentImage.fileName || ''}
          </DialogPrimitive.Title>

          {/* Top Bar */}
          <div className="relative z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
            {/* Left: Close & Counter */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white/90 hover:bg-white/20 hover:text-white transition-colors cursor-pointer"
                title="Đóng (Esc)"
              >
                <X className="size-5" />
              </button>
              {images.length > 1 && (
                <span className="text-xs font-medium text-white/80 tracking-wider">
                  {currentIndex + 1} / {images.length}
                </span>
              )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopyImage}
                className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white/90 hover:bg-white/20 hover:text-white transition-colors cursor-pointer"
                title="Sao chép ảnh"
              >
                <Copy className="size-4" />
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white/90 hover:bg-white/20 hover:text-white transition-colors cursor-pointer"
                title="Tải xuống ảnh"
              >
                <Download className="size-4" />
              </button>

              <a
                href={currentImage.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white/90 hover:bg-white/20 hover:text-white transition-colors cursor-pointer"
                title="Mở trong tab mới"
                onClick={e => e.stopPropagation()}
              >
                <ExternalLink className="size-4" />
              </a>
            </div>
          </div>

          {/* Center Main Stage */}
          <div
            className="relative flex-1 flex items-center justify-center px-4 py-2 overflow-hidden cursor-default"
            onClick={onClose}
          >
            {/* Prev Button */}
            {images.length > 1 && (
              <button
                type="button"
                onClick={handlePrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex size-11 items-center justify-center rounded-full bg-black/60 text-white/90 hover:bg-white/20 hover:text-white transition-all cursor-pointer border border-white/10 shadow-lg"
                title="Ảnh trước (Mũi tên trái)"
              >
                <ChevronLeft className="size-6" />
              </button>
            )}

            {/* Active Image */}
            <div
              className="relative max-h-[78vh] max-w-[88vw] flex items-center justify-center"
              onClick={e => e.stopPropagation()}
            >
              <img
                src={currentImage.fileUrl}
                alt={currentImage.fileName || 'Preview'}
                className="max-h-[78vh] max-w-[88vw] object-contain rounded-md shadow-2xl transition-transform duration-200"
              />
            </div>

            {/* Next Button */}
            {images.length > 1 && (
              <button
                type="button"
                onClick={handleNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex size-11 items-center justify-center rounded-full bg-black/60 text-white/90 hover:bg-white/20 hover:text-white transition-all cursor-pointer border border-white/10 shadow-lg"
                title="Ảnh tiếp theo (Mũi tên phải)"
              >
                <ChevronRight className="size-6" />
              </button>
            )}
          </div>

          {/* Bottom Thumbnail Strip */}
          {images.length > 1 && (
            <div
              className="relative z-10 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent overflow-x-auto"
              onClick={e => e.stopPropagation()}
            >
              {images.map((img, idx) => {
                const isActive = idx === currentIndex;
                return (
                  <button
                    key={img.id || img.storagePath || idx}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    className={cn(
                      'relative size-12 rounded-md overflow-hidden shrink-0 transition-all cursor-pointer',
                      isActive
                        ? 'ring-2 ring-white scale-105 opacity-100 shadow-md'
                        : 'opacity-40 hover:opacity-80 ring-1 ring-white/20',
                    )}
                  >
                    <img
                      src={img.fileUrl}
                      alt={img.fileName || `Thumb ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
