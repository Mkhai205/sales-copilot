'use client';

import * as React from 'react';
import Image from 'next/image';
import { Check, ChevronsUpDown, Plus, Settings } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useWorkspaces, CreateWorkspaceDialog } from '@/features/identity';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
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
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);

  const { data: workspaces } = useWorkspaces();

  const activeWorkspace = workspaces?.find(w => w.slug === currentSlug) ?? {
    id: 'current',
    name: currentSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    slug: currentSlug,
    role: 'ADMIN' as const,
  };

  const handleSelectWorkspace = (slug: string) => {
    if (slug !== currentSlug) {
      router.push(`/${slug}/conversations`);
    }
  };

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
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
                  <span className="truncate text-xs text-muted-foreground">
                    {activeWorkspace.role || 'Workspace'}
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 opacity-50 group-data-[collapsible=icon]:hidden" />
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
                workspaces.map((ws, index) => {
                  const isCurrent = ws.slug === currentSlug;
                  return (
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
                        <span className="text-[10px] text-muted-foreground">{ws.role}</span>
                      </div>
                      {isCurrent && <Check className="ml-auto size-4 text-primary" />}
                      {index < 9 && !isCurrent && (
                        <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
                      )}
                    </DropdownMenuItem>
                  );
                })
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

              {/* Add Workspace trigger */}
              <DropdownMenuItem
                onClick={() => setIsCreateOpen(true)}
                className="gap-2 p-2 cursor-pointer"
              >
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <Plus className="size-4" />
                </div>
                <div className="font-medium text-muted-foreground">Tạo Workspace mới</div>
              </DropdownMenuItem>

              {/* Workspace Settings shortcut */}
              <DropdownMenuItem asChild className="gap-2 p-2 cursor-pointer">
                <Link href={`/${currentSlug}/settings`}>
                  <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                    <Settings className="size-3.5 text-muted-foreground" />
                  </div>
                  <div className="font-medium text-muted-foreground">Cài đặt Workspace</div>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      {/* Modal Dialog to Create a new Workspace */}
      <CreateWorkspaceDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </>
  );
}
