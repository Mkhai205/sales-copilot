'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { FileText } from 'lucide-react';
import { SettingsGuard } from '@/features/settings';

export default function CannedResponsesSettingsPage() {
  const params = useParams();
  const workspaceSlug = (params?.workspaceSlug as string) || '';

  return (
    <SettingsGuard workspaceSlug={workspaceSlug} segment="canned-responses">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Canned Responses</h1>
          <p className="text-sm text-muted-foreground">
            Create reusable quick response templates with shortcode slash triggers.
          </p>
        </div>

        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-border p-8 text-center bg-card/40">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
            <FileText className="size-6" />
          </div>
          <h3 className="text-base font-medium text-foreground">Canned Responses Management</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            Templates list and canned response creation dialog (Task 32).
          </p>
        </div>
      </div>
    </SettingsGuard>
  );
}
