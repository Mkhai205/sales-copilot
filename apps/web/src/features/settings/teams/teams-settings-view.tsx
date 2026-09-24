'use client';

import * as React from 'react';
import { Users2 } from 'lucide-react';
import { SettingsPageLayout } from '../layout/settings-page-layout';
import { useSettingsRbac } from '../rbac/use-settings-rbac';
import { TeamsList } from './components/teams-list';

export interface TeamsSettingsViewProps {
  workspaceSlug: string;
}

export function TeamsSettingsView({ workspaceSlug }: TeamsSettingsViewProps) {
  const { currentWorkspace, currentRole, isLoading } = useSettingsRbac(workspaceSlug);

  return (
    <SettingsPageLayout
      workspaceSlug={workspaceSlug}
      segment="teams"
      title="Đội nhóm"
      description="Tổ chức nhân viên tư vấn và bán hàng thành các đội nhóm chuyên biệt để cộng tác và phân bổ hội thoại."
      icon={Users2}
      isLoading={isLoading || !currentWorkspace}
      skeletonVariant="cards"
    >
      {currentWorkspace && (
        <TeamsList workspaceId={currentWorkspace.id} currentUserRole={currentRole ?? undefined} />
      )}
    </SettingsPageLayout>
  );
}
