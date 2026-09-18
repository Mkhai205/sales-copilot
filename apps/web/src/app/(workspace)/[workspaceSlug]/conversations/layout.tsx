import * as React from 'react';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { ConversationsSidebar } from '@/features/conversations';

interface ConversationsLayoutProps {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}

export default async function ConversationsLayout({ children, params }: ConversationsLayoutProps) {
  const { workspaceSlug } = await params;

  return (
    <SidebarProvider defaultOpen={false} className="h-full min-h-0 w-full overflow-hidden">
      <ConversationsSidebar workspaceSlug={workspaceSlug} />
      <SidebarInset className="h-full min-h-0 min-w-0 flex-1 overflow-hidden">
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
