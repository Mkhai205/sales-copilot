'use client';

import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FeatureFlagsTab,
  AiDefaultsTab,
  QuotasTab,
  AnnouncementsTab,
} from '@/features/platform-admin';
import { Flag, Sparkles, Scale, Megaphone, RefreshCw, Zap } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';

export default function AdminSettingsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefreshCache = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({
      queryKey: ['platform-admin', 'settings'],
    });
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success(t('admin.settings.cacheRefreshed'));
    }, 400);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {t('admin.settings.systemDynamicTitle')}
            </h1>
            <Badge
              variant="outline"
              className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs"
            >
              <Zap className="size-3" />
              <span>{t('admin.settings.badgeTier')}</span>
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{t('admin.settings.hotReloading')}</p>
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
            <span>{t('admin.settings.refreshCache')}</span>
          </Button>
        </div>
      </div>

      {/* Main Settings Tabs */}
      <Tabs defaultValue="feature-flags" className="flex flex-col gap-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:w-auto lg:inline-flex">
          <TabsTrigger value="feature-flags" className="gap-2">
            <Flag className="size-3.5" />
            <span>{t('admin.settings.tabFeatureFlags')}</span>
          </TabsTrigger>
          <TabsTrigger value="ai-defaults" className="gap-2">
            <Sparkles className="size-3.5" />
            <span>{t('admin.settings.tabAiDefaults')}</span>
          </TabsTrigger>
          <TabsTrigger value="quotas" className="gap-2">
            <Scale className="size-3.5" />
            <span>{t('admin.settings.tabQuotas')}</span>
          </TabsTrigger>
          <TabsTrigger value="announcements" className="gap-2">
            <Megaphone className="size-3.5" />
            <span>{t('admin.settings.tabAnnouncements')}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="feature-flags" className="outline-none">
          <FeatureFlagsTab />
        </TabsContent>

        <TabsContent value="ai-defaults" className="outline-none">
          <AiDefaultsTab />
        </TabsContent>

        <TabsContent value="quotas" className="outline-none">
          <QuotasTab />
        </TabsContent>

        <TabsContent value="announcements" className="outline-none">
          <AnnouncementsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
