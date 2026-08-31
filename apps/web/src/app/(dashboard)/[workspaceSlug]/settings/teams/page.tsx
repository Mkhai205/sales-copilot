'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Users2 } from 'lucide-react';
import { SettingsGuard } from '@/features/settings';

export default function TeamsSettingsPage() {
  const params = useParams();
  const workspaceSlug = (params?.workspaceSlug as string) || '';

  return (
    <SettingsGuard workspaceSlug={workspaceSlug} segment="teams">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Teams</h1>
          <p className="text-sm text-muted-foreground">
            Organize customer support agents into specialized teams.
          </p>
        </div>

        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-border p-8 text-center bg-card/40">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
            <Users2 className="size-6" />
          </div>
          <h3 className="text-base font-medium text-foreground">Teams Management</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            Teams list and team assignment (Task 30).
          </p>
        </div>
      </div>
    </SettingsGuard>
  );
}
