'use client';

import * as React from 'react';
import { PresenceStatus } from '@sales-copilot/shared-contracts';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUserPresence } from '@/lib/socket/use-presence';
import { cn } from '@/lib/utils';

export interface PresenceIndicatorProps extends React.ComponentProps<'span'> {
  userId?: string | null;
  status?: PresenceStatus | 'ONLINE' | 'OFFLINE' | 'AWAY';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  placement?: 'bottom-right' | 'top-right' | 'inline';
  showTooltip?: boolean;
  showLabel?: boolean;
  pulse?: boolean;
  workspaceSlug?: string;
  workspaceId?: string;
}

const sizeClasses = {
  xs: 'size-1.5',
  sm: 'size-2',
  md: 'size-2.5',
  lg: 'size-3',
};

const placementClasses = {
  'bottom-right': 'absolute bottom-0 right-0 z-10 ring-2 ring-background rounded-full',
  'top-right': 'absolute top-0 right-0 z-10 ring-2 ring-background rounded-full',
  inline: 'inline-flex shrink-0 rounded-full',
};

export function PresenceIndicator({
  userId,
  status: explicitStatus,
  size = 'sm',
  placement = 'inline',
  showTooltip = false,
  showLabel = false,
  pulse = false,
  workspaceSlug,
  workspaceId,
  className,
  ...props
}: PresenceIndicatorProps) {
  // If userId is passed and explicitStatus is omitted, query real-time presence
  const userPresence = useUserPresence(explicitStatus ? undefined : userId, {
    workspaceSlug,
    workspaceId,
  });

  const effectiveStatus: PresenceStatus =
    (explicitStatus as PresenceStatus) || userPresence.status || PresenceStatus.OFFLINE;

  const isOnline = effectiveStatus === PresenceStatus.ONLINE;
  const isAway = effectiveStatus === PresenceStatus.AWAY;

  const colorClass = isOnline
    ? 'bg-emerald-500'
    : isAway
      ? 'bg-amber-500'
      : 'bg-muted-foreground/30';

  const labelText = isOnline ? 'Online' : isAway ? 'Away' : 'Offline';

  const dot = (
    <span
      data-slot="presence-indicator"
      data-status={effectiveStatus}
      className={cn(
        'relative flex items-center justify-center select-none',
        placementClasses[placement],
        className,
      )}
      {...props}
    >
      {/* Pulse animation for online state */}
      {pulse && isOnline && (
        <span
          className={cn(
            'absolute inset-0 rounded-full animate-ping bg-emerald-400 opacity-75',
            sizeClasses[size],
          )}
        />
      )}
      <span
        className={cn('rounded-full transition-colors duration-200', sizeClasses[size], colorClass)}
      />
    </span>
  );

  const content = showLabel ? (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      {dot}
      <span>{labelText}</span>
    </span>
  ) : (
    dot
  );

  if (showTooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="top" className="text-xs py-1 px-2">
          <span>{labelText}</span>
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}
