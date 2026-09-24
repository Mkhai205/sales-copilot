'use client';

import * as React from 'react';
import { Tag } from 'lucide-react';
import { SettingsPageLayout } from '../layout/settings-page-layout';
import { useSettingsRbac } from '../rbac/use-settings-rbac';
import { LabelsList } from './components/labels-list';

export interface LabelsSettingsViewProps {
  workspaceSlug: string;
}

export function LabelsSettingsView({ workspaceSlug }: LabelsSettingsViewProps) {
  const { currentWorkspace, currentRole, isLoading } = useSettingsRbac(workspaceSlug);

  return (
    <SettingsPageLayout
      workspaceSlug={workspaceSlug}
      segment="labels"
      title="Nhãn hội thoại"
      description="Quản lý các nhãn màu tùy chỉnh để phân loại khách hàng, trạng thái xử lý và lọc hội thoại."
      icon={Tag}
      isLoading={isLoading || !currentWorkspace}
      skeletonVariant="table"
    >
      {currentWorkspace && (
        <LabelsList workspaceId={currentWorkspace.id} currentUserRole={currentRole ?? undefined} />
      )}
    </SettingsPageLayout>
  );
}
