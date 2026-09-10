'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useSystemSettings, useUpdateSystemSetting } from '../hooks/use-system-settings';
import { getSettingValue, parseSettingBoolean } from '../utils/settings-helpers';
import { QrCode, Bot, ShieldBan, Printer } from 'lucide-react';
import { SystemSettingCategory } from '@sales-copilot/shared-contracts';

interface FlagConfig {
  key: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultVal: boolean;
}

const FLAGS: FlagConfig[] = [
  {
    key: 'feature.pos_vietqr_enabled',
    title: 'Thanh toán VietQR & Webhook tự động',
    description:
      'Tự động tạo mã thanh toán VietQR động (NAPAS 247) và đối soát giao dịch ngân hàng thời gian thực qua Webhook < 1s.',
    icon: QrCode,
    defaultVal: true,
  },
  {
    key: 'feature.ai_autopilot_enabled',
    title: 'AI Auto-pilot Chốt đơn 24/7',
    description:
      'Cho phép Copilot tự động tư vấn sản phẩm, gợi ý voucher và hoàn tất đơn hàng bán lẻ tự động ngoài giờ làm việc.',
    icon: Bot,
    defaultVal: true,
  },
  {
    key: 'feature.comment_masking_enabled',
    title: 'Tự động Ẩn Bình luận chứa SĐT',
    description:
      'Quét nội dung bình luận Facebook/Zalo theo thời gian thực và ẩn ngay lập tức các bình luận chứa số điện thoại chống cướp khách.',
    icon: ShieldBan,
    defaultVal: true,
  },
  {
    key: 'feature.thermal_print_enabled',
    title: 'In Phiếu gửi Nhiệt K80/K58',
    description:
      'Kích hoạt nút in nhanh mẫu phiếu đóng gói và tem giao nhận tương thích máy in nhiệt cầm tay và POS cố định.',
    icon: Printer,
    defaultVal: true,
  },
];

export function FeatureFlagsTab() {
  const { data: settings, isLoading } = useSystemSettings(SystemSettingCategory.FEATURE_FLAGS);
  const updateMutation = useUpdateSystemSetting();

  const handleToggle = (key: string, currentValue: boolean) => {
    updateMutation.mutate({
      key,
      payload: { value: !currentValue },
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="border-border bg-card">
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex items-center gap-4">
                <Skeleton className="size-10 rounded-lg" />
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-80" />
                </div>
              </div>
              <Skeleton className="h-6 w-11 rounded-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-border bg-card">
        <CardHeader className="gap-1 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">
              Cờ Tính năng Toàn Hệ thống (Feature Flags)
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              4 Cờ Khả dụng
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Bật hoặc tắt các module cốt lõi trong thời gian thực. Các thay đổi được đồng bộ qua
            Redis cache 2 tầng và có hiệu lực ngay lập tức.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col divide-y divide-border pt-0">
          {FLAGS.map(flag => {
            const Icon = flag.icon;
            const rawVal = getSettingValue(settings, flag.key, flag.defaultVal);
            const isChecked = parseSettingBoolean(rawVal, flag.defaultVal);
            const isPending =
              updateMutation.isPending && updateMutation.variables?.key === flag.key;

            return (
              <div
                key={flag.key}
                className="flex items-start justify-between gap-4 py-4 first:pt-2 last:pb-0"
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{flag.title}</span>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground">
                        {flag.key}
                      </code>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {flag.description}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center pt-1">
                  <Switch
                    checked={isChecked}
                    disabled={isPending}
                    onCheckedChange={() => handleToggle(flag.key, isChecked)}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
