'use client';

import * as React from 'react';
import { Tag } from 'lucide-react';
import { SettingsPageLayout } from '../layout';
import { useSettingsRbac } from '../../hooks/use-settings-rbac';
import { LabelsList } from './labels-list';

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
      description="Phân loại và tổ chức các cuộc hội thoại với nhãn màu tùy chỉnh để lọc nhanh trên thanh điều hướng."
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
