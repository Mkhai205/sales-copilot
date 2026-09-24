'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings } from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { useSettingsRbac } from '../rbac/use-settings-rbac';

interface SettingsSidebarProps extends React.ComponentProps<typeof Sidebar> {
  workspaceSlug: string;
}

export function SettingsSidebar({ workspaceSlug, ...props }: SettingsSidebarProps) {
  const pathname = usePathname();
  const { isLoading, groupedNavItems } = useSettingsRbac(workspaceSlug);

  return (
    <Sidebar collapsible="icon" className="border-r border-border/80" {...props}>
      <SidebarHeader className="flex h-12 flex-row items-center justify-between border-b border-sidebar-border/40 px-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
        <div className="flex items-center gap-2 font-medium text-sidebar-foreground group-data-[collapsible=icon]:hidden">
          <Settings className="size-4 text-primary" />
          <span className="text-xs font-semibold">Cài đặt</span>
        </div>
        <SidebarTrigger className="size-7" />
      </SidebarHeader>

      <SidebarContent>
        {isLoading ? (
          <div className="flex flex-col gap-4 p-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-full rounded-md" />
            <Skeleton className="h-8 w-full rounded-md" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-full rounded-md" />
            <Skeleton className="h-8 w-full rounded-md" />
          </div>
        ) : (
          groupedNavItems.map(group => (
            <SidebarGroup key={group.id}>
              <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map(item => {
                    const itemUrl = `/${workspaceSlug}/settings/${item.segment}`;
                    const isActive = pathname === itemUrl || pathname.startsWith(`${itemUrl}/`);
                    const Icon = item.icon;
                    const title = item.title;

                    return (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton asChild isActive={isActive} tooltip={title}>
                          <Link href={itemUrl}>
                            <Icon className="size-4" />
                            <span>{title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))
        )}
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
