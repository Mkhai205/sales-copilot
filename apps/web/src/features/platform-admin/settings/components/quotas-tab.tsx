'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { useSystemSettings, useUpdateSystemSetting } from '../hooks/use-system-settings';
import { getSettingValue, parseSettingNumber } from '../utils/settings-helpers';
import { Scale, Save, Loader2, Users, Radio, HardDrive, Cpu } from 'lucide-react';
import { SystemSettingCategory } from '@sales-copilot/shared-contracts';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';

export function QuotasTab() {
  const { t } = useI18n();
  const { data: settings, isLoading } = useSystemSettings(SystemSettingCategory.BILLING);
  const updateMutation = useUpdateSystemSetting();

  const [maxAgents, setMaxAgents] = React.useState('2');
  const [maxChannels, setMaxChannels] = React.useState('2');
  const [storageMb, setStorageMb] = React.useState('500');
  const [aiTokens, setAiTokens] = React.useState('50000');
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (settings) {
      setMaxAgents(
        String(parseSettingNumber(getSettingValue(settings, 'quotas.free.max_agents', 2), 2)),
      );
      setMaxChannels(
        String(parseSettingNumber(getSettingValue(settings, 'quotas.free.max_channels', 2), 2)),
      );
      setStorageMb(
        String(parseSettingNumber(getSettingValue(settings, 'quotas.free.storage_mb', 500), 500)),
      );
      setAiTokens(
        String(
          parseSettingNumber(
            getSettingValue(settings, 'quotas.free.ai_monthly_tokens', 50000),
            50000,
          ),
        ),
      );
    }
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const agents = Number(maxAgents);
      const channels = Number(maxChannels);
      const storage = Number(storageMb);
      const tokens = Number(aiTokens);

      if (Number.isNaN(agents) || agents < 1) {
        toast.error(t('admin.systemSettings.quotasErrAgents'));
        setIsSaving(false);
        return;
      }
      if (Number.isNaN(channels) || channels < 1) {
        toast.error(t('admin.systemSettings.quotasErrChannels'));
        setIsSaving(false);
        return;
      }
      if (Number.isNaN(storage) || storage < 50) {
        toast.error(t('admin.systemSettings.quotasErrStorage'));
        setIsSaving(false);
        return;
      }
      if (Number.isNaN(tokens) || tokens < 0) {
        toast.error(t('admin.systemSettings.quotasErrTokens'));
        setIsSaving(false);
        return;
      }

      await Promise.all([
        updateMutation.mutateAsync({
          key: 'quotas.free.max_agents',
          payload: { value: agents },
          silent: true,
        }),
        updateMutation.mutateAsync({
          key: 'quotas.free.max_channels',
          payload: { value: channels },
          silent: true,
        }),
        updateMutation.mutateAsync({
          key: 'quotas.free.storage_mb',
          payload: { value: storage },
          silent: true,
        }),
        updateMutation.mutateAsync({
          key: 'quotas.free.ai_monthly_tokens',
          payload: { value: tokens },
          silent: true,
        }),
      ]);
      toast.success(t('admin.systemSettings.saveQuotasSuccess'));
    } catch {
      // Handled by mutation hook toast
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="flex flex-col gap-6 p-6">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="gap-1 pb-4">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
            <Scale className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">
              {t('admin.systemSettings.quotasTitle')}
            </CardTitle>
            <CardDescription className="text-xs">
              {t('admin.systemSettings.quotasDesc')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="flex flex-col gap-6">
          <FieldGroup>
            {/* Max Agents */}
            <Field>
              <div className="flex items-center gap-2">
                <Users className="size-3.5 text-muted-foreground" />
                <FieldLabel htmlFor="quota-agents">
                  {t('admin.systemSettings.quotasAgentsLabel')}
                </FieldLabel>
              </div>
              <Input
                id="quota-agents"
                type="number"
                min="1"
                max="100"
                value={maxAgents}
                onChange={e => setMaxAgents(e.target.value)}
              />
              <FieldDescription>{t('admin.systemSettings.quotasAgentsHelp')}</FieldDescription>
            </Field>

            {/* Max Channels */}
            <Field>
              <div className="flex items-center gap-2">
                <Radio className="size-3.5 text-muted-foreground" />
                <FieldLabel htmlFor="quota-channels">
                  {t('admin.systemSettings.quotasChannelsLabel')}
                </FieldLabel>
              </div>
              <Input
                id="quota-channels"
                type="number"
                min="1"
                max="50"
                value={maxChannels}
                onChange={e => setMaxChannels(e.target.value)}
              />
              <FieldDescription>{t('admin.systemSettings.quotasChannelsHelp')}</FieldDescription>
            </Field>

            {/* Storage MB */}
            <Field>
              <div className="flex items-center gap-2">
                <HardDrive className="size-3.5 text-muted-foreground" />
                <FieldLabel htmlFor="quota-storage">
                  {t('admin.systemSettings.quotasStorageLabel')}
                </FieldLabel>
              </div>
              <Input
                id="quota-storage"
                type="number"
                min="50"
                step="50"
                value={storageMb}
                onChange={e => setStorageMb(e.target.value)}
              />
              <FieldDescription>{t('admin.systemSettings.quotasStorageHelp')}</FieldDescription>
            </Field>

            {/* AI Tokens */}
            <Field>
              <div className="flex items-center gap-2">
                <Cpu className="size-3.5 text-muted-foreground" />
                <FieldLabel htmlFor="quota-tokens">
                  {t('admin.systemSettings.quotasTokensLabel')}
                </FieldLabel>
              </div>
              <Input
                id="quota-tokens"
                type="number"
                min="0"
                step="10000"
                value={aiTokens}
                onChange={e => setAiTokens(e.target.value)}
              />
              <FieldDescription>{t('admin.systemSettings.quotasTokensHelp')}</FieldDescription>
            </Field>
          </FieldGroup>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isSaving || updateMutation.isPending} className="gap-2">
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              <span>{t('admin.systemSettings.quotasSaveButton')}</span>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
