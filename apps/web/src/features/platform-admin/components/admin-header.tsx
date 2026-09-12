'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sun, Moon, ArrowLeft, Shield } from 'lucide-react';
import { useTheme } from 'next-themes';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { getAdminBreadcrumbs } from './navigation-helpers';
import { cn } from '@/lib/utils';

export function AdminHeader() {
  const pathname = usePathname();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const breadcrumbs = getAdminBreadcrumbs(pathname);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-4 transition-[width,height] ease-linear">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={`${crumb.label}-${idx}`}>
                  {idx > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link href={crumb.href || '#'}>{crumb.label}</Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex items-center gap-2.5">
        <Badge
          variant="outline"
          className="hidden sm:inline-flex items-center gap-1.5 border-primary/30 bg-primary/5 text-primary text-xs font-semibold py-1 px-2.5"
        >
          <Shield className="size-3.5" />
          <span>Super Administrator</span>
        </Badge>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme((resolvedTheme || theme) === 'dark' ? 'light' : 'dark')}
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
            'gap-1.5 text-xs text-muted-foreground hover:text-foreground hidden sm:inline-flex',
          )}
        >
          <ArrowLeft className="size-3.5" />
          <span>Quay lại Workspace</span>
        </Link>
      </div>
    </header>
  );
}
