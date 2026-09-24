import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type SettingsSkeletonVariant = 'form' | 'table' | 'cards' | 'detail';

export interface SettingsPageSkeletonProps {
  variant?: SettingsSkeletonVariant;
  className?: string;
}

export function SettingsPageSkeleton({ variant = 'form', className }: SettingsPageSkeletonProps) {
  switch (variant) {
    case 'table':
      return <SettingsTableSkeleton className={className} />;
    case 'cards':
      return <SettingsCardsSkeleton className={className} />;
    case 'detail':
      return <SettingsDetailSkeleton className={className} />;
    case 'form':
    default:
      return <SettingsFormSkeleton className={className} />;
  }
}

/**
 * Skeleton for form-based settings pages (General, Bank & Payment, etc.)
 */
export function SettingsFormSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-6 w-full animate-in fade-in-50 duration-200', className)}>
      {/* Primary Configuration Card Skeleton */}
      <Card className="border-border bg-card/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Skeleton className="size-4 rounded-md" />
            <Skeleton className="h-4 w-44 rounded-md" />
          </div>
          <Skeleton className="h-3 w-80 rounded-md mt-1" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3.5 w-28 rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-3 w-48 rounded-md" />
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3.5 w-24 rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-3 w-40 rounded-md" />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <Skeleton className="h-3.5 w-32 rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-3 w-56 rounded-md" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Secondary Card Skeleton (Integration / Additional settings) */}
      <Card className="border-border bg-card/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Skeleton className="size-4 rounded-md" />
            <Skeleton className="h-4 w-40 rounded-md" />
          </div>
          <Skeleton className="h-3 w-64 rounded-md mt-1" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3.5">
              <Skeleton className="size-7 rounded-full shrink-0" />
              <div className="flex flex-col gap-2 flex-1">
                <Skeleton className="h-3.5 w-44 rounded-md" />
                <Skeleton className="h-3 w-3/4 rounded-md" />
                <Skeleton className="h-8 w-36 rounded-md" />
              </div>
            </div>
            <div className="h-px bg-border/40 w-full" />
            <div className="flex items-start gap-3.5">
              <Skeleton className="size-7 rounded-full shrink-0" />
              <div className="flex flex-col gap-2 flex-1">
                <Skeleton className="h-3.5 w-52 rounded-md" />
                <Skeleton className="h-3 w-4/5 rounded-md" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Skeleton for table-based settings pages (Members, Labels, Canned Responses, Knowledge)
 */
export function SettingsTableSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-4 w-full animate-in fade-in-50 duration-200', className)}>
      {/* Toolbar Skeleton */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Skeleton className="h-9 w-full sm:w-64 rounded-md" />
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
        {/* Thead */}
        <div className="flex items-center justify-between gap-4 border-b border-border/80 px-4 py-3 bg-muted/40">
          <Skeleton className="h-3.5 w-32 rounded-md" />
          <Skeleton className="h-3.5 w-24 rounded-md" />
          <Skeleton className="h-3.5 w-20 rounded-md" />
          <Skeleton className="h-3.5 w-16 rounded-md" />
        </div>

        {/* Rows */}
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center justify-between gap-4 px-4 py-3.5 border-b border-border/40 last:border-b-0"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-36 rounded-md" />
                <Skeleton className="h-2.5 w-24 rounded-md" />
              </div>
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-3.5 w-24 rounded-md hidden sm:block" />
            <div className="flex items-center gap-1">
              <Skeleton className="size-7 rounded-md" />
              <Skeleton className="size-7 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton for cards-based settings pages (Teams, Inboxes list)
 */
export function SettingsCardsSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-4 w-full animate-in fade-in-50 duration-200', className)}>
      {/* Toolbar Skeleton */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Skeleton className="h-9 w-full sm:w-64 rounded-md" />
        <Skeleton className="h-9 w-32 rounded-md self-end sm:self-auto" />
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card
            key={index}
            className="border-border bg-card/40 p-4 flex flex-col justify-between h-44"
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="size-8 rounded-lg" />
                  <div className="flex flex-col gap-1">
                    <Skeleton className="h-3.5 w-28 rounded-md" />
                    <Skeleton className="h-2.5 w-16 rounded-md" />
                  </div>
                </div>
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              <Skeleton className="h-3 w-full rounded-md mt-2" />
              <Skeleton className="h-3 w-4/5 rounded-md" />
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-border/40">
              <div className="flex -space-x-1.5">
                <Skeleton className="size-6 rounded-full border-2 border-background" />
                <Skeleton className="size-6 rounded-full border-2 border-background" />
                <Skeleton className="size-6 rounded-full border-2 border-background" />
              </div>
              <Skeleton className="h-7 w-16 rounded-md" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton for detail pages (Inbox Detail, etc.)
 */
export function SettingsDetailSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-6 w-full animate-in fade-in-50 duration-200', className)}>
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-xl" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-5 w-44 rounded-md" />
            <Skeleton className="h-3 w-28 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>

      {/* Tabs List */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <Skeleton className="h-8 w-24 rounded-md" />
        <Skeleton className="h-8 w-24 rounded-md" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>

      {/* Content Card */}
      <Card className="border-border bg-card/50">
        <CardHeader className="pb-4">
          <Skeleton className="h-4 w-36 rounded-md" />
          <Skeleton className="h-3 w-64 rounded-md mt-1" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3.5 w-24 rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3.5 w-24 rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
