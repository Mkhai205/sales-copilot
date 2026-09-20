'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
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
    <div className="flex flex-col gap-6 w-full p-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    </div>
  );
}
