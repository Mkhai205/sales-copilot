'use client';

import * as React from 'react';
import Image from 'next/image';
import { Link2 } from 'lucide-react';
import { type ChannelIdentityDto } from '@/lib/api/types';
import { getChannelMeta } from '@/lib/channels';
import { useContactIdentities } from './hooks/use-detail-metadata';

interface ContactIdentitiesProps {
  contactId?: string | null;
  workspaceSlug?: string;
  initialIdentities?: ChannelIdentityDto[];
}

export function ContactIdentities({
  contactId,
  workspaceSlug,
  initialIdentities,
}: ContactIdentitiesProps) {
  const { identities: fetchedIdentities } = useContactIdentities(contactId, {
    workspaceSlug,
    enabled: Boolean(contactId),
  });

  const identities: ChannelIdentityDto[] | undefined = initialIdentities?.length
    ? initialIdentities
    : fetchedIdentities;

  if (!identities || identities.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h5 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Connected Channels
        </h5>
        <div className="flex items-center gap-2 text-xs text-muted-foreground/70 py-1">
          <Link2 className="size-3.5 text-muted-foreground/40 shrink-0" />
          <span className="italic">No linked channel identities</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <h5 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Connected Channels ({identities.length})
      </h5>

      <div className="flex flex-col gap-1.5 text-xs">
        {identities.map((identity: ChannelIdentityDto) => {
          const meta = getChannelMeta(identity.channelType);
          const displayHandle = identity.username
            ? `@${identity.username}`
            : identity.externalContactId;

          return (
            <div
              key={identity.id || `${identity.channelId}-${identity.externalContactId}`}
              className="flex items-center justify-between gap-2 p-2 rounded-md border border-border/50 bg-card/40 hover:bg-card/70 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-8 rounded-lg flex items-center justify-center border border-border/60 bg-muted/40 p-1.5 shrink-0">
                  <Image
                    src={meta.iconSrc}
                    alt={meta.label}
                    width={20}
                    height={20}
                    unoptimized
                    className="size-5 object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground text-xs">{meta.label}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{displayHandle}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
