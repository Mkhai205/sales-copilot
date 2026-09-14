'use client';

import * as React from 'react';
import Image from 'next/image';
import { ChannelType } from '@sales-copilot/shared-contracts';
import { getChannelMeta } from '@/lib/channels';
import { cn } from '@/lib/utils';

export interface InboxAvatarProps {
  avatarUrl?: string | null;
  channelType?: ChannelType | string | null;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showChannelBadge?: boolean;
  className?: string;
}

const SIZE_MAP = {
  sm: {
    container: 'size-8 rounded-lg',
    iconSize: 18,
    badgeContainer: 'size-3.5 -bottom-0.5 -right-0.5 p-0.5',
    badgeIconSize: 10,
    rounded: 'rounded-lg',
  },
  md: {
    container: 'size-10 rounded-xl',
    iconSize: 24,
    badgeContainer: 'size-4.5 -bottom-1 -right-1 p-0.5',
    badgeIconSize: 12,
    rounded: 'rounded-xl',
  },
  lg: {
    container: 'size-12 rounded-xl',
    iconSize: 28,
    badgeContainer: 'size-5 -bottom-1 -right-1 p-0.5',
    badgeIconSize: 14,
    rounded: 'rounded-xl',
  },
  xl: {
    container: 'size-16 rounded-2xl',
    iconSize: 36,
    badgeContainer: 'size-6 -bottom-1.5 -right-1.5 p-1',
    badgeIconSize: 16,
    rounded: 'rounded-2xl',
  },
};

export function InboxAvatar({
  avatarUrl,
  channelType,
  name = 'Inbox',
  size = 'md',
  showChannelBadge = true,
  className,
}: InboxAvatarProps) {
  const [imageError, setImageError] = React.useState(false);
  const meta = getChannelMeta(channelType);
  const config = SIZE_MAP[size] || SIZE_MAP.md;

  // Reset image error state whenever avatarUrl changes
  React.useEffect(() => {
    setImageError(false);
  }, [avatarUrl]);

  const hasValidAvatar = Boolean(avatarUrl && avatarUrl.trim() && !imageError);

  return (
    <div
      className={cn(
        'relative shrink-0 flex items-center justify-center border border-border/80 bg-muted/40 shadow-2xs select-none',
        config.container,
        className,
      )}
    >
      {hasValidAvatar ? (
        <Image
          src={avatarUrl!.trim()}
          alt={name}
          fill
          unoptimized
          sizes="64px"
          onError={() => setImageError(true)}
          className={cn('size-full object-cover', config.rounded)}
        />
      ) : (
        <div className="flex size-full items-center justify-center p-2">
          <Image
            src={meta.iconSrc}
            alt={meta.label}
            width={config.iconSize}
            height={config.iconSize}
            unoptimized
            style={{ width: `${config.iconSize}px`, height: `${config.iconSize}px` }}
            className="object-contain"
          />
        </div>
      )}

      {/* Mini Channel Badge Overlay in Bottom-Right Corner (Meta Business Suite Style) */}
      {hasValidAvatar && showChannelBadge && (
        <div
          title={meta.label}
          className={cn(
            'absolute z-10 flex items-center justify-center rounded-full bg-background shadow-xs',
            config.badgeContainer,
          )}
        >
          <Image
            src={meta.iconSrc}
            alt={meta.label}
            width={config.badgeIconSize}
            height={config.badgeIconSize}
            unoptimized
            className="object-contain"
          />
        </div>
      )}
    </div>
  );
}
