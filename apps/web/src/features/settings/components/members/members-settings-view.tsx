'use client';

import * as React from 'react';
import { UserCheck } from 'lucide-react';
import { SettingsPageLayout } from '../layout';
import { MembersTable } from './members-table';
import { useSettingsRbac } from '../../hooks/use-settings-rbac';

interface MembersSettingsViewProps {
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
