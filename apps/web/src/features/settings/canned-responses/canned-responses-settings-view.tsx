'use client';

import * as React from 'react';
import { MessageSquareText } from 'lucide-react';
import { SettingsPageLayout } from '../layout/settings-page-layout';
import { useSettingsRbac } from '../rbac/use-settings-rbac';
import { CannedResponsesList } from './components/canned-responses-list';

export interface CannedResponsesSettingsViewProps {
  workspaceSlug: string;
}

export function CannedResponsesSettingsView({ workspaceSlug }: CannedResponsesSettingsViewProps) {
  const { currentWorkspace, currentRole, isLoading } = useSettingsRbac(workspaceSlug);

  return (
    <SettingsPageLayout
      workspaceSlug={workspaceSlug}
      segment="canned-responses"
      title="Tin nhắn mẫu"
      description="Quản lý các câu trả lời soạn sẵn để phản hồi nhanh chóng và nhất quán cho khách hàng bằng lệnh tắt."
      icon={MessageSquareText}
      isLoading={isLoading || !currentWorkspace}
      skeletonVariant="table"
    >
      {currentWorkspace && (
        <CannedResponsesList
          workspaceId={currentWorkspace.id}
          currentUserRole={currentRole ?? undefined}
        />
      )}
    </SettingsPageLayout>
  );
}
