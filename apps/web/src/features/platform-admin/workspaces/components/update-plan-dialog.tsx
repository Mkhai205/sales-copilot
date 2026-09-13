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
import { useI18n } from '@/lib/i18n';

export interface UpdatePlanDialogProps {
  workspace: PlatformWorkspaceListItemDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpdatePlanDialog({ workspace, open, onOpenChange }: UpdatePlanDialogProps) {
  const { t } = useI18n();
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
            {t('admin.workspaces.changePlanQuotasTitle')}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {t('admin.workspaces.changePlanQuotasDesc', { name: workspace?.name || '' })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FieldGroup className="gap-3">
            {/* Gói cước */}
            <Field className="gap-1.5">
              <FieldLabel className="text-xs font-medium">
                {t('admin.workspaces.planServiceLabel')}
              </FieldLabel>
              <Select
                value={selectedPlan}
                onValueChange={val => setSelectedPlan(val as BillingPlanType)}
              >
                <SelectTrigger className="h-8 text-xs w-full">
                  <SelectValue placeholder={t('admin.workspaces.planServiceSelect')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={BillingPlanType.FREE}>
                    {t('admin.workspaces.planFreeDetail')}
                  </SelectItem>
                  <SelectItem value={BillingPlanType.STANDARD}>
                    {t('admin.workspaces.planStandardDetail')}
                  </SelectItem>
                  <SelectItem value={BillingPlanType.ENTERPRISE}>
                    {t('admin.workspaces.planEnterpriseDetail')}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription className="text-[11px]">
                {t('admin.workspaces.planChangeHelp')}
              </FieldDescription>
            </Field>

            <div className="border-t border-border/50 pt-2 flex flex-col gap-2.5">
              <span className="text-xs font-medium text-foreground">
                {t('admin.workspaces.quotaOverridesTitle')}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {t('admin.workspaces.quotaOverridesHelp')}
              </span>

              <div className="grid grid-cols-2 gap-3">
                {/* Max Agents */}
                <Field className="gap-1">
                  <FieldLabel className="text-[11px] font-normal text-muted-foreground">
                    {t('admin.workspaces.maxAgents')}
                  </FieldLabel>
                  <Input
                    type="number"
                    min="1"
                    placeholder={t('admin.workspaces.defaultQuotaPlaceholder')}
                    value={maxAgents}
                    onChange={e => setMaxAgents(e.target.value)}
                    className="h-8 text-xs"
                  />
                </Field>

                {/* Max Channels */}
                <Field className="gap-1">
                  <FieldLabel className="text-[11px] font-normal text-muted-foreground">
                    {t('admin.workspaces.maxChannels')}
                  </FieldLabel>
                  <Input
                    type="number"
                    min="1"
                    placeholder={t('admin.workspaces.defaultQuotaPlaceholder')}
                    value={maxChannels}
                    onChange={e => setMaxChannels(e.target.value)}
                    className="h-8 text-xs"
                  />
                </Field>

                {/* Storage MB */}
                <Field className="gap-1">
                  <FieldLabel className="text-[11px] font-normal text-muted-foreground">
                    {t('admin.workspaces.storageMb')}
                  </FieldLabel>
                  <Input
                    type="number"
                    min="100"
                    placeholder={t('admin.workspaces.defaultQuotaPlaceholder')}
                    value={storageMb}
                    onChange={e => setStorageMb(e.target.value)}
                    className="h-8 text-xs"
                  />
                </Field>

                {/* AI Tokens */}
                <Field className="gap-1">
                  <FieldLabel className="text-[11px] font-normal text-muted-foreground">
                    {t('admin.workspaces.aiTokens')}
                  </FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    placeholder={t('admin.workspaces.defaultQuotaPlaceholder')}
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
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={updatePlanMutation.isPending || isLoadingDetail}
              className="text-xs gap-1.5"
            >
              {updatePlanMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
              <span>{t('admin.workspaces.saveChanges')}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
