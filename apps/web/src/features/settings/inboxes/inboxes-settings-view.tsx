'use client';

import * as React from 'react';
import { Inbox } from 'lucide-react';
import { SettingsPageLayout } from '../layout/settings-page-layout';
import { useSettingsRbac } from '../rbac/use-settings-rbac';
import { InboxesList } from './components/inboxes-list';

export interface InboxesSettingsViewProps {
  workspaceSlug: string;
}

export function InboxesSettingsView({ workspaceSlug }: InboxesSettingsViewProps) {
  const { currentWorkspace, currentRole, isLoading } = useSettingsRbac(workspaceSlug);

  return (
    <SettingsPageLayout
      workspaceSlug={workspaceSlug}
      segment="inboxes"
      title="Hộp thư & Kênh liên lạc"
      description="Quản lý các kênh giao tiếp khách hàng và phân bổ nhân viên cho từng hộp thư."
      icon={Inbox}
      isLoading={isLoading || !currentWorkspace}
      skeletonVariant="cards"
    >
      {currentWorkspace && (
        <InboxesList
          workspaceId={currentWorkspace.id}
          currentUserRole={currentRole ?? undefined}
          workspaceSlug={workspaceSlug}
        />
      )}
    </SettingsPageLayout>
  );
}
