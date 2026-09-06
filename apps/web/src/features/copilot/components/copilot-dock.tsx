'use client';

import * as React from 'react';
import { Sparkles, CornerDownLeft, ChevronRight, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CopilotSuggestionDto } from '@sales-copilot/shared-contracts';
import { insertIntoComposer } from '../../composer';
import { useApplySuggestion, useDismissSuggestion } from '../hooks/use-copilot-suggestions';

export interface CopilotDockProps {
  suggestions?: CopilotSuggestionDto[];
  workspaceId: string;
  conversationId: string;
  onOpenDrawer: () => void;
  className?: string;
}

export function CopilotDock({
  suggestions = [],
  workspaceId,
  conversationId,
  onOpenDrawer,
  className,
}: CopilotDockProps) {
  const { mutate: applySuggestion } = useApplySuggestion(workspaceId, conversationId);
  const { mutate: dismissSuggestion } = useDismissSuggestion(workspaceId, conversationId);

  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  const replySuggestion = suggestions.find(s => s.suggestionType === 'REPLY_DRAFT');
  const topSuggestion = suggestions[0];
  const isReply = Boolean(replySuggestion);

  const handleQuickInsert = (e: React.MouseEvent) => {
    e.stopPropagation();
    const target = replySuggestion || topSuggestion;
    insertIntoComposer({
      conversationId,
      text: target.content,
      mode: 'append',
    });

    applySuggestion(target.id, {
      onSuccess: () => {
        toast.success('Đã áp dụng gợi ý Copilot');
      },
    });
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    dismissSuggestion({
      suggestionId: topSuggestion.id,
      reason: 'NOT_RELEVANT',
    });
  };

  return (
    <div
      className={cn(
        'mx-4 mb-2 flex items-center justify-between gap-3 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-xs shadow-xs backdrop-blur-xs transition-all animate-in fade-in slide-in-from-bottom-2',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 cursor-pointer items-center gap-2" onClick={onOpenDrawer}>
        <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Sparkles className="size-3.5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-foreground truncate">
              {topSuggestion.title || 'Gợi ý phản hồi thông minh'}
            </span>
            <Badge variant="secondary" className="h-4 px-1 text-[9px] font-medium">
              {Math.round((topSuggestion.confidence ?? 0) * 100)}%
            </Badge>
          </div>
          <p className="line-clamp-1 text-[11px] text-muted-foreground">{topSuggestion.content}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {isReply && (
          <Button
            size="xs"
            variant="default"
            onClick={handleQuickInsert}
            className="h-6 gap-1 px-2 text-[11px] font-medium shadow-none"
          >
            <CornerDownLeft className="size-3" />
            <span>Chèn nhanh</span>
          </Button>
        )}

        <Button
          size="xs"
          variant="outline"
          onClick={onOpenDrawer}
          className="h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <span>Xem ({suggestions.length})</span>
          <ChevronRight className="size-3" />
        </Button>

        <Button
          size="icon-xs"
          variant="ghost"
          onClick={handleDismiss}
          className="size-6 text-muted-foreground hover:text-destructive"
        >
          <X className="size-3.5" />
          <span className="sr-only">Bỏ qua</span>
        </Button>
      </div>
    </div>
  );
}
