'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { fetchApi, workspaceHeaders } from '@/lib/api/client';
import type { LinkPreviewData } from '@sales-copilot/shared-contracts';
import { RichLinkCard } from './rich-link-card';

export function MessageLinkPreview({
  content,
  previewData,
  workspaceId,
  align = 'start',
}: {
  content?: string | null;
  previewData?: LinkPreviewData;
  workspaceId?: string;
  align?: 'start' | 'end';
}) {
  const [data, setData] = React.useState<LinkPreviewData | undefined>(previewData);

  React.useEffect(() => {
    if (previewData && (previewData.title || previewData.image || previewData.description)) {
      setData(previewData);
      return;
    }

    if (!content) return;
    const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/i;
    const match = content.match(urlRegex);
    if (!match || !match[0]) return;

    const url = match[0];
    let isCancelled = false;

    fetchApi<LinkPreviewData>(`/conversations/link-preview?url=${encodeURIComponent(url)}`, {
      headers: workspaceHeaders(workspaceId),
    })
      .then(res => {
        if (
          !isCancelled &&
          res.data &&
          (res.data.title || res.data.image || res.data.description)
        ) {
          setData(res.data);
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [content, previewData, workspaceId]);

  if (!data || (!data.title && !data.image && !data.description)) {
    return null;
  }

  return (
    <div className={cn('max-w-full', align === 'end' ? 'ml-auto' : 'mr-auto')}>
      <RichLinkCard preview={data} />
    </div>
  );
}
