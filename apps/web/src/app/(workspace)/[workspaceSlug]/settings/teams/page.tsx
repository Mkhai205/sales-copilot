'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { SettingsGuard, TeamsList, useSettingsRbac } from '@/features/identity';

export default function TeamsSettingsPage() {
  const params = useParams();
  const workspaceSlug = (params?.workspaceSlug as string) || '';

  const { currentWorkspace, currentRole, isLoading } = useSettingsRbac(workspaceSlug);

  return (
    <SettingsGuard workspaceSlug={workspaceSlug} segment="teams">
      <div className="flex flex-col gap-6 w-full">
        {/* Page Header */}
        <div className="pb-3 border-b border-border/70">
          <h1 className="text-xl font-bold tracking-tight text-foreground">{'Đội nhóm'}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {
              'Tổ chức nhân viên tư vấn và bán hàng thành các đội nhóm chuyên biệt để cộng tác và phân bổ hội thoại.'
            }
          </p>
        </div>

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
