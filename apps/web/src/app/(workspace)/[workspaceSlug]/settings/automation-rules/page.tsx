'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { SettingsGuard, AutomationRulesList, useSettingsRbac } from '@/features/settings';

export default function AutomationRulesSettingsPage() {
  const params = useParams();
  const workspaceSlug = (params?.workspaceSlug as string) || '';

  const { currentWorkspace, currentRole, isLoading } = useSettingsRbac(workspaceSlug);

  return (
    <SettingsGuard workspaceSlug={workspaceSlug} segment="automation-rules">
      <div className="flex flex-col gap-6 max-w-5xl">
        {/* Page Header */}
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Automation Rules</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure automated event triggers, condition filters, and conversation routing actions
            to streamline customer engagement.
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
          <AutomationRulesList
            workspaceId={currentWorkspace.id}
            currentUserRole={currentRole ?? undefined}
          />
        )}
      </div>
    </SettingsGuard>
  );
}
