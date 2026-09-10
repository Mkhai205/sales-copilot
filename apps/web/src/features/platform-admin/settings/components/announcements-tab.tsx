'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { useSystemSettings, useUpdateSystemSetting } from '../hooks/use-system-settings';
import {
  getSettingValue,
  parseSettingBoolean,
  parseSettingString,
} from '../utils/settings-helpers';
import { Megaphone, AlertTriangle, Info, Flame, Wrench, Save, Loader2, Eye } from 'lucide-react';
import { SystemSettingCategory } from '@sales-copilot/shared-contracts';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function AnnouncementsTab() {
  const { data: settings, isLoading } = useSystemSettings(SystemSettingCategory.SYSTEM);
  const updateMutation = useUpdateSystemSetting();

  const [maintenanceMode, setMaintenanceMode] = React.useState(false);
  const [bannerMessage, setBannerMessage] = React.useState('');
  const [bannerLevel, setBannerLevel] = React.useState('INFO');
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (settings) {
      setMaintenanceMode(
        parseSettingBoolean(getSettingValue(settings, 'system.maintenance_mode', false), false),
      );
      setBannerMessage(
        parseSettingString(getSettingValue(settings, 'system.banner_message', ''), ''),
      );
      setBannerLevel(
        parseSettingString(getSettingValue(settings, 'system.banner_level', 'INFO'), 'INFO'),
      );
    }
  }, [settings]);

  const handleMaintenanceToggle = (nextVal: boolean) => {
    setMaintenanceMode(nextVal);
    updateMutation.mutate({
      key: 'system.maintenance_mode',
      payload: { value: nextVal },
    });
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await Promise.all([
        updateMutation.mutateAsync({
          key: 'system.banner_message',
          payload: { value: bannerMessage.trim() },
          silent: true,
        }),
        updateMutation.mutateAsync({
          key: 'system.banner_level',
          payload: { value: bannerLevel },
          silent: true,
        }),
      ]);
      toast.success('Cập nhật thông báo hệ thống thành công');
    } catch {
      // Handled by mutation hook
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
        </CardContent>
      </Card>
    );
  }

  const getBannerStyles = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return 'bg-destructive/15 text-destructive border-destructive/30';
      case 'WARNING':
        return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'INFO':
      default:
        return 'bg-primary/10 text-primary border-primary/20';
    }
  };

  const getBannerIcon = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return <Flame className="size-4 shrink-0" />;
      case 'WARNING':
        return <AlertTriangle className="size-4 shrink-0" />;
      case 'INFO':
      default:
        return <Info className="size-4 shrink-0" />;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Maintenance Mode Card */}
      <Card className="border-border bg-card">
        <CardHeader className="gap-1 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500">
                <Wrench className="size-4" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  Chế độ Bảo trì Hệ thống (Maintenance Mode)
                </CardTitle>
                <CardDescription className="text-xs">
                  Khóa tạm thời các tác vụ ghi và thông báo cho người dùng hệ thống đang bảo trì.
                </CardDescription>
              </div>
            </div>
            <Switch
              checked={maintenanceMode}
              disabled={updateMutation.isPending}
              onCheckedChange={handleMaintenanceToggle}
            />
          </div>
        </CardHeader>
      </Card>

      {/* System Announcement Banner Card */}
      <Card className="border-border bg-card">
        <CardHeader className="gap-1 pb-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Megaphone className="size-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                Thông báo Toàn Hệ thống (System Banner)
              </CardTitle>
              <CardDescription className="text-xs">
                Nội dung thông báo nổi ghim trên đầu màn hình làm việc của toàn bộ người dùng và
                nhân viên.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {/* Live Preview Box */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Eye className="size-3.5" />
              <span>Xem trước trực tiếp (Live Preview)</span>
            </div>
            {bannerMessage.trim() ? (
              <div
                className={cn(
                  'flex items-center gap-3 rounded-lg border px-4 py-3 text-xs font-medium transition-colors',
                  getBannerStyles(bannerLevel),
                )}
              >
                {getBannerIcon(bannerLevel)}
                <span className="flex-1 leading-normal">{bannerMessage}</span>
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-4 text-xs text-muted-foreground">
                Chưa có thông báo nào được đặt (Thanh thông báo đang ẩn)
              </div>
            )}
          </div>

          <form onSubmit={handleSaveBanner} className="flex flex-col gap-6">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="banner-text">Nội dung Thông điệp</FieldLabel>
                <Input
                  id="banner-text"
                  value={bannerMessage}
                  onChange={e => setBannerMessage(e.target.value)}
                  placeholder="VD: Hệ thống sẽ bảo trì nâng cấp từ 01:00 đến 03:00 ngày 15/09..."
                />
                <FieldDescription>
                  Để trống nếu bạn muốn tắt hoàn toàn thanh thông báo nổi trên hệ thống.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="banner-level">Mức độ Cảnh báo (Alert Level)</FieldLabel>
                <Select value={bannerLevel} onValueChange={setBannerLevel}>
                  <SelectTrigger id="banner-level" className="w-full">
                    <SelectValue placeholder="Chọn mức độ cảnh báo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INFO">
                      <div className="flex items-center gap-2">
                        <Info className="size-3.5 text-blue-500" />
                        <span>Thông tin (INFO - Xanh lam)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="WARNING">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="size-3.5 text-amber-500" />
                        <span>Cảnh báo (WARNING - Vàng cam)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="CRITICAL">
                      <div className="flex items-center gap-2">
                        <Flame className="size-3.5 text-rose-500" />
                        <span>Nghiêm trọng (CRITICAL - Đỏ)</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Màu sắc và mức độ ưu tiên biểu thị cho người dùng khi xem thông báo.
                </FieldDescription>
              </Field>
            </FieldGroup>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={isSaving || updateMutation.isPending}
                className="gap-2"
              >
                {isSaving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                <span>Lưu Thông báo Hệ thống</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
