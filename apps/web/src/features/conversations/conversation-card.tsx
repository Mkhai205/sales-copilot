'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Lock } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { type ConversationResponseDto, ConversationPriority, Priority } from '@/lib/api/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getChannelMeta } from '@/lib/channels';

interface ConversationCardProps {
  conversation: ConversationResponseDto;
  workspaceSlug: string;
  isSelected?: boolean;
}

function getInitials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return formatDistanceToNowStrict(date, { addSuffix: false });
  } catch {
    return '';
  }
}

function getPriorityBadge(priority?: ConversationPriority | Priority | null) {
  if (!priority || priority === Priority.LOW || priority === Priority.MEDIUM) return null;

  if (priority === Priority.URGENT) {
    return (
      <Badge
        variant="outline"
        className="text-[9px] py-0 px-1 font-medium text-rose-500 border-rose-500/30 bg-rose-500/10"
      >
        Urgent
      </Badge>
    );
  }

  if (priority === Priority.HIGH) {
    return (
      <Badge
        variant="outline"
        className="text-[9px] py-0 px-1 font-medium text-amber-500 border-amber-500/30 bg-amber-500/10"
      >
        High
      </Badge>
    );
  }

  return null;
}

export function ConversationCard({
  conversation,
  workspaceSlug,
  isSelected,
}: ConversationCardProps) {
  const contactName = conversation.contact?.name || 'Anonymous Visitor';
  const lastMessageText = conversation.lastMessage?.content || 'No messages yet';
  const time = formatTime(conversation.lastActivityAt || conversation.createdAt);
  const unreadCount = conversation.unreadMessagesCount || 0;
  const channelName = conversation.inbox?.name || 'Inbox';
  const channelMeta = getChannelMeta(conversation.inbox?.channelType);
  const isPrivateNote = conversation.lastMessage?.isPrivate;

  return (
    <Link
      href={`/${workspaceSlug}/conversations/${conversation.id}`}
      className={cn(
        'group flex min-w-0 items-start gap-3 overflow-hidden p-3.5 transition-colors hover:bg-muted/40 text-left cursor-pointer relative border-b border-border/40',
        isSelected && 'bg-accent/10 hover:bg-accent/15 border-l-2 border-l-primary',
      )}
    >
      {/* Left: Contact Avatar aligned with contact name */}
      <div className="relative shrink-0 mt-5">
        <Avatar className="size-9 shrink-0 ring-1 ring-border/50">
          <AvatarImage
            src={conversation.contact?.avatarUrl || '/avatar-contact-default.svg'}
            alt={contactName}
          />
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
            {getInitials(contactName)}
          </AvatarFallback>
        </Avatar>
      </div>

      {/* Right: Channel info, Contact info, snippet, tags */}
      <div className="flex flex-1 flex-col gap-1 min-w-0">
        {/* Row 1: Channel info (above contact name) */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0 text-[11px] leading-4 text-muted-foreground">
            <Image
              src={channelMeta.iconSrc}
              alt={channelMeta.label}
              width={14}
              height={14}
              unoptimized
              className="size-3.5 object-contain shrink-0"
            />
            <span className="truncate font-medium">{channelName}</span>
          </div>
        </div>

        {/* Row 2: Contact info & timestamp */}
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              'truncate text-xs text-foreground',
              unreadCount > 0 ? 'font-semibold' : 'font-medium',
            )}
          >
            {contactName}
          </span>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] text-muted-foreground">{time}</span>
            {unreadCount > 0 && (
              <Badge
                variant="default"
                className="size-4 p-0 flex items-center justify-center rounded-full text-[9px] font-bold"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </div>
        </div>

        {/* Row 3: Message snippet preview */}
        <p
          className={cn(
            'truncate text-xs text-muted-foreground/90 flex items-center gap-1.5',
            unreadCount > 0 && 'text-foreground/90 font-medium',
          )}
        >
          {isPrivateNote && <Lock className="size-3 text-muted-foreground shrink-0" />}
          <span className="truncate">{lastMessageText}</span>
        </p>

        {/* Row 4: Footer tags: Priority, Labels */}
        {(Boolean(getPriorityBadge(conversation.priority)) ||
          Boolean(conversation.labels && conversation.labels.length > 0)) && (
          <div className="flex min-w-0 items-center gap-1.5 pt-0.5 flex-wrap">
            {getPriorityBadge(conversation.priority)}

            {conversation.labels?.slice(0, 2).map(label => (
              <Badge
                key={label.id}
                variant="secondary"
                className="text-[9px] py-0 px-1 font-normal"
              >
                {label.title}
              </Badge>
            ))}

            {conversation.labels && conversation.labels.length > 2 && (
              <span className="text-[9px] text-muted-foreground">
                +{conversation.labels.length - 2}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
