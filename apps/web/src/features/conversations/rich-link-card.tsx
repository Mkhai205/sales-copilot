'use client';

import * as React from 'react';
import { ExternalLink, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LinkPreviewData } from '@/lib/api/types';

interface RichLinkCardProps {
  preview: LinkPreviewData;
  className?: string;
}

export function RichLinkCard({ preview, className }: RichLinkCardProps) {
  const [imageError, setImageError] = React.useState(false);

  if (!preview || !preview.url) {
    return null;
  }

  let domain = preview.siteName;
  if (!domain) {
    try {
      domain = new URL(preview.url).hostname.replace(/^www\./, '');
    } catch {
      domain = preview.url;
    }
  }

  const hasImage = Boolean(preview.image && !imageError);

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group block my-1.5 max-w-[340px] overflow-hidden rounded-xl border border-border/70 bg-card/90 shadow-xs transition-all hover:bg-muted/40 hover:border-primary/40 hover:shadow-sm text-left',
        className,
      )}
      title={preview.title || preview.url}
    >
      {hasImage && (
        <div className="relative aspect-[1.91/1] w-full overflow-hidden bg-muted/30 border-b border-border/40">
          <img
            src={preview.image}
            alt={preview.title || domain || 'Preview image'}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
            onError={() => setImageError(true)}
            loading="lazy"
          />
        </div>
      )}

      <div className="flex flex-col gap-1 p-2.5">
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">
          <Globe className="size-3 shrink-0 text-muted-foreground/70" />
          <span className="truncate">{domain}</span>
          <ExternalLink className="size-2.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ml-auto text-primary" />
        </div>

        {preview.title && (
          <div className="text-xs font-semibold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
            {preview.title}
          </div>
        )}

        {preview.description && (
          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
            {preview.description}
          </p>
        )}
      </div>
    </a>
  );
}
