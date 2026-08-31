'use client';

import * as React from 'react';
import Link from 'next/link';
import { Lock, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useSettingsRbac } from './hooks/use-settings-rbac';

interface SettingsGuardProps {
  workspaceSlug: string;
  segment: string;
  children: React.ReactNode;
}

export function SettingsGuard({ workspaceSlug, segment, children }: SettingsGuardProps) {
  const { isLoading, canAccess, defaultRoute, currentRole } = useSettingsRbac(workspaceSlug);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6 max-w-4xl">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!canAccess(segment)) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
          <Lock className="size-6" />
        </div>
        <h3 className="text-lg font-semibold tracking-tight text-foreground">Access Restricted</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Your role{' '}
          {currentRole ? (
            <span className="font-semibold uppercase text-foreground">({currentRole})</span>
          ) : (
            ''
          )}{' '}
          does not have permission to view or manage this settings section.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button variant="default" size="sm" asChild>
            <Link href={defaultRoute}>Go to Permitted Settings</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/${workspaceSlug}/conversations`}>
              <ArrowLeft className="size-3.5" data-icon="inline-start" />
              Back to Conversations
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
