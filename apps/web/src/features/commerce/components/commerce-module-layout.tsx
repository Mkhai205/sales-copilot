import * as React from 'react';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { CommerceSidebar } from './commerce-sidebar';

interface CommerceModuleLayoutProps {
  children: React.ReactNode;
  workspaceSlug: string;
}

export function CommerceModuleLayout({ children, workspaceSlug }: CommerceModuleLayoutProps) {
  return (
    <SidebarProvider defaultOpen={true} className="h-full min-h-0 w-full overflow-hidden">
      <CommerceSidebar workspaceSlug={workspaceSlug} />
      <SidebarInset className="h-full min-h-0 min-w-0 flex-1 overflow-hidden">
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
