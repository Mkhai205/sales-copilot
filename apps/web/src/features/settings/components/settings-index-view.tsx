'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { SettingsPageLayout } from './layout';
import { useSettingsRbac } from '../hooks/use-settings-rbac';

export interface SettingsIndexViewProps {
  workspaceSlug: string;
}

export function SettingsIndexView({ workspaceSlug }: SettingsIndexViewProps) {
  const router = useRouter();
  const { defaultRoute, isLoading } = useSettingsRbac(workspaceSlug);

  React.useEffect(() => {
    if (!isLoading && defaultRoute && workspaceSlug) {
      router.replace(defaultRoute);
    }
  }, [isLoading, defaultRoute, router, workspaceSlug]);

  return (
    <SettingsPageLayout
      workspaceSlug={workspaceSlug}
      title="Cài đặt"
      isLoading={true}
      skeletonVariant="form"
    >
      <div />
    </SettingsPageLayout>
  );
}
