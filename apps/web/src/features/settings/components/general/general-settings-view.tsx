'use client';

import * as React from 'react';
import { Settings } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/layout';
import { SettingsGuard } from '../settings-guard';
import { WorkspaceSettingsForm } from './workspace-settings-form';
import { useSettingsRbac } from '../../hooks/use-settings-rbac';
import { useCurrentWorkspaceDetails } from '../../hooks/use-workspace-mutations';

interface GeneralSettingsViewProps {
  workspaceSlug: string;
}

export function GeneralSettingsView({ workspaceSlug }: GeneralSettingsViewProps) {
  const { currentWorkspace, isLoading: isLoadingRbac } = useSettingsRbac(workspaceSlug);
  const { data: workspaceDetails, isLoading: isLoadingDetails } = useCurrentWorkspaceDetails(
    currentWorkspace?.id,
  );

  const isLoading = isLoadingRbac || (!!currentWorkspace?.id && isLoadingDetails);
  const activeWorkspace = workspaceDetails || currentWorkspace;

  return (
    <SettingsGuard workspaceSlug={workspaceSlug} segment="general">
      <div className="flex flex-col flex-1 h-full overflow-y-auto bg-background p-6 gap-5">
        <PageHeader
          title="Cài đặt Không gian làm việc"
          description="Quản lý thông tin chung, múi giờ và ngôn ngữ mặc định của không gian làm việc."
          icon={Settings}
        />

        {isLoading || !activeWorkspace ? (
          <div className="flex flex-col gap-6 w-full">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        ) : (
          <WorkspaceSettingsForm workspace={activeWorkspace} />
        )}
      </div>
    </SettingsGuard>
  );
}
