'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { SettingsGuard, TeamsList, useSettingsRbac } from '@/features/settings';

export default function TeamsSettingsPage() {
  const params = useParams();
  const workspaceSlug = (params?.workspaceSlug as string) || '';

  const { currentWorkspace, currentRole, isLoading } = useSettingsRbac(workspaceSlug);

  return (
    <SettingsGuard workspaceSlug={workspaceSlug} segment="teams">
      <div className="flex flex-col gap-6 max-w-5xl">
        {/* Page Header */}
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Teams</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Organize customer support and sales agents into dedicated teams for collaboration and
            auto-assignment.
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
