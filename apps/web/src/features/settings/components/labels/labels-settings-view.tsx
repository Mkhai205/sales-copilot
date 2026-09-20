'use client';

import * as React from 'react';
import { Tag } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/layout/page-header';
import { SettingsGuard } from '../settings-guard';
import { useSettingsRbac } from '../../hooks/use-settings-rbac';
import { LabelsList } from './labels-list';

export interface LabelsSettingsViewProps {
  workspaceSlug: string;
}

export function LabelsSettingsView({ workspaceSlug }: LabelsSettingsViewProps) {
  const { currentWorkspace, currentRole, isLoading } = useSettingsRbac(workspaceSlug);

  return (
    <SettingsGuard workspaceSlug={workspaceSlug} segment="labels">
      <div className="flex flex-col gap-6 w-full p-6 overflow-y-auto">
        <PageHeader
          title="Nhãn hội thoại"
          description="Phân loại và tổ chức các cuộc hội thoại với nhãn màu tùy chỉnh để lọc nhanh trên thanh điều hướng."
          icon={Tag}
        />

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
