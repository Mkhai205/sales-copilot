'use client';

import * as React from 'react';
import { Users2 } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Skeleton } from '@/components/ui/skeleton';
import { SettingsGuard } from '../settings-guard';
import { TeamsList } from './teams-list';
import { useSettingsRbac } from '../../hooks/use-settings-rbac';

interface TeamsSettingsViewProps {
  workspaceSlug: string;
}

export function TeamsSettingsView({ workspaceSlug }: TeamsSettingsViewProps) {
  const { currentWorkspace, currentRole, isLoading } = useSettingsRbac(workspaceSlug);

  return (
    <SettingsGuard workspaceSlug={workspaceSlug} segment="teams">
      <div className="flex flex-col flex-1 h-full overflow-y-auto bg-background p-6 gap-5">
        <PageHeader
          title="Đội nhóm"
          description="Tổ chức nhân viên tư vấn và bán hàng thành các đội nhóm chuyên biệt để cộng tác và phân bổ hội thoại."
          icon={Users2}
        />

        {isLoading || !currentWorkspace ? (
          <div className="flex flex-col gap-4">
            <div className="flex justify-between gap-4">
              <Skeleton className="h-8 w-64 rounded-md" />
              <Skeleton className="h-8 w-32 rounded-md" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-44 w-full rounded-xl" />
              <Skeleton className="h-44 w-full rounded-xl" />
              <Skeleton className="h-44 w-full rounded-xl" />
            </div>
          </div>
        ) : (
          <TeamsList workspaceId={currentWorkspace.id} currentUserRole={currentRole ?? undefined} />
        )}
      </div>
    </SettingsGuard>
  );
}
