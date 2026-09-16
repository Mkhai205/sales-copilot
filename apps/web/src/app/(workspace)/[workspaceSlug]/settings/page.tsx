'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { useSettingsRbac } from '@/features/settings';

export default function SettingsIndexPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceSlug = (params?.workspaceSlug as string) || '';
  const { defaultRoute, isLoading } = useSettingsRbac(workspaceSlug);

  React.useEffect(() => {
    if (!isLoading && defaultRoute && workspaceSlug) {
      router.replace(defaultRoute);
    }
  }, [isLoading, defaultRoute, router, workspaceSlug]);

  return (
    <div className="flex flex-col gap-6 p-2 max-w-4xl">
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
