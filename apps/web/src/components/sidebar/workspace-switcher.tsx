'use client';

import * as React from 'react';
import { Building2, Check, ChevronsUpDown, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { workspacesApi } from '@/lib/api/workspaces';
import type { UserWorkspaceDto } from '@sales-copilot/shared-contracts';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

interface WorkspaceSwitcherProps {
  currentSlug: string;
}

export function WorkspaceSwitcher({ currentSlug }: WorkspaceSwitcherProps) {
  const { isMobile } = useSidebar();
  const router = useRouter();

  const { data: workspaces } = useQuery<UserWorkspaceDto[]>({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const res = await workspacesApi.list();
      return res.data;
    },
    staleTime: 60 * 1000,
  });

  const activeWorkspace = workspaces?.find(w => w.slug === currentSlug) ?? {
    id: 'current',
    name: currentSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    slug: currentSlug,
    role: 'ADMIN',
  };

  const handleSelectWorkspace = (slug: string) => {
    if (slug !== currentSlug) {
      router.push(`/${slug}/conversations`);
    }
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold">
                <Building2 className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{activeWorkspace.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {activeWorkspace.role || 'Workspace'}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 opacity-50" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Workspaces
            </DropdownMenuLabel>
            {workspaces && workspaces.length > 0 ? (
              workspaces.map(ws => (
                <DropdownMenuItem
                  key={ws.id}
                  onClick={() => handleSelectWorkspace(ws.slug)}
                  className="gap-2 p-2 cursor-pointer"
                >
                  <div className="flex size-6 items-center justify-center rounded-md border bg-muted font-medium text-xs">
                    {ws.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="truncate font-medium">{ws.name}</span>
                    <span className="text-xs text-muted-foreground">{ws.role}</span>
                  </div>
                  {ws.slug === currentSlug && <Check className="ml-auto size-4 text-primary" />}
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuItem className="gap-2 p-2">
                <div className="flex size-6 items-center justify-center rounded-md border bg-muted font-medium text-xs">
                  {activeWorkspace.name.slice(0, 2).toUpperCase()}
                </div>
                <span className="truncate font-medium">{activeWorkspace.name}</span>
                <Check className="ml-auto size-4 text-primary" />
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="gap-2 p-2 cursor-pointer">
              <Link href={`/${currentSlug}/settings`}>
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <Plus className="size-4" />
                </div>
                <div className="font-medium text-muted-foreground">Workspace Settings</div>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
