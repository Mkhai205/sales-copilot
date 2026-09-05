'use client';

import * as React from 'react';
import { ChevronsUpDown, LogOut, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useCurrentUser, logoutAction } from '@/features/auth';

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
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { LanguageSwitcherSubMenu } from '@/components/language-switcher';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/lib/i18n';

export function NavUser() {
  const { isMobile } = useSidebar();
  const { data: user, isLoading } = useCurrentUser();
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  const [isLoggingOut, startTransition] = React.useTransition();

  const handleLogout = () => {
    startTransition(async () => {
      await logoutAction();
    });
  };

  if (isLoading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem className="flex items-center gap-2 p-2">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="grid flex-1 gap-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-2.5 w-28" />
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  const displayName = user?.name || 'Agent User';
  const displayEmail = user?.email || 'agent@salescopilot.io';
  const displayInitials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="relative shrink-0">
                <Avatar className="h-8 w-8 rounded-lg border border-sidebar-border">
                  <AvatarImage src={user?.avatarUrl || ''} alt={displayName} />
                  <AvatarFallback className="rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-semibold text-xs">
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
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{displayName}</span>
                <span className="truncate text-xs text-muted-foreground">{displayEmail}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 opacity-50" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-2 py-1.5 text-left text-sm">
                <div className="relative shrink-0">
                  <Avatar className="h-8 w-8 rounded-lg border">
                    <AvatarImage src={user?.avatarUrl || ''} alt={displayName} />
                    <AvatarFallback className="rounded-lg font-semibold text-xs">
                      {displayInitials}
                    </AvatarFallback>
                  </Avatar>
                  <PresenceIndicator userId={user?.id} placement="bottom-right" size="xs" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{displayName}</span>
                  <span className="truncate text-xs text-muted-foreground">{displayEmail}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <LanguageSwitcherSubMenu />
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
                <span>
                  {t('common.toggleTheme', {
                    mode: theme === 'dark' ? t('common.lightMode') : t('common.darkMode'),
                  })}
                </span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-destructive focus:text-destructive cursor-pointer"
              disabled={isLoggingOut}
              onClick={handleLogout}
              variant="destructive"
            >
              <LogOut className="size-4" />
              <span>{isLoggingOut ? t('common.loggingOut') : t('common.logout')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
