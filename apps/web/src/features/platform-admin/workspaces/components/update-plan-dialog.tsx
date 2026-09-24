'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
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
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldError } from '@/components/ui/field';
import {
  BillingPlanType,
  type PlatformWorkspaceListItemDto,
  type UpdateWorkspacePlanDto,
} from '@sales-copilot/shared-contracts';
import {
  usePlatformWorkspaceDetail,
  useUpdateWorkspacePlan,
} from '../hooks/use-platform-workspaces';

export interface UpdatePlanDialogProps {
  workspace: PlatformWorkspaceListItemDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const updatePlanFormSchema = z.object({
  billingPlan: z.nativeEnum(BillingPlanType),
  maxAgents: z
    .string()
    .refine(
      val =>
        !val.trim() || (!isNaN(Number(val)) && Number.isInteger(Number(val)) && Number(val) >= 1),
      'Số nhân sự tối thiểu là 1',
    ),
  maxChannels: z
    .string()
    .refine(
      val =>
        !val.trim() || (!isNaN(Number(val)) && Number.isInteger(Number(val)) && Number(val) >= 1),
      'Số kênh kết nối tối thiểu là 1',
    ),
  storageMb: z
    .string()
    .refine(
      val =>
        !val.trim() || (!isNaN(Number(val)) && Number.isInteger(Number(val)) && Number(val) >= 100),
      'Dung lượng tối thiểu là 100 MB',
    ),
  aiTokens: z
    .string()
    .refine(
      val =>
        !val.trim() || (!isNaN(Number(val)) && Number.isInteger(Number(val)) && Number(val) >= 0),
      'Hạn mức tokens AI tối thiểu là 0',
    ),
});

type UpdatePlanFormValues = z.infer<typeof updatePlanFormSchema>;

export function UpdatePlanDialog({ workspace, open, onOpenChange }: UpdatePlanDialogProps) {
  const { data: detail, isLoading: isLoadingDetail } = usePlatformWorkspaceDetail(
    open ? workspace?.id : undefined,
  );
  const updatePlanMutation = useUpdateWorkspacePlan();

  const defaultValues: UpdatePlanFormValues = React.useMemo(() => {
    const custom = (detail?.settings?.quotas as Record<string, any>) || {};
    return {
      billingPlan: (detail?.billingPlan ||
        workspace?.billingPlan ||
        BillingPlanType.FREE) as BillingPlanType,
      maxAgents:
        custom.maxAgents !== undefined && custom.maxAgents !== null ? String(custom.maxAgents) : '',
      maxChannels:
        custom.maxChannels !== undefined && custom.maxChannels !== null
          ? String(custom.maxChannels)
          : '',
      storageMb:
        custom.storageLimitMb !== undefined && custom.storageLimitMb !== null
          ? String(custom.storageLimitMb)
          : '',
      aiTokens:
        custom.aiMonthlyTokens !== undefined && custom.aiMonthlyTokens !== null
          ? String(custom.aiMonthlyTokens)
          : '',
    };
  }, [detail, workspace]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<UpdatePlanFormValues>({
    resolver: zodResolver(updatePlanFormSchema),
    defaultValues,
  });

  React.useEffect(() => {
    if (open) {
      reset(defaultValues);
    }
  }, [open, defaultValues, reset]);

  const selectedPlan = watch('billingPlan');

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      reset(defaultValues);
    }
    onOpenChange(newOpen);
  };

  const onSubmit = async (data: UpdatePlanFormValues) => {
    if (!workspace) return;

    const quotas: Record<string, number | null> = {
      maxAgents: data.maxAgents.trim() ? parseInt(data.maxAgents.trim(), 10) : null,
      maxChannels: data.maxChannels.trim() ? parseInt(data.maxChannels.trim(), 10) : null,
      storageLimitMb: data.storageMb.trim() ? parseInt(data.storageMb.trim(), 10) : null,
      aiMonthlyTokens: data.aiTokens.trim() ? parseInt(data.aiTokens.trim(), 10) : null,
    };

    const payload: UpdateWorkspacePlanDto = {
      billingPlan: data.billingPlan,
      quotas,
    };

    try {
      await updatePlanMutation.mutateAsync({
        id: workspace.id,
        payload,
      });
      handleOpenChange(false);
    } catch {
      // Error handled by mutation toast
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md sm:max-w-md p-6">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base font-semibold">
            {'Đổi gói & Thiết lập Quotas tùy biến'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {`Cập nhật gói cước và tùy chỉnh hạn mức tài nguyên cho tenant ${workspace?.name || ''}.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <FieldGroup className="gap-3">
            {/* Gói cước */}
            <Field className="gap-1.5">
              <FieldLabel className="text-xs font-medium">{'Gói cước dịch vụ'}</FieldLabel>
              <Select
                value={selectedPlan}
                onValueChange={val => setValue('billingPlan', val as BillingPlanType)}
              >
                <SelectTrigger className="h-8 text-xs w-full">
                  <SelectValue placeholder={'Chọn gói cước'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={BillingPlanType.FREE}>{'Gói FREE (Miễn phí)'}</SelectItem>
                  <SelectItem value={BillingPlanType.STANDARD}>
                    {'Gói STANDARD (Tiêu chuẩn)'}
                  </SelectItem>
                  <SelectItem value={BillingPlanType.ENTERPRISE}>
                    {'Gói ENTERPRISE (Doanh nghiệp)'}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription className="text-[11px]">
                {'Thay đổi gói sẽ tự động cập nhật hạn mức mặc định tương ứng.'}
              </FieldDescription>
            </Field>

            <div className="border-t border-border/50 pt-2 flex flex-col gap-2.5">
              <span className="text-xs font-medium text-foreground">
                {'Ghi đè hạn mức tùy biến (Quota Overrides)'}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {'Để trống ô nếu muốn áp dụng hạn mức mặc định của gói cước.'}
              </span>

              <div className="grid grid-cols-2 gap-3">
                {/* Max Agents */}
                <Field data-invalid={!!errors.maxAgents} className="gap-1">
                  <FieldLabel className="text-[11px] font-normal text-muted-foreground">
                    {'Số nhân sự tối đa (maxAgents)'}
                  </FieldLabel>
                  <Input
                    type="number"
                    min="1"
                    placeholder={'Mặc định'}
                    className="h-8 text-xs"
                    {...register('maxAgents')}
                  />
                  {errors.maxAgents?.message && <FieldError>{errors.maxAgents.message}</FieldError>}
                </Field>

                {/* Max Channels */}
                <Field data-invalid={!!errors.maxChannels} className="gap-1">
                  <FieldLabel className="text-[11px] font-normal text-muted-foreground">
                    {'Số kênh kết nối tối đa (maxChannels)'}
                  </FieldLabel>
                  <Input
                    type="number"
                    min="1"
                    placeholder={'Mặc định'}
                    className="h-8 text-xs"
                    {...register('maxChannels')}
                  />
                  {errors.maxChannels?.message && (
                    <FieldError>{errors.maxChannels.message}</FieldError>
                  )}
                </Field>

                {/* Storage MB */}
                <Field data-invalid={!!errors.storageMb} className="gap-1">
                  <FieldLabel className="text-[11px] font-normal text-muted-foreground">
                    {'Dung lượng lưu trữ media MB (storageQuotaMb)'}
                  </FieldLabel>
                  <Input
                    type="number"
                    min="100"
                    placeholder={'Mặc định'}
                    className="h-8 text-xs"
                    {...register('storageMb')}
                  />
                  {errors.storageMb?.message && <FieldError>{errors.storageMb.message}</FieldError>}
                </Field>

                {/* AI Tokens */}
                <Field data-invalid={!!errors.aiTokens} className="gap-1">
                  <FieldLabel className="text-[11px] font-normal text-muted-foreground">
                    {'Hạn mức tokens AI hàng tháng (aiTokensQuotaMonthly)'}
                  </FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    placeholder={'Mặc định'}
                    className="h-8 text-xs"
                    {...register('aiTokens')}
                  />
                  {errors.aiTokens?.message && <FieldError>{errors.aiTokens.message}</FieldError>}
                </Field>
              </div>
            </div>
          </FieldGroup>

          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleOpenChange(false)}
              disabled={updatePlanMutation.isPending}
              className="text-xs"
            >
              {'Hủy'}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={updatePlanMutation.isPending || isLoadingDetail}
              className="text-xs gap-1.5"
            >
              {updatePlanMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
              <span>{'Lưu thay đổi'}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
