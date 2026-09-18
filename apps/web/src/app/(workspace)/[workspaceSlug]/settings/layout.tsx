import * as React from 'react';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { SettingsSidebar } from '@/features/identity';

interface SettingsLayoutProps {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}

export default async function SettingsLayout({ children, params }: SettingsLayoutProps) {
  const { workspaceSlug } = await params;

  return (
    <SidebarProvider defaultOpen={true} className="h-full min-h-0 w-full overflow-hidden">
      <SettingsSidebar workspaceSlug={workspaceSlug} />
      <SidebarInset className="h-full min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className="flex flex-col flex-1 w-full p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
