import * as React from 'react';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/sidebar/app-sidebar';

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}

export default async function WorkspaceLayout({ children, params }: WorkspaceLayoutProps) {
  const { workspaceSlug } = await params;

  return (
    <SidebarProvider defaultOpen={true} className="h-svh max-h-svh min-h-0 w-full overflow-hidden">
      <AppSidebar workspaceSlug={workspaceSlug} />
      <SidebarInset className="min-w-0 min-h-0 h-full flex-1 overflow-hidden">
        <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-background">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
