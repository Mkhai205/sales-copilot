'use client';

import * as React from 'react';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/features/platform-admin/components/admin-sidebar';
import { AdminHeader } from '@/features/platform-admin/components/admin-header';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={true} className="h-svh max-h-svh min-h-0 w-full overflow-hidden">
      <AdminSidebar />
      <SidebarInset className="min-w-0 min-h-0 h-full flex-1 overflow-hidden flex flex-col">
        <AdminHeader />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-6xl">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
