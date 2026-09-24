'use client';

import * as React from 'react';
import { UserCheck } from 'lucide-react';
import { SettingsPageLayout } from '../layout/settings-page-layout';
import { useSettingsRbac } from '../rbac/use-settings-rbac';
import { MembersTable } from './components/members-table';

export interface MembersSettingsViewProps {
  workspaceSlug: string;
}

export function MembersSettingsView({ workspaceSlug }: MembersSettingsViewProps) {
  const { currentWorkspace, currentUser, currentRole, isLoading } = useSettingsRbac(workspaceSlug);

  return (
    <SettingsPageLayout
      workspaceSlug={workspaceSlug}
      segment="members"
      title="Thành viên & Phân quyền"
      description="Quản lý thành viên trong không gian làm việc, mời cộng sự mới và thiết lập vai trò truy cập."
      icon={UserCheck}
      isLoading={isLoading || !currentWorkspace}
      skeletonVariant="table"
    >
      {currentWorkspace && (
        <MembersTable
          workspaceId={currentWorkspace.id}
          currentUserId={currentUser?.id}
          currentUserRole={currentRole ?? undefined}
        />
      )}
    </SettingsPageLayout>
  );
}
