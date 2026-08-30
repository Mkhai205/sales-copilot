'use client';

import * as React from 'react';
import { Send, MessageCircle, Mail, Globe, MessageSquare, Link2 } from 'lucide-react';
import { ChannelType, type ChannelIdentityDto } from '@/lib/api/types';
import { useContactIdentities } from './hooks/use-detail-metadata';

interface ContactIdentitiesProps {
  contactId?: string | null;
  workspaceSlug?: string;
  initialIdentities?: ChannelIdentityDto[];
}

function getChannelIcon(channelType?: ChannelType) {
  switch (channelType) {
    case ChannelType.TELEGRAM:
      return {
        icon: Send,
        label: 'Telegram',
        color: 'text-sky-500 bg-sky-500/10 border-sky-500/20',
      };
    case ChannelType.FACEBOOK_MESSENGER:
      return {
        icon: MessageCircle,
        label: 'Messenger',
        color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
      };
    case ChannelType.EMAIL:
      return {
        icon: Mail,
        label: 'Email',
        color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
      };
    case ChannelType.WEB_CHAT:
      return {
        icon: Globe,
        label: 'Live Chat',
        color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
      };
    case ChannelType.ZALO:
      return {
        icon: MessageSquare,
        label: 'Zalo',
        color: 'text-blue-600 bg-blue-600/10 border-blue-600/20',
      };
    default:
      return {
        icon: Link2,
        label: 'Channel',
        color: 'text-muted-foreground bg-muted border-border',
      };
  }
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

  const identities = initialIdentities?.length ? initialIdentities : fetchedIdentities;

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
        {identities.map(identity => {
          const { icon: ChannelIcon, label, color } = getChannelIcon(identity.channelType);
          const displayHandle = identity.username
            ? `@${identity.username}`
            : identity.externalContactId;

          return (
            <div
              key={identity.id || `${identity.channelId}-${identity.externalContactId}`}
              className="flex items-center justify-between gap-2 p-2 rounded-md border border-border/50 bg-card/40 hover:bg-card/70 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`size-6 rounded-md flex items-center justify-center border shrink-0 ${color}`}
                >
                  <ChannelIcon className="size-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground text-xs">{label}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{displayHandle}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
