'use client';

import * as React from 'react';
import { AlertTriangle, CheckCircle2, Clock, RotateCw } from 'lucide-react';
import type { KnowledgeArticleDto } from '@sales-copilot/shared-contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

interface KnowledgeStatusBadgeProps {
  status: KnowledgeArticleDto['embeddingStatus'];
  onReindex?: () => void;
  isReindexing?: boolean;
}

export function KnowledgeStatusBadge({
  status,
  onReindex,
  isReindexing,
}: KnowledgeStatusBadgeProps) {
  switch (status) {
    case 'READY':
      return (
        <Badge className="bg-success/15 text-success dark:text-success border-success/30 gap-1 font-normal text-xs">
          <CheckCircle2 className="h-3 w-3" />
          Sẵn sàng
        </Badge>
      );
    case 'PROCESSING':
      return (
        <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 gap-1 font-normal text-xs">
          <Spinner className="h-3 w-3" />
          Đang xử lý
        </Badge>
      );
    case 'PENDING':
      return (
        <Badge
          variant="outline"
          className="text-warning border-warning/50 gap-1 font-normal text-xs"
        >
          <Clock className="h-3 w-3" />
          Chờ vector
        </Badge>
      );
    case 'FAILED':
      return (
        <div className="flex items-center gap-1.5">
          <Badge className="bg-destructive/15 text-destructive border-destructive/30 gap-1 font-normal text-xs">
            <AlertTriangle className="h-3 w-3" />
            Lỗi vector
          </Badge>
          {onReindex && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              title="Thử lại re-index"
              onClick={onReindex}
              disabled={isReindexing}
            >
              <RotateCw className="h-3 w-3" />
            </Button>
          )}
        </div>
      );
    default:
      return null;
  }
}
