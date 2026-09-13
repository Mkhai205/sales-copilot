'use client';

import * as React from 'react';
import Link from 'next/link';
import { Sliders, Building2, ScrollText, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

export function QuickShortcuts() {
  const { t } = useI18n();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {/* Shortcut 1: Workspaces */}
      <Card className="flex flex-col justify-between border-border bg-card transition-shadow hover:shadow-sm">
        <CardHeader className="gap-2">
          <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
            <Building2 className="size-5" />
          </div>
          <CardTitle className="text-base">{t('admin.workspaces.title')}</CardTitle>
          <CardDescription className="text-xs">{t('admin.workspaces.description')}</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Link
            href="/admin/workspaces"
            className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'w-full gap-2')}
          >
            <span>{t('admin.overview.manageShop')}</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </CardContent>
      </Card>

      {/* Shortcut 2: Settings */}
      <Card className="flex flex-col justify-between border-border bg-card transition-shadow hover:shadow-sm">
        <CardHeader className="gap-2">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sliders className="size-5" />
          </div>
          <CardTitle className="text-base">{t('admin.settings.title')}</CardTitle>
          <CardDescription className="text-xs">{t('admin.settings.description')}</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Link
            href="/admin/settings"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full gap-2')}
          >
            <span>{t('admin.overview.accessSettings')}</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </CardContent>
      </Card>

      {/* Shortcut 3: Audit Logs */}
      <Card className="flex flex-col justify-between border-border bg-card transition-shadow hover:shadow-sm">
        <CardHeader className="gap-2">
          <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
            <ScrollText className="size-5" />
          </div>
          <CardTitle className="text-base">{t('admin.auditLogs.title')}</CardTitle>
          <CardDescription className="text-xs">{t('admin.auditLogs.description')}</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Link
            href="/admin/audit-logs"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full gap-2')}
          >
            <span>{t('admin.overview.viewAuditLogs')}</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
