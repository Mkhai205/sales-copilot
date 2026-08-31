'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Tag } from 'lucide-react';
import { SettingsGuard } from '@/features/settings';

export default function LabelsSettingsPage() {
  const params = useParams();
  const workspaceSlug = (params?.workspaceSlug as string) || '';

  return (
    <SettingsGuard workspaceSlug={workspaceSlug} segment="labels">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Labels</h1>
          <p className="text-sm text-muted-foreground">
            Categorize conversations with custom color tags and organizational labels.
          </p>
        </div>

        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-border p-8 text-center bg-card/40">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
            <Tag className="size-6" />
          </div>
          <h3 className="text-base font-medium text-foreground">Labels Management</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            Labels list and color picker modal (Task 31).
          </p>
        </div>
      </div>
    </SettingsGuard>
  );
}
