'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Moon,
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkspaces } from '@/features/identity';
import { useCurrentUser, logoutAction } from '@/features/auth';
import { disconnectSocketClient } from '@/lib/socket/socket-client';

interface WorkspaceHeaderProps {
  workspaceSlug: string;
}

export function WorkspaceHeader({ workspaceSlug }: WorkspaceHeaderProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const [isLoggingOut, startLogoutTransition] = React.useTransition();

  const { data: workspaces } = useWorkspaces();
  const { data: user, isLoading: isUserLoading } = useCurrentUser();

  const activeWorkspace = workspaces?.find(w => w.slug === workspaceSlug) ?? {
    id: 'current',
    name: workspaceSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    slug: workspaceSlug,
    role: 'ADMIN' as const,
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
  const isDashboardActive =
    pathname === `/${workspaceSlug}/dashboard` ||
    pathname.startsWith(`/${workspaceSlug}/dashboard/`);

  const isConversationsActive =
    pathname.startsWith(`/${workspaceSlug}/conversations`) ||
    pathname.startsWith(`/${workspaceSlug}/contacts`);

  const isCommerceActive =
    pathname.startsWith(`/${workspaceSlug}/orders`) ||
    pathname.startsWith(`/${workspaceSlug}/products`) ||
    pathname.startsWith(`/${workspaceSlug}/inventory`) ||
    pathname.startsWith(`/${workspaceSlug}/reconciliation`);

  const isSettingsActive = pathname.startsWith(`/${workspaceSlug}/settings`);

  const canAccessDashboard = activeWorkspace?.role === 'OWNER' || activeWorkspace?.role === 'ADMIN';

  const navItems = [
    ...(canAccessDashboard
      ? [
          {
            label: 'Tổng quan',
            href: `/${workspaceSlug}/dashboard`,
            icon: LayoutDashboard,
            isActive: isDashboardActive,
          },
        ]
      : []),
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
    <header className="sticky top-0 z-40 grid h-14 w-full shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-border/80 bg-background/95 px-4 backdrop-blur-md">
      {/* Left Section: Brand & Shop Identity (TASK-3A-05: 1 user = 1 shop model) */}
      <div className="flex items-center justify-start">
        <div className="flex h-9 items-center gap-2.5 rounded-lg px-2 text-left">
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
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
              <span className="truncate font-normal">Trực tuyến</span>
            </div>
          </div>
        </div>
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
                <span className="text-xs">{isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
