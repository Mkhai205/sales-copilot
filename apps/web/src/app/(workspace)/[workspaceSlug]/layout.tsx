import * as React from 'react';
import { WorkspaceSocketSync } from '@/lib/socket/workspace-socket-sync';
import { WorkspaceHeader } from '@/components/layout/workspace-header';

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}

export default async function WorkspaceLayout({ children, params }: WorkspaceLayoutProps) {
  const { workspaceSlug } = await params;

  return (
    <div className="flex h-svh max-h-svh min-h-0 w-full flex-col overflow-hidden bg-background">
      <WorkspaceSocketSync workspaceSlug={workspaceSlug} />
      <WorkspaceHeader workspaceSlug={workspaceSlug} />
      <div className="flex flex-1 min-h-0 w-full overflow-hidden">{children}</div>
    </div>
  );
}
