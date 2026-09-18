'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { CannedResponsesList } from '@/features/omnichannel';
import { SettingsGuard, useSettingsRbac } from '@/features/identity';

export default function CannedResponsesSettingsPage() {
  const params = useParams();
  const workspaceSlug = (params?.workspaceSlug as string) || '';

  const { currentWorkspace, currentRole, isLoading } = useSettingsRbac(workspaceSlug);

  return (
    <SettingsGuard workspaceSlug={workspaceSlug} segment="canned-responses">
      <div className="flex flex-col gap-6 w-full">
        {/* Page Header */}
        <div className="pb-3 border-b border-border/70">
          <h1 className="text-xl font-bold tracking-tight text-foreground">{'Tin nhắn mẫu'}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {'Tạo các mẫu câu trả lời nhanh với phím tắt gợi ý (/) để phản hồi khách hàng tức thì.'}
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
          <CannedResponsesList
            workspaceId={currentWorkspace.id}
            currentUserRole={currentRole ?? undefined}
          />
        )}
      </div>
    </SettingsGuard>
  );
}
