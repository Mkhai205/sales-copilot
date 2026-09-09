'use client';

import * as React from 'react';
import { Quote, AlertTriangle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { BuyingSignalType, type SalesEvidenceResponseDto } from '@sales-copilot/shared-contracts';
import { useInvalidateEvidence } from '../hooks/use-sales-intelligence';

interface EvidenceItemCardProps {
  evidence: SalesEvidenceResponseDto;
  workspaceId: string;
  conversationId?: string;
  leadId?: string | null;
}

const SIGNAL_CONFIG: Record<
  BuyingSignalType,
  {
    label: string;
    variant: 'default' | 'secondary' | 'outline' | 'destructive';
    colorClass: string;
  }
> = {
  [BuyingSignalType.BUDGET_CONFIRMED]: {
    label: 'Ngân sách',
    variant: 'default',
    colorClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  },
  [BuyingSignalType.AUTHORITY_IDENTIFIED]: {
    label: 'Thẩm quyền',
    variant: 'secondary',
    colorClass: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
  },
  [BuyingSignalType.NEED_EXPRESSED]: {
    label: 'Nhu cầu',
    variant: 'default',
    colorClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
  },
  [BuyingSignalType.TIMELINE_DEFINED]: {
    label: 'Thời hạn',
    variant: 'secondary',
    colorClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  },
  [BuyingSignalType.PURCHASE_INTENT]: {
    label: 'Ý định mua',
    variant: 'default',
    colorClass: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
  },
  [BuyingSignalType.COMPETITOR_MENTION]: {
    label: 'Đối thủ',
    variant: 'outline',
    colorClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
  },
  [BuyingSignalType.OBJECTION_RAISED]: {
    label: 'Phản đối',
    variant: 'outline',
    colorClass: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
  },
  [BuyingSignalType.CHURN_RISK]: {
    label: 'Nguy cơ rời bỏ',
    variant: 'destructive',
    colorClass: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
  },
  [BuyingSignalType.PAIN_POINT]: {
    label: 'Điểm đau',
    variant: 'secondary',
    colorClass: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
  },
  [BuyingSignalType.POSITIVE_SENTIMENT]: {
    label: 'Tích cực',
    variant: 'default',
    colorClass: 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30',
  },
  [BuyingSignalType.ENGAGEMENT_SPIKE]: {
    label: 'Tương tác cao',
    variant: 'secondary',
    colorClass: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
  },
};

export function EvidenceItemCard({
  evidence,
  workspaceId,
  conversationId,
  leadId,
}: EvidenceItemCardProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [invalidationReason, setInvalidationReason] = React.useState('');

  const { mutate: invalidate, isPending } = useInvalidateEvidence(
    workspaceId,
    conversationId,
    leadId,
  );

  const config = SIGNAL_CONFIG[evidence.signalType] || {
    label: evidence.signalType,
    variant: 'secondary' as const,
    colorClass: 'bg-muted text-muted-foreground border-border',
  };

  const confidencePct = Math.round((evidence.confidence || 0) * 100);

  const handleConfirmInvalidate = () => {
    if (!invalidationReason.trim()) return;
    invalidate(
      {
        evidenceId: evidence.id,
        dto: { invalidationReason: invalidationReason.trim() },
      },
      {
        onSuccess: () => {
          setDialogOpen(false);
          setInvalidationReason('');
        },
      },
    );
  };

  return (
    <>
      <div
        className={`flex flex-col gap-1.5 p-2.5 rounded-lg border transition-all ${
          evidence.isInvalidated
            ? 'border-border/40 bg-muted/20 opacity-60'
            : 'border-border/70 bg-card hover:border-border'
        }`}
      >
        {/* Header: Signal badge + Confidence + Invalidate Action */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${config.colorClass}`}
            >
              {config.label}
            </span>
            <span className="text-[10px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
              {confidencePct}% độ tin cậy
            </span>
          </div>

          {!evidence.isInvalidated ? (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setDialogOpen(true)}
              className="text-muted-foreground hover:text-destructive size-5"
              title="Vô hiệu hóa (False positive)"
            >
              <Trash2 className="size-3" />
            </Button>
          ) : (
            <span className="text-[10px] text-destructive font-medium italic">Đã vô hiệu hóa</span>
          )}
        </div>

        {/* Verbatim snippet */}
        <div className="flex items-start gap-1.5 bg-muted/40 p-2 rounded text-xs">
          <Quote className="size-3 text-muted-foreground shrink-0 mt-0.5" />
          <p
            className={`text-foreground/90 italic font-mono text-[11px] leading-relaxed ${
              evidence.isInvalidated ? 'line-through' : ''
            }`}
          >
            "{evidence.snippet}"
          </p>
        </div>

        {/* AI Reasoning */}
        {evidence.reason && (
          <p className="text-[11px] text-muted-foreground leading-snug">{evidence.reason}</p>
        )}

        {/* Invalidation note if applicable */}
        {evidence.isInvalidated && evidence.invalidationReason && (
          <div className="flex items-center gap-1 text-[10px] text-destructive/80 bg-destructive/5 p-1 rounded">
            <AlertTriangle className="size-2.5 shrink-0" />
            <span>Lý do hủy: {evidence.invalidationReason}</span>
          </div>
        )}
      </div>

      {/* Invalidate Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Vô hiệu hóa bằng chứng bán hàng</DialogTitle>
            <DialogDescription>
              Đánh dấu bằng chứng này là nhận diện sai (false-positive). Thao tác này sẽ tự động cập
              nhật và điều chỉnh lại điểm Lead liên quan.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-2">
            <Field>
              <FieldLabel htmlFor="reason">Lý do vô hiệu hóa</FieldLabel>
              <Input
                id="reason"
                placeholder="VD: Khách hàng chỉ hỏi đùa, ngữ cảnh mang tính phủ định..."
                value={invalidationReason}
                onChange={e => setInvalidationReason(e.target.value)}
              />
            </Field>
          </FieldGroup>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
              Hủy
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmInvalidate}
              disabled={!invalidationReason.trim() || isPending}
            >
              {isPending ? 'Đang xử lý...' : 'Xác nhận vô hiệu hóa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
