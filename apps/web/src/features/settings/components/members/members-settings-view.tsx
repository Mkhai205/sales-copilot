'use client';

import * as React from 'react';
import { UserCheck } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Skeleton } from '@/components/ui/skeleton';
import { SettingsGuard } from '../settings-guard';
import { MembersTable } from './members-table';
import { useSettingsRbac } from '../../hooks/use-settings-rbac';

interface MembersSettingsViewProps {
  workspaceSlug: string;
}

export function MembersSettingsView({ workspaceSlug }: MembersSettingsViewProps) {
  const { currentWorkspace, currentUser, currentRole, isLoading } = useSettingsRbac(workspaceSlug);

  return (
    <SettingsGuard workspaceSlug={workspaceSlug} segment="members">
      <div className="flex flex-col flex-1 h-full overflow-y-auto bg-background p-6 gap-5">
        <PageHeader
          title="Thành viên & Phân quyền"
          description="Quản lý thành viên trong không gian làm việc, mời cộng sự mới và thiết lập vai trò truy cập."
          icon={UserCheck}
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
          <MembersTable
            workspaceId={currentWorkspace.id}
            currentUserId={currentUser?.id}
            currentUserRole={currentRole ?? undefined}
          />
        )}
      </div>
    </SettingsGuard>
  );
}
