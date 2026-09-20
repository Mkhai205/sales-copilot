'use client';

import * as React from 'react';
import { Inbox } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/layout/page-header';
import { SettingsGuard } from '../settings-guard';
import { useSettingsRbac } from '../../hooks/use-settings-rbac';
import { InboxesList } from './inboxes-list';

export interface InboxesSettingsViewProps {
  workspaceSlug: string;
}

export function InboxesSettingsView({ workspaceSlug }: InboxesSettingsViewProps) {
  const { currentWorkspace, currentRole, isLoading } = useSettingsRbac(workspaceSlug);

  return (
    <SettingsGuard workspaceSlug={workspaceSlug} segment="inboxes">
      <div className="flex flex-col gap-6 w-full p-6 overflow-y-auto">
        <PageHeader
          title="Hộp thư & Kênh liên lạc"
          description="Quản lý các kênh giao tiếp khách hàng và phân bổ nhân viên cho từng hộp thư."
          icon={Inbox}
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
          <InboxesList
            workspaceId={currentWorkspace.id}
            currentUserRole={currentRole ?? undefined}
            workspaceSlug={workspaceSlug}
          />
        )}
      </div>
    </SettingsGuard>
  );
}
