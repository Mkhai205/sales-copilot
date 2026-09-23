'use client';

import * as React from 'react';
import { MessageSquareText } from 'lucide-react';
import { SettingsPageLayout } from '../layout';
import { useSettingsRbac } from '../../hooks/use-settings-rbac';
import { CannedResponsesList } from './canned-responses-list';

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
      description="Tạo các mẫu câu trả lời nhanh với phím tắt gợi ý (/) để phản hồi khách hàng tức thì."
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
