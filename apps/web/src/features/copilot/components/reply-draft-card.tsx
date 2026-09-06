'use client';

import * as React from 'react';
import { Sparkles, CornerDownLeft, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CopilotSuggestionDto } from '@sales-copilot/shared-contracts';
import { insertIntoComposer } from '../../composer';
import { useApplySuggestion, useDismissSuggestion } from '../hooks/use-copilot-suggestions';

export interface ReplyDraftCardProps {
  suggestion: CopilotSuggestionDto;
  workspaceId: string;
  conversationId: string;
  className?: string;
  onApplied?: () => void;
}

export function ReplyDraftCard({
  suggestion,
  workspaceId,
  conversationId,
  className,
  onApplied,
}: ReplyDraftCardProps) {
  const { mutate: applySuggestion, isPending: isApplying } = useApplySuggestion(
    workspaceId,
    conversationId,
  );
  const { mutate: dismissSuggestion, isPending: isDismissing } = useDismissSuggestion(
    workspaceId,
    conversationId,
  );

  const confidencePercent = Math.round((suggestion.confidence ?? 0) * 100);

  const handleUseDraft = () => {
    insertIntoComposer({
      conversationId,
      text: suggestion.content,
      mode: 'append',
    });

    applySuggestion(suggestion.id, {
      onSuccess: () => {
        toast.success('Đã chèn câu trả lời vào khung soạn thảo');
        onApplied?.();
      },
    });
  };

  const handleDismiss = () => {
    dismissSuggestion({
      suggestionId: suggestion.id,
      reason: 'NOT_RELEVANT',
    });
  };

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-3.5 shadow-xs transition-colors hover:border-primary/30',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Sparkles className="size-3.5 text-primary" />
          <span>{suggestion.title || 'Bản thảo câu trả lời'}</span>
        </div>

        <Badge
          variant="outline"
          className={cn(
            'text-[10px] px-1.5 py-0 font-medium',
            confidencePercent >= 90
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
          )}
        >
          {confidencePercent}% phù hợp
        </Badge>
      </div>

      {/* Content */}
      <div className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed bg-muted/40 rounded-md p-2.5 border border-border/50 mb-3 select-text">
        {suggestion.content}
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
        <Button
          variant="ghost"
          size="xs"
          onClick={handleDismiss}
          disabled={isDismissing || isApplying}
          className="text-muted-foreground hover:text-destructive h-7 px-2 text-xs"
        >
          <X className="size-3.5 mr-1" />
          Bỏ qua
        </Button>

        <Button
          variant="default"
          size="xs"
          onClick={handleUseDraft}
          disabled={isApplying || isDismissing}
          className="h-7 px-2.5 text-xs gap-1 font-medium bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <CornerDownLeft className="size-3.5" />
          Dùng câu trả lời
        </Button>
      </div>
    </div>
  );
}
