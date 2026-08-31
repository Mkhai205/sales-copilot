'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, ShieldCheck, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSettingsRbac } from './hooks/use-settings-rbac';

interface SettingsNavProps {
  workspaceSlug: string;
}

export function SettingsNav({ workspaceSlug }: SettingsNavProps) {
  const pathname = usePathname();
  const { currentRole, isAdmin, isLoading, groupedNavItems } = useSettingsRbac(workspaceSlug);

  return (
    <div className="flex h-full w-full flex-col bg-card/40 backdrop-blur-xs">
      {/* Top Header / Back Button */}
      <div className="flex flex-col gap-3 p-4 pb-3">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="w-fit gap-2 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <Link href={`/${workspaceSlug}/conversations`}>
            <ArrowLeft className="size-3.5" data-icon="inline-start" />
            <span>Back to Conversations</span>
          </Link>
        </Button>

        <div className="flex items-center justify-between gap-2 px-1">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-foreground">Settings</h2>
            <p className="text-xs text-muted-foreground">Manage workspace & workflows</p>
          </div>
          {currentRole && (
            <Badge
              variant={isAdmin ? 'default' : 'secondary'}
              className="gap-1 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider"
            >
              {isAdmin ? (
                <ShieldCheck className="size-3 text-primary-foreground/90" />
              ) : (
                <Shield className="size-3 text-muted-foreground" />
              )}
              {currentRole}
            </Badge>
          )}
        </div>
      </div>

      <Separator />

      {/* Nav List */}
      <ScrollArea className="flex-1 px-3 py-3">
        {isLoading ? (
          <div className="flex flex-col gap-4 p-1">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-12 w-full rounded-md" />
              <Skeleton className="h-12 w-full rounded-md" />
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-12 w-full rounded-md" />
              <Skeleton className="h-12 w-full rounded-md" />
            </div>
          </div>
        ) : (
          <nav aria-label="Settings navigation" className="flex flex-col gap-5 pb-6">
            {groupedNavItems.map(group => (
              <div key={group.id} className="flex flex-col gap-1.5">
                <span className="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {group.label}
                </span>

                <div className="flex flex-col gap-1">
                  {group.items.map(item => {
                    const itemUrl = `/${workspaceSlug}/settings/${item.segment}`;
                    const isActive = pathname === itemUrl || pathname.startsWith(`${itemUrl}/`);
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.id}
                        href={itemUrl}
                        aria-current={isActive ? 'page' : undefined}
                        data-active={isActive}
                        className={`group relative flex items-start gap-3 rounded-lg px-2.5 py-2 transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          isActive
                            ? 'bg-accent/15 text-foreground shadow-2xs dark:bg-accent/25'
                            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                        }`}
                      >
                        {/* Active Accent Bar */}
                        {isActive && (
                          <span className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-primary" />
                        )}

                        <div
                          className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors ${
                            isActive
                              ? 'border-primary/30 bg-primary/10 text-primary'
                              : 'border-border/60 bg-background/50 text-muted-foreground group-hover:border-border group-hover:text-foreground'
                          }`}
                        >
                          <Icon className="size-3.5" />
                        </div>

                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex items-center justify-between gap-1.5">
                            <span
                              className={`truncate text-xs font-medium ${
                                isActive ? 'font-semibold text-foreground' : 'text-foreground/90'
                              }`}
                            >
                              {item.title}
                            </span>
                            {item.adminOnly && !isAdmin && (
                              <Badge
                                variant="outline"
                                className="h-4 px-1 text-[9px] text-muted-foreground"
                              >
                                Admin
                              </Badge>
                            )}
                          </div>
                          <span className="line-clamp-1 text-[11px] text-muted-foreground/80">
                            {item.description}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        )}
      </ScrollArea>
    </div>
  );
}
