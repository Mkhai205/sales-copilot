'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  Check,
  LogOut,
  MessageSquare,
  Moon,
  Plus,
  Settings,
  ShoppingBag,
  Sun,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useQueryClient } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PresenceIndicator } from '@/components/ui/presence-indicator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkspaces, CreateWorkspaceDialog, useSettingsRbac } from '@/features/identity';
import { useCurrentUser, logoutAction } from '@/features/auth';
import { disconnectSocketClient } from '@/lib/socket/socket-client';

interface WorkspaceHeaderProps {
  workspaceSlug: string;
}

export function WorkspaceHeader({ workspaceSlug }: WorkspaceHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const [isCreateWsOpen, setIsCreateWsOpen] = React.useState(false);
  const [isLoggingOut, startLogoutTransition] = React.useTransition();

  const { data: workspaces } = useWorkspaces();
  const { data: user, isLoading: isUserLoading } = useCurrentUser();
  const { isAdmin } = useSettingsRbac(workspaceSlug);

  const activeWorkspace = workspaces?.find(w => w.slug === workspaceSlug) ?? {
    id: 'current',
    name: workspaceSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    slug: workspaceSlug,
    role: 'ADMIN' as const,
  };

  const handleSelectWorkspace = (slug: string) => {
    if (slug !== workspaceSlug) {
      router.push(`/${slug}/conversations`);
    }
  };

  const handleLogout = () => {
    startLogoutTransition(async () => {
      try {
        disconnectSocketClient();
        queryClient.clear();
      } catch {
        // Ignore cleanup errors
      }
      await logoutAction();
    });
  };

  // Determine active navigation module
  const isConversationsActive =
    pathname.startsWith(`/${workspaceSlug}/conversations`) ||
    pathname.startsWith(`/${workspaceSlug}/contacts`);

  const isCommerceActive =
    pathname.startsWith(`/${workspaceSlug}/orders`) ||
    pathname.startsWith(`/${workspaceSlug}/products`) ||
    pathname.startsWith(`/${workspaceSlug}/inventory`) ||
    pathname.startsWith(`/${workspaceSlug}/reconciliation`);

  const isAnalyticsActive = pathname.startsWith(`/${workspaceSlug}/analytics`);
  const isSettingsActive = pathname.startsWith(`/${workspaceSlug}/settings`);

  const navItems = [
    {
      label: 'Hội thoại',
      href: `/${workspaceSlug}/conversations`,
      icon: MessageSquare,
      isActive: isConversationsActive,
    },
    {
      label: 'Quản lý bán hàng',
      href: `/${workspaceSlug}/orders`,
      icon: ShoppingBag,
      isActive: isCommerceActive,
    },
    ...(isAdmin
      ? [
          {
            label: 'Phân tích & Báo cáo',
            href: `/${workspaceSlug}/analytics/overview`,
            icon: BarChart3,
            isActive: isAnalyticsActive,
          },
        ]
      : []),
    {
      label: 'Cài đặt',
      href: `/${workspaceSlug}/settings/general`,
      icon: Settings,
      isActive: isSettingsActive,
    },
  ];

  const displayName = user?.name || '';
  const displayEmail = user?.email || '';
  const displayInitials = displayName
    ? displayName
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '??';

  return (
    <>
      <header className="sticky top-0 z-40 grid h-14 w-full shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-border/80 bg-background/95 px-4 backdrop-blur-md">
        {/* Left Section: Logo & Workspace Switcher */}
        <div className="flex items-center justify-start">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex h-9 items-center gap-2.5 rounded-lg px-2 text-left hover:bg-muted/80 focus-visible:ring-1 focus-visible:ring-ring"
              >
                <Image
                  src="/brand/logo-icon.png"
                  alt={activeWorkspace.name || 'Sales Copilot'}
                  width={28}
                  height={28}
                  className="size-5.5 object-contain"
                  priority
                  unoptimized
                />
                <div className="flex flex-col text-left">
                  <span className="max-w-[130px] truncate text-xs font-semibold leading-tight text-foreground md:max-w-[170px]">
                    {activeWorkspace.name}
                  </span>
                  <span className="text-[10px] font-medium leading-none text-muted-foreground">
                    {activeWorkspace.role || 'Workspace'}
                  </span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 rounded-lg" align="start" sideOffset={6}>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Không gian làm việc
              </DropdownMenuLabel>
              {workspaces && workspaces.length > 0 ? (
                workspaces.map((ws, index) => {
                  const isCurrent = ws.slug === workspaceSlug;
                  return (
                    <DropdownMenuItem
                      key={ws.id}
                      onClick={() => handleSelectWorkspace(ws.slug)}
                      className="cursor-pointer gap-2 p-2"
                    >
                      <div className="flex size-6 items-center justify-center rounded-md border bg-muted text-xs font-medium">
                        {ws.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-xs font-medium">{ws.name}</span>
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
                  <div className="flex size-6 items-center justify-center rounded-md border bg-muted text-xs font-medium">
                    {activeWorkspace.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="truncate text-xs font-medium">{activeWorkspace.name}</span>
                  <Check className="ml-auto size-4 text-primary" />
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => setIsCreateWsOpen(true)}
                className="cursor-pointer gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <Plus className="size-3.5" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">Tạo Workspace mới</span>
              </DropdownMenuItem>

              <DropdownMenuItem asChild className="cursor-pointer gap-2 p-2">
                <Link href={`/${workspaceSlug}/settings/general`}>
                  <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                    <Settings className="size-3 text-muted-foreground" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    Cài đặt Workspace
                  </span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Center Navigation Tabs */}
        <nav className="flex items-center justify-center gap-1.5" aria-label="Điều hướng chính">
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex h-8.5 items-center gap-2 rounded-md px-3 text-xs font-medium transition-colors',
                  item.isActive
                    ? 'bg-primary/10 text-primary shadow-2xs font-semibold'
                    : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Section: Theme Toggle & User Menu */}
        <div className="flex items-center justify-end gap-2">
          {isUserLoading ? (
            <Skeleton className="size-8 rounded-full" />
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex h-9 items-center gap-2 rounded-full p-1 hover:bg-muted/80 focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <div className="relative shrink-0">
                    <Avatar className="size-7 border border-border">
                      <AvatarImage src={user?.avatarUrl || ''} alt={displayName} />
                      <AvatarFallback className="text-[11px] font-semibold">
                        {displayInitials}
                      </AvatarFallback>
                    </Avatar>
                    <PresenceIndicator
                      userId={user?.id}
                      placement="bottom-right"
                      size="xs"
                      showTooltip
                    />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 rounded-lg" align="end" sideOffset={6}>
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-2 py-1.5 text-left text-sm">
                    <div className="relative shrink-0">
                      <Avatar className="size-8 border">
                        <AvatarImage src={user?.avatarUrl || ''} alt={displayName} />
                        <AvatarFallback className="text-xs font-semibold">
                          {displayInitials}
                        </AvatarFallback>
                      </Avatar>
                      <PresenceIndicator userId={user?.id} placement="bottom-right" size="xs" />
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate text-xs font-medium">{displayName}</span>
                      <span className="truncate text-[11px] text-muted-foreground">
                        {displayEmail}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    className="cursor-pointer gap-2"
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  >
                    {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
                    <span className="text-xs">{`Chế độ ${theme === 'dark' ? 'Sáng' : 'Tối'}`}</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                  disabled={isLoggingOut}
                  onClick={handleLogout}
                  variant="destructive"
                >
                  <LogOut className="size-4" />
                  <span className="text-xs">
                    {isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      {/* Modal Dialog to Create a new Workspace */}
      <CreateWorkspaceDialog open={isCreateWsOpen} onOpenChange={setIsCreateWsOpen} />
    </>
  );
}
