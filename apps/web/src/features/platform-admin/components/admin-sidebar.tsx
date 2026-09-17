'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShieldCheck,
  LayoutDashboard,
  Building2,
  Sliders,
  ScrollText,
  ArrowLeft,
  Sun,
  Moon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/features/auth';
import { useI18n } from '@/lib/i18n';
import { isNavItemActive } from './navigation-helpers';

export interface AdminNavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: 'Overview', href: '/platform-admin', icon: LayoutDashboard },
  { label: 'Workspaces', href: '/platform-admin/workspaces', icon: Building2 },
  { label: 'Settings', href: '/platform-admin/settings', icon: Sliders },
  { label: 'Audit Logs', href: '/platform-admin/audit-logs', icon: ScrollText },
];

export function AdminSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { data: currentUser } = useCurrentUser();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { t } = useI18n();

  const navItems = [
    { label: t('admin.nav.overview'), href: '/platform-admin', icon: LayoutDashboard },
    { label: t('admin.nav.workspaces'), href: '/platform-admin/workspaces', icon: Building2 },
    { label: t('admin.nav.settings'), href: '/platform-admin/settings', icon: Sliders },
    { label: t('admin.nav.auditLogs'), href: '/platform-admin/audit-logs', icon: ScrollText },
  ];

  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader className="border-b border-sidebar-border p-3">
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="size-5" />
          </div>
          <div className="flex flex-col gap-0.5 overflow-hidden group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-tight text-sidebar-foreground truncate">
                Sales Copilot
              </span>
              <Badge
                variant="outline"
                className="border-primary/30 bg-primary/10 text-primary text-[10px] px-1.5 py-0 font-medium"
              >
                Admin
              </Badge>
            </div>
            <span className="text-[11px] text-muted-foreground truncate">
              {t('admin.platformControl')}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
            {t('admin.title')}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = isNavItemActive(item.href, pathname);

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                      <Link href={item.href}>
                        <Icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={t('admin.backToWorkspace')}>
              <Link href="/">
                <ArrowLeft />
                <span>{t('admin.backToWorkspace')}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <div className="flex items-center justify-between px-2 pt-1 group-data-[collapsible=icon]:hidden">
          <div className="flex flex-col min-w-0 max-w-[150px]">
            <span className="text-xs font-medium text-sidebar-foreground truncate">
              {currentUser?.name || currentUser?.email || 'Super Administrator'}
            </span>
            <span className="text-[10px] text-muted-foreground truncate">
              {currentUser?.email || 'superadmin@salescopilot.io'}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme((resolvedTheme || theme) === 'dark' ? 'light' : 'dark')}
            className="size-7 text-muted-foreground hover:text-foreground shrink-0"
            title={t('admin.toggleTheme')}
          >
            <Sun className="size-3.5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute size-3.5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
