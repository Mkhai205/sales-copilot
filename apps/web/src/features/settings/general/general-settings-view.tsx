'use client';

import * as React from 'react';
import { Settings } from 'lucide-react';
import { SettingsPageLayout } from '../layout/settings-page-layout';
import { WorkspaceSettingsForm } from './components/workspace-settings-form';
import { useSettingsRbac } from '../rbac/use-settings-rbac';
import { useCurrentWorkspaceDetails } from './hooks/use-workspace-mutations';

interface GeneralSettingsViewProps {
  workspaceSlug: string;
}

export function GeneralSettingsView({ workspaceSlug }: GeneralSettingsViewProps) {
  const { currentWorkspace } = useSettingsRbac(workspaceSlug);
  const { data: workspaceDetails, isLoading: isLoadingDetails } = useCurrentWorkspaceDetails(
    currentWorkspace?.id,
  );

  const activeWorkspace = workspaceDetails || currentWorkspace;
  const isLoading = !activeWorkspace || (!!currentWorkspace?.id && isLoadingDetails);

  return (
    <SettingsPageLayout
      workspaceSlug={workspaceSlug}
      segment="general"
      title="Cài đặt Không gian làm việc"
      description="Quản lý thông tin chung, múi giờ và ngôn ngữ mặc định của không gian làm việc."
      icon={Settings}
      isLoading={isLoading}
      skeletonVariant="form"
    >
      {activeWorkspace && <WorkspaceSettingsForm workspace={activeWorkspace} />}
    </SettingsPageLayout>
  );
}
