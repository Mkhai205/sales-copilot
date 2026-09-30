'use client';

import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FeatureFlagsTab } from '@/features/platform-admin/settings/components/feature-flags-tab';
import { QuotasTab } from '@/features/platform-admin/settings/components/quotas-tab';
import { Flag, Scale, RefreshCw, Zap } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { platformAdminKeys } from '@/lib/query-keys';

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefreshCache = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({
      queryKey: platformAdminKeys.settings.all,
    });
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success('Đã đồng bộ lại dữ liệu cấu hình từ hệ thống');
    }, 400);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {'Cấu hình Hệ thống Động'}
            </h1>
            <Badge
              variant="outline"
              className="gap-1 border-success/30 bg-success/10 text-success dark:text-success text-xs"
            >
              <Zap className="size-3" />
              <span>{'2-Tier Active'}</span>
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {
              'Hot-reloading tham số vận hành, Feature Flags, LLM Gateway và hạn mức Quotas mà không cần khởi động lại dịch vụ.'
            }
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshCache}
            disabled={isRefreshing}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`size-3.5 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
            <span>{'Làm mới Cache'}</span>
          </Button>
        </div>
      </div>

      {/* Main Settings Tabs */}
      <Tabs defaultValue="feature-flags" className="flex flex-col gap-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-flex">
          <TabsTrigger value="feature-flags" className="gap-2">
            <Flag className="size-3.5" />
            <span>{'Feature Flags'}</span>
          </TabsTrigger>
          <TabsTrigger value="quotas" className="gap-2">
            <Scale className="size-3.5" />
            <span>{'Hạn mức & Quotas'}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="feature-flags" className="outline-none">
          <FeatureFlagsTab />
        </TabsContent>

        <TabsContent value="quotas" className="outline-none">
          <QuotasTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
