'use client';

import * as React from 'react';
import { Target, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CopilotSuggestionDto } from '@sales-copilot/shared-contracts';
import { useAcceptSuggestion, useDismissSuggestion } from '../hooks/use-copilot-suggestions';
import { ConvertOpportunityDialog } from './convert-opportunity-dialog';

export interface ActionCardProps {
  suggestion: CopilotSuggestionDto;
  workspaceId: string;
  conversationId: string;
  className?: string;
  onExecuted?: () => void;
}

export function ActionCard({
  suggestion,
  workspaceId,
  conversationId,
  className,
  onExecuted,
}: ActionCardProps) {
  const [isConvertDialogOpen, setIsConvertDialogOpen] = React.useState(false);

  const { mutate: acceptSuggestion, isPending: isAccepting } = useAcceptSuggestion(
    workspaceId,
    conversationId,
  );
  const { mutate: dismissSuggestion, isPending: isDismissing } = useDismissSuggestion(
    workspaceId,
    conversationId,
  );

  const confidencePercent = Math.round((suggestion.confidence ?? 0) * 100);
  const actionType = (suggestion.actionPayload as any)?.action || 'NEXT_ACTION';

  const handleExecute = () => {
    if (actionType === 'CONVERT_TO_OPPORTUNITY') {
      setIsConvertDialogOpen(true);
    } else {
      acceptSuggestion(suggestion.id, {
        onSuccess: () => {
          onExecuted?.();
        },
      });
    }
  };

  const handleConvertSuccess = () => {
    acceptSuggestion(suggestion.id, {
      onSuccess: () => {
        onExecuted?.();
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
    <>
      <div
        className={cn(
          'rounded-lg border border-border bg-card p-3.5 shadow-xs transition-colors hover:border-primary/30',
          className,
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Target className="size-3.5 text-blue-500" />
            <span>{suggestion.title || 'Hành động tiếp theo'}</span>
          </div>

          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 font-medium border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
          >
            {confidencePercent}% ưu tiên
          </Badge>
        </div>

        {/* Content */}
        <div className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed bg-muted/40 rounded-md p-2.5 border border-border/50 mb-3">
          {suggestion.content}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
          <Button
            variant="ghost"
            size="xs"
            onClick={handleDismiss}
            disabled={isDismissing || isAccepting}
            className="text-muted-foreground hover:text-destructive h-7 px-2 text-xs"
          >
            <X className="size-3.5 mr-1" />
            Bỏ qua
          </Button>

          <Button
            variant="default"
            size="xs"
            onClick={handleExecute}
            disabled={isAccepting || isDismissing}
            className="h-7 px-2.5 text-xs gap-1 font-medium bg-blue-600 hover:bg-blue-700 text-white"
          >
            <span>Thực thi</span>
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </div>

      <ConvertOpportunityDialog
        open={isConvertDialogOpen}
        onOpenChange={setIsConvertDialogOpen}
        workspaceId={workspaceId}
        leadId={suggestion.leadId}
        defaultTitle={suggestion.title}
        defaultAmount={(suggestion.actionPayload as any)?.defaultAmount}
        defaultStage={(suggestion.actionPayload as any)?.recommendedStage}
        onSuccess={handleConvertSuccess}
      />
    </>
  );
}
