'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import {
  SettingsGuard,
  WorkspaceSettingsForm,
  useSettingsRbac,
  useCurrentWorkspaceDetails,
} from '@/features/settings';

export default function GeneralSettingsPage() {
  const params = useParams();
  const workspaceSlug = (params?.workspaceSlug as string) || '';

  const { currentWorkspace, isLoading: isLoadingRbac } = useSettingsRbac(workspaceSlug);
  const { data: workspaceDetails, isLoading: isLoadingDetails } = useCurrentWorkspaceDetails(
    currentWorkspace?.id,
  );

  const isLoading = isLoadingRbac || (!!currentWorkspace?.id && isLoadingDetails);
  const activeWorkspace = workspaceDetails || currentWorkspace;

  return (
    <SettingsGuard workspaceSlug={workspaceSlug} segment="general">
      {isLoading || !activeWorkspace ? (
        <div className="flex flex-col gap-6 max-w-4xl">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : (
        <div className="max-w-4xl">
          <WorkspaceSettingsForm workspace={activeWorkspace} />
        </div>
      )}
    </SettingsGuard>
  );
}
