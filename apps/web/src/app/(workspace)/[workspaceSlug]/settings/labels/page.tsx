'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { LabelsList } from '@/features/omnichannel';
import { SettingsGuard, useSettingsRbac } from '@/features/identity';

export default function LabelsSettingsPage() {
  const params = useParams();
  const workspaceSlug = (params?.workspaceSlug as string) || '';

  const { currentWorkspace, currentRole, isLoading } = useSettingsRbac(workspaceSlug);

  return (
    <SettingsGuard workspaceSlug={workspaceSlug} segment="labels">
      <div className="flex flex-col gap-6 w-full">
        {/* Page Header */}
        <div className="pb-3 border-b border-border/70">
          <h1 className="text-xl font-bold tracking-tight text-foreground">{'Nhãn hội thoại'}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {
              'Phân loại và tổ chức các cuộc hội thoại với nhãn màu tùy chỉnh để lọc nhanh trên thanh điều hướng.'
            }
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
          <LabelsList
            workspaceId={currentWorkspace.id}
            currentUserRole={currentRole ?? undefined}
          />
        )}
      </div>
    </SettingsGuard>
  );
}
