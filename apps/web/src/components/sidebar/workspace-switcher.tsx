'use client';

import * as React from 'react';
import Image from 'next/image';
import { useWorkspaces } from '@/features/identity';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';

interface WorkspaceSwitcherProps {
  currentSlug: string;
}

/**
 * Brand Static Badge (TASK-3A-05: Streamlined 1 user = 1 shop workspace UI).
 * Displays logo, current shop name, and live online status without switcher dropdown.
 */
export function WorkspaceSwitcher({ currentSlug }: WorkspaceSwitcherProps) {
  const { data: workspaces } = useWorkspaces();

  const activeWorkspace = workspaces?.find(w => w.slug === currentSlug) ?? {
    id: 'current',
    name: currentSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    slug: currentSlug,
    role: 'ADMIN' as const,
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          className="cursor-default hover:bg-transparent active:bg-transparent"
        >
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg">
            <Image
              src="/brand/logo-icon.png"
              alt={activeWorkspace.name || 'Sales Copilot'}
              width={32}
              height={32}
              className="size-7 object-contain"
              priority
              unoptimized
            />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate font-semibold">{activeWorkspace.name}</span>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
              <span className="truncate font-normal">Trực tuyến</span>
            </div>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
