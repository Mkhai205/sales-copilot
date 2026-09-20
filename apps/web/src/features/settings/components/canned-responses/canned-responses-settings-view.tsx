'use client';

import * as React from 'react';
import { MessageSquareText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/layout/page-header';
import { SettingsGuard } from '../settings-guard';
import { useSettingsRbac } from '../../hooks/use-settings-rbac';
import { CannedResponsesList } from './canned-responses-list';

export interface CannedResponsesSettingsViewProps {
  workspaceSlug: string;
}

export function CannedResponsesSettingsView({ workspaceSlug }: CannedResponsesSettingsViewProps) {
  const { currentWorkspace, currentRole, isLoading } = useSettingsRbac(workspaceSlug);

  return (
    <SettingsGuard workspaceSlug={workspaceSlug} segment="canned-responses">
      <div className="flex flex-col gap-6 w-full p-6 overflow-y-auto">
        <PageHeader
          title="Tin nhắn mẫu"
          description="Tạo các mẫu câu trả lời nhanh với phím tắt gợi ý (/) để phản hồi khách hàng tức thì."
          icon={MessageSquareText}
        />

        {isLoading || !currentWorkspace ? (
          <div className="flex flex-col gap-4">
            <div className="flex justify-between gap-4">
              <Skeleton className="h-8 w-64 rounded-md" />
              <Skeleton className="h-8 w-32 rounded-md" />
            </div>
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        ) : (
          <CannedResponsesList
            workspaceId={currentWorkspace.id}
            currentUserRole={currentRole ?? undefined}
          />
        )}
      </div>
    </SettingsGuard>
  );
}
