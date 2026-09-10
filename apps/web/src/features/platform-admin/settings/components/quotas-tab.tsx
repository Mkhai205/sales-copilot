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

export function QuotasTab() {
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
        toast.error('Số nhân viên tối đa phải là số nguyên lớn hơn 0');
        setIsSaving(false);
        return;
      }
      if (Number.isNaN(channels) || channels < 1) {
        toast.error('Số kênh kết nối tối đa phải là số nguyên lớn hơn 0');
        setIsSaving(false);
        return;
      }
      if (Number.isNaN(storage) || storage < 50) {
        toast.error('Dung lượng lưu trữ tối thiểu là 50 MB');
        setIsSaving(false);
        return;
      }
      if (Number.isNaN(tokens) || tokens < 0) {
        toast.error('Hạn mức AI tokens không được âm');
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
      toast.success('Cập nhật hạn mức Quota thành công');
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
              Hạn mức Mặc định Gói Khởi đầu (FREE Tier Quotas)
            </CardTitle>
            <CardDescription className="text-xs">
              Quy định tài nguyên tối đa được cấp phát tự động cho một Workspace mới đăng ký gói
              miễn phí.
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
                <FieldLabel htmlFor="quota-agents">Số lượng Nhân viên Bán hàng tối đa</FieldLabel>
              </div>
              <Input
                id="quota-agents"
                type="number"
                min="1"
                max="100"
                value={maxAgents}
                onChange={e => setMaxAgents(e.target.value)}
              />
              <FieldDescription>
                Tổng số tài khoản thành viên (Owner, Admin, Agent) được phép mời vào workspace.
              </FieldDescription>
            </Field>

            {/* Max Channels */}
            <Field>
              <div className="flex items-center gap-2">
                <Radio className="size-3.5 text-muted-foreground" />
                <FieldLabel htmlFor="quota-channels">Số lượng Kênh Liên lạc Tích hợp</FieldLabel>
              </div>
              <Input
                id="quota-channels"
                type="number"
                min="1"
                max="50"
                value={maxChannels}
                onChange={e => setMaxChannels(e.target.value)}
              />
              <FieldDescription>
                Số lượng kênh Fanpage, Zalo OA hoặc Livechat widget được kết nối đồng thời.
              </FieldDescription>
            </Field>

            {/* Storage MB */}
            <Field>
              <div className="flex items-center gap-2">
                <HardDrive className="size-3.5 text-muted-foreground" />
                <FieldLabel htmlFor="quota-storage">Dung lượng Tệp Đính kèm (MB)</FieldLabel>
              </div>
              <Input
                id="quota-storage"
                type="number"
                min="50"
                step="50"
                value={storageMb}
                onChange={e => setStorageMb(e.target.value)}
              />
              <FieldDescription>
                Tổng dung lượng lưu trữ hình ảnh sản phẩm, ảnh chat và tệp tài liệu trên MinIO S3.
              </FieldDescription>
            </Field>

            {/* AI Tokens */}
            <Field>
              <div className="flex items-center gap-2">
                <Cpu className="size-3.5 text-muted-foreground" />
                <FieldLabel htmlFor="quota-tokens">Hạn mức AI Tokens hàng tháng</FieldLabel>
              </div>
              <Input
                id="quota-tokens"
                type="number"
                min="0"
                step="10000"
                value={aiTokens}
                onChange={e => setAiTokens(e.target.value)}
              />
              <FieldDescription>
                Số lượng token AI tối đa được cấp để trợ lý chốt đơn và trích xuất địa chỉ NER mỗi
                tháng.
              </FieldDescription>
            </Field>
          </FieldGroup>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isSaving || updateMutation.isPending} className="gap-2">
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              <span>Lưu Hạn mức Quota</span>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
