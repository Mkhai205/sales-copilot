'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShieldCheck,
  Sliders,
  Building2,
  ScrollText,
  LayoutDashboard,
  ArrowLeft,
  Sun,
  Moon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Tổng quan', href: '/admin', icon: LayoutDashboard },
  { label: 'Cấu hình hệ thống', href: '/admin/settings', icon: Sliders },
  { label: 'Quản trị Workspaces', href: '/admin/workspaces', icon: Building2 },
  { label: 'Nhật ký kiểm toán', href: '/admin/audit-logs', icon: ScrollText },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background text-foreground">
      {/* Top Super Admin Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="size-5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold tracking-tight text-foreground">Sales Copilot</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm font-medium text-muted-foreground">Platform Admin</span>
          </div>
          <Badge
            variant="outline"
            className="ml-2 border-primary/30 bg-primary/5 text-primary text-xs font-semibold"
          >
            Super Administrator
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="size-8 text-muted-foreground hover:text-foreground"
            title="Chuyển đổi giao diện sáng/tối"
          >
            <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'sm' }),
              'gap-2 text-xs text-muted-foreground hover:text-foreground',
            )}
          >
            <ArrowLeft className="size-3.5" />
            <span>Quay lại Workspace</span>
          </Link>
        </div>
      </header>

      {/* Sub-navigation bar */}
      <nav className="flex shrink-0 items-center gap-1 border-b border-border bg-card/60 px-6 backdrop-blur-sm">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive =
            item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-medium transition-colors',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
              )}
            >
              <Icon className="size-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
