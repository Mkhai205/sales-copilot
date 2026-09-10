'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Field, FieldGroup, FieldLabel, FieldDescription } from '@/components/ui/field';
import {
  BillingPlanType,
  type PlatformWorkspaceListItemDto,
} from '@sales-copilot/shared-contracts';
import {
  usePlatformWorkspaceDetail,
  useUpdateWorkspacePlan,
} from '../hooks/use-platform-workspaces';
import { Loader2 } from 'lucide-react';

export interface UpdatePlanDialogProps {
  workspace: PlatformWorkspaceListItemDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpdatePlanDialog({ workspace, open, onOpenChange }: UpdatePlanDialogProps) {
  const { data: detail, isLoading: isLoadingDetail } = usePlatformWorkspaceDetail(
    open ? workspace?.id : undefined,
  );
  const updatePlanMutation = useUpdateWorkspacePlan();

  const [selectedPlan, setSelectedPlan] = React.useState<BillingPlanType>(BillingPlanType.FREE);
  const [maxAgents, setMaxAgents] = React.useState<string>('');
  const [maxChannels, setMaxChannels] = React.useState<string>('');
  const [storageMb, setStorageMb] = React.useState<string>('');
  const [aiTokens, setAiTokens] = React.useState<string>('');

  React.useEffect(() => {
    if (workspace && open) {
      setSelectedPlan((workspace.billingPlan as BillingPlanType) || BillingPlanType.FREE);
      setMaxAgents('');
      setMaxChannels('');
      setStorageMb('');
      setAiTokens('');
    }
  }, [workspace, open]);

  React.useEffect(() => {
    if (detail && open) {
      setSelectedPlan((detail.billingPlan as BillingPlanType) || BillingPlanType.FREE);
      const custom = (detail.settings?.quotas as Record<string, any>) || {};
      setMaxAgents(
        custom.maxAgents !== undefined && custom.maxAgents !== null ? String(custom.maxAgents) : '',
      );
      setMaxChannels(
        custom.maxChannels !== undefined && custom.maxChannels !== null
          ? String(custom.maxChannels)
          : '',
      );
      setStorageMb(
        custom.storageLimitMb !== undefined && custom.storageLimitMb !== null
          ? String(custom.storageLimitMb)
          : '',
      );
      setAiTokens(
        custom.aiMonthlyTokens !== undefined && custom.aiMonthlyTokens !== null
          ? String(custom.aiMonthlyTokens)
          : '',
      );
    }
  }, [detail, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace) return;

    const quotas: Record<string, number | null> = {
      maxAgents: maxAgents.trim() ? parseInt(maxAgents.trim(), 10) : null,
      maxChannels: maxChannels.trim() ? parseInt(maxChannels.trim(), 10) : null,
      storageLimitMb: storageMb.trim() ? parseInt(storageMb.trim(), 10) : null,
      aiMonthlyTokens: aiTokens.trim() ? parseInt(aiTokens.trim(), 10) : null,
    };

    try {
      await updatePlanMutation.mutateAsync({
        id: workspace.id,
        payload: {
          billingPlan: selectedPlan,
          quotas,
        },
      });
      onOpenChange(false);
    } catch {
      // Error handled by mutation toast
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-md p-6">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base font-semibold">
            Đổi gói & Thiết lập Quotas tùy biến
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Cập nhật gói cước và tùy chỉnh hạn mức tài nguyên cho tenant{' '}
            <strong className="text-foreground">{workspace?.name}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FieldGroup className="gap-3">
            {/* Gói cước */}
            <Field className="gap-1.5">
              <FieldLabel className="text-xs font-medium">Gói cước dịch vụ</FieldLabel>
              <Select
                value={selectedPlan}
                onValueChange={val => setSelectedPlan(val as BillingPlanType)}
              >
                <SelectTrigger className="h-8 text-xs w-full">
                  <SelectValue placeholder="Chọn gói cước" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={BillingPlanType.FREE}>Gói FREE (Miễn phí)</SelectItem>
                  <SelectItem value={BillingPlanType.STANDARD}>
                    Gói STANDARD (Tiêu chuẩn)
                  </SelectItem>
                  <SelectItem value={BillingPlanType.ENTERPRISE}>
                    Gói ENTERPRISE (Doanh nghiệp)
                  </SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription className="text-[11px]">
                Thay đổi gói sẽ tự động cập nhật hạn mức mặc định tương ứng.
              </FieldDescription>
            </Field>

            <div className="border-t border-border/50 pt-2 flex flex-col gap-2.5">
              <span className="text-xs font-medium text-foreground">
                Ghi đè hạn mức tùy biến (Quota Overrides)
              </span>
              <span className="text-[11px] text-muted-foreground">
                Để trống ô nếu muốn áp dụng hạn mức mặc định của gói cước.
              </span>

              <div className="grid grid-cols-2 gap-3">
                {/* Max Agents */}
                <Field className="gap-1">
                  <FieldLabel className="text-[11px] font-normal text-muted-foreground">
                    Nhân sự tối đa
                  </FieldLabel>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Mặc định"
                    value={maxAgents}
                    onChange={e => setMaxAgents(e.target.value)}
                    className="h-8 text-xs"
                  />
                </Field>

                {/* Max Channels */}
                <Field className="gap-1">
                  <FieldLabel className="text-[11px] font-normal text-muted-foreground">
                    Kênh tối đa
                  </FieldLabel>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Mặc định"
                    value={maxChannels}
                    onChange={e => setMaxChannels(e.target.value)}
                    className="h-8 text-xs"
                  />
                </Field>

                {/* Storage MB */}
                <Field className="gap-1">
                  <FieldLabel className="text-[11px] font-normal text-muted-foreground">
                    Lưu trữ (MB)
                  </FieldLabel>
                  <Input
                    type="number"
                    min="100"
                    placeholder="Mặc định"
                    value={storageMb}
                    onChange={e => setStorageMb(e.target.value)}
                    className="h-8 text-xs"
                  />
                </Field>

                {/* AI Tokens */}
                <Field className="gap-1">
                  <FieldLabel className="text-[11px] font-normal text-muted-foreground">
                    Token AI / Tháng
                  </FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    placeholder="Mặc định"
                    value={aiTokens}
                    onChange={e => setAiTokens(e.target.value)}
                    className="h-8 text-xs"
                  />
                </Field>
              </div>
            </div>
          </FieldGroup>

          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={updatePlanMutation.isPending}
              className="text-xs"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={updatePlanMutation.isPending || isLoadingDetail}
              className="text-xs gap-1.5"
            >
              {updatePlanMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
              <span>Lưu thay đổi</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
