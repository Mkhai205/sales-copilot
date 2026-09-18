'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Award, BarChart3, LineChart, PieChart } from 'lucide-react';

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

interface AnalyticsSidebarProps extends React.ComponentProps<typeof Sidebar> {
  workspaceSlug: string;
}

export function AnalyticsSidebar({ workspaceSlug, ...props }: AnalyticsSidebarProps) {
  const pathname = usePathname();

  const isOverviewActive =
    pathname === `/${workspaceSlug}/analytics` ||
    pathname.startsWith(`/${workspaceSlug}/analytics/overview`);
  const isAgentsActive = pathname.startsWith(`/${workspaceSlug}/analytics/agents`);
  const isChannelsActive = pathname.startsWith(`/${workspaceSlug}/analytics/channels`);

  return (
    <Sidebar collapsible="icon" className="border-r border-border/80" {...props}>
      <SidebarHeader className="flex h-12 flex-row items-center justify-between border-b border-sidebar-border/40 px-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
        <div className="flex items-center gap-2 font-medium text-sidebar-foreground group-data-[collapsible=icon]:hidden">
          <BarChart3 className="size-4 text-primary" />
          <span className="text-xs font-semibold">Phân tích & Báo cáo</span>
        </div>
        <SidebarTrigger className="size-7" />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
            Báo cáo chi tiết
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isOverviewActive}
                  tooltip="Tổng quan doanh thu"
                >
                  <Link href={`/${workspaceSlug}/analytics/overview`}>
                    <LineChart className="size-4" />
                    <span>Tổng quan doanh thu</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isAgentsActive} tooltip="Hiệu suất nhân viên">
                  <Link href={`/${workspaceSlug}/analytics/agents`}>
                    <Award className="size-4" />
                    <span>Hiệu suất nhân viên</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isChannelsActive} tooltip="Báo cáo theo kênh">
                  <Link href={`/${workspaceSlug}/analytics/channels`}>
                    <PieChart className="size-4" />
                    <span>Báo cáo theo kênh</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
