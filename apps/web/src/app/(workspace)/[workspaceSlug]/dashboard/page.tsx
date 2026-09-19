'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { WorkspaceRole } from '@sales-copilot/shared-contracts';
import { useWorkspaces } from '@/features/identity';
import { DashboardView } from '@/features/dashboard';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = React.use(params);
  const router = useRouter();
  const { data: workspaces, isLoading } = useWorkspaces();

  const currentWorkspace = workspaces?.find(w => w.slug === workspaceSlug);

  React.useEffect(() => {
    if (!isLoading && currentWorkspace) {
      if (currentWorkspace.role === WorkspaceRole.AGENT) {
        router.replace(`/${workspaceSlug}/conversations`);
      }
    }
  }, [isLoading, currentWorkspace, router, workspaceSlug]);

  if (isLoading || !currentWorkspace) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6 bg-background">
        <div className="mx-auto w-full max-w-7xl space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (currentWorkspace.role === WorkspaceRole.AGENT) {
    return null;
  }

  return (
    <DashboardView
      workspaceId={currentWorkspace.id}
      workspaceSlug={workspaceSlug}
      workspaceName={currentWorkspace.name}
    />
  );
}
