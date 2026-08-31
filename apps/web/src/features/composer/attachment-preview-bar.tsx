'use client';

import * as React from 'react';
import { FileText, Image as ImageIcon, X } from 'lucide-react';
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from '@/components/ui/attachment';
import { cn } from '@/lib/utils';

export interface AttachmentPreviewBarProps {
  attachments: File[];
  onRemove: (index: number) => void;
  disabled?: boolean;
  className?: string;
}

function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface PreviewItem {
  file: File;
  objectUrl?: string;
  isImage: boolean;
}

export function AttachmentPreviewBar({
  attachments,
  onRemove,
  disabled = false,
  className,
}: AttachmentPreviewBarProps) {
  // Create and cache object URLs for image previews
  const previewItems: PreviewItem[] = React.useMemo(() => {
    return attachments.map(file => {
      const isImage = file.type.startsWith('image/');
      const objectUrl = isImage ? URL.createObjectURL(file) : undefined;
      return { file, objectUrl, isImage };
    });
  }, [attachments]);

  // Clean up object URLs on unmount or when items change
  React.useEffect(() => {
    return () => {
      previewItems.forEach(item => {
        if (item.objectUrl) {
          URL.revokeObjectURL(item.objectUrl);
        }
      });
    };
  }, [previewItems]);

  if (attachments.length === 0) return null;

  return (
    <div
      className={cn('border-b border-border/40 bg-muted/30 px-3 py-2 transition-all', className)}
    >
      <AttachmentGroup className="gap-2 overflow-x-auto scrollbar-none py-0.5">
        {previewItems.map((item, index) => (
          <Attachment
            key={`${item.file.name}-${item.file.size}-${index}`}
            size="sm"
            className="group relative max-w-[200px] shrink-0 border border-border/80 bg-background shadow-xs hover:border-border transition-all"
          >
            {item.isImage && item.objectUrl ? (
              <AttachmentMedia variant="image" className="size-9 rounded-md shrink-0">
                <img src={item.objectUrl} alt={item.file.name} className="size-full object-cover" />
              </AttachmentMedia>
            ) : (
              <AttachmentMedia
                variant="icon"
                className="size-9 rounded-md shrink-0 bg-muted text-muted-foreground"
              >
                {item.isImage ? <ImageIcon className="size-4" /> : <FileText className="size-4" />}
              </AttachmentMedia>
            )}

            <AttachmentContent className="min-w-0 pr-1">
              <AttachmentTitle className="text-xs font-medium truncate" title={item.file.name}>
                {item.file.name}
              </AttachmentTitle>
              <AttachmentDescription className="text-[10px] text-muted-foreground">
                {formatFileSize(item.file.size)}
              </AttachmentDescription>
            </AttachmentContent>

            <AttachmentActions className="ml-1">
              <AttachmentAction
                type="button"
                variant="ghost"
                size="icon-xs"
                disabled={disabled}
                onClick={() => onRemove(index)}
                className="size-5 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                aria-label={`Remove ${item.file.name}`}
              >
                <X className="size-3" />
                <span className="sr-only">Remove</span>
              </AttachmentAction>
            </AttachmentActions>
          </Attachment>
        ))}
      </AttachmentGroup>
    </div>
  );
}
