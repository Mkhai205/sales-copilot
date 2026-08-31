'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { SettingsGuard, MembersTable, useSettingsRbac } from '@/features/settings';

export default function MembersSettingsPage() {
  const params = useParams();
  const workspaceSlug = (params?.workspaceSlug as string) || '';

  const { currentWorkspace, currentUser, currentRole, isLoading } = useSettingsRbac(workspaceSlug);

  return (
    <SettingsGuard workspaceSlug={workspaceSlug} segment="members">
      <div className="flex flex-col gap-6 max-w-5xl">
        {/* Page Header */}
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Members & Roles</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your workspace team members, invite new colleagues, and control access
            permissions.
          </p>
        </div>

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
