'use client';

import * as React from 'react';
import Link from 'next/link';
import { formatDistanceToNowStrict } from 'date-fns';
import { type ConversationResponseDto, ConversationPriority, Priority } from '@/lib/api/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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

  return (
    <Link
      href={`/${workspaceSlug}/conversations/${conversation.id}`}
      className={cn(
        'group flex min-w-0 flex-col gap-1.5 overflow-hidden p-3.5 transition-colors hover:bg-muted/40 text-left cursor-pointer relative border-b border-border/40',
        isSelected && 'bg-accent/10 hover:bg-accent/15 border-l-2 border-l-primary',
      )}
    >
      {/* Header row: Contact info & timestamp */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar className="size-7 shrink-0">
            {conversation.contact?.avatarUrl && (
              <AvatarImage src={conversation.contact.avatarUrl} alt={contactName} />
            )}
            <AvatarFallback className="bg-primary/10 text-primary text-[11px] font-semibold">
              {getInitials(contactName)}
            </AvatarFallback>
          </Avatar>
          <span
            className={cn(
              'truncate text-xs text-foreground',
              unreadCount > 0 ? 'font-semibold' : 'font-medium',
            )}
          >
            {contactName}
          </span>
        </div>

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

      {/* Message snippet preview */}
      <p
        className={cn(
          'truncate text-xs text-muted-foreground/90 pl-9',
          unreadCount > 0 && 'text-foreground/90 font-medium',
        )}
      >
        {lastMessageText}
      </p>

      {/* Footer tags: Channel, Priority, Labels */}
      <div className="flex min-w-0 items-center gap-1.5 pl-9 pt-0.5 flex-wrap">
        <Badge
          variant="outline"
          className="text-[9px] py-0 px-1 font-normal text-muted-foreground border-border/60"
        >
          {channelName}
        </Badge>

        {getPriorityBadge(conversation.priority)}

        {conversation.labels?.slice(0, 2).map(label => (
          <Badge key={label.id} variant="secondary" className="text-[9px] py-0 px-1 font-normal">
            {label.title}
          </Badge>
        ))}

        {conversation.labels && conversation.labels.length > 2 && (
          <span className="text-[9px] text-muted-foreground">
            +{conversation.labels.length - 2}
          </span>
        )}
      </div>
    </Link>
  );
}
