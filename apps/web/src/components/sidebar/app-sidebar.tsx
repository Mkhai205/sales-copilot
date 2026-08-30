'use client';

import * as React from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar';
import { WorkspaceSwitcher } from '@/components/sidebar/workspace-switcher';
import { NavMain } from '@/components/sidebar/nav-main';
import { NavUser } from '@/components/sidebar/nav-user';

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  workspaceSlug: string;
}

export function AppSidebar({ workspaceSlug, ...props }: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader className="gap-2">
        <WorkspaceSwitcher currentSlug={workspaceSlug} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain workspaceSlug={workspaceSlug} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
