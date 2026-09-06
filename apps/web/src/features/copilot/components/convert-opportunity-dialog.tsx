'use client';

import * as React from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { fetchApi, workspaceHeaders } from '@/lib/api/client';

export interface ConvertOpportunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  leadId?: string | null;
  defaultTitle?: string;
  defaultAmount?: number;
  defaultStage?: string;
  onSuccess?: () => void;
}

const VALID_OPPORTUNITY_STAGES = [
  'PROSPECTING',
  'QUALIFICATION',
  'PROPOSAL',
  'NEGOTIATION',
  'CLOSED_WON',
  'CLOSED_LOST',
];

export function ConvertOpportunityDialog({
  open,
  onOpenChange,
  workspaceId,
  leadId,
  defaultTitle = 'Cơ hội kinh doanh mới',
  defaultAmount = 100000000,
  defaultStage = 'QUALIFICATION',
  onSuccess,
}: ConvertOpportunityDialogProps) {
  const sanitizeStage = React.useCallback(
    (s?: string) => (s && VALID_OPPORTUNITY_STAGES.includes(s) ? s : 'QUALIFICATION'),
    [],
  );

  const [title, setTitle] = React.useState(defaultTitle);
  const [amount, setAmount] = React.useState(defaultAmount);
  const [stage, setStage] = React.useState(sanitizeStage(defaultStage));
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setTitle(defaultTitle);
      setAmount(defaultAmount);
      setStage(sanitizeStage(defaultStage));
    }
  }, [open, defaultTitle, defaultAmount, defaultStage, sanitizeStage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadId) {
      toast.error('Không tìm thấy Lead để chuyển đổi');
      return;
    }

    setIsSubmitting(true);
    try {
      await fetchApi(`/workspaces/${workspaceId}/leads/${leadId}/convert`, {
        method: 'POST',
        headers: workspaceHeaders(workspaceId),
        body: JSON.stringify({
          title: title.trim(),
          amount: Number(amount),
          currency: 'VND',
          stage: stage || 'QUALIFICATION',
        }),
      });

      toast.success('Chuyển đổi Opportunity thành công!');
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error('Không thể chuyển đổi Lead', {
        description: err?.message || 'Vui lòng kiểm tra lại thông tin',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Chuyển đổi thành Opportunity</DialogTitle>
            <DialogDescription>
              Tạo cơ hội kinh doanh mới cho khách hàng tiềm năng này với các thông số đề xuất từ
              Copilot.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-4 gap-3">
            <Field>
              <FieldLabel htmlFor="opp-title">Tên Opportunity</FieldLabel>
              <Input
                id="opp-title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Ví dụ: Gói giải pháp chuyển đổi số"
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="opp-amount">Giá trị dự kiến (VND)</FieldLabel>
              <Input
                id="opp-amount"
                type="number"
                value={amount}
                onChange={e => setAmount(Number(e.target.value))}
                placeholder="100,000,000"
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="opp-stage">Giai đoạn thương vụ</FieldLabel>
              <Input
                id="opp-stage"
                value={stage}
                onChange={e => setStage(e.target.value)}
                placeholder="QUALIFICATION"
              />
            </Field>
          </FieldGroup>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Spinner className="size-4 mr-1.5" />}
              Xác nhận chuyển đổi
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
