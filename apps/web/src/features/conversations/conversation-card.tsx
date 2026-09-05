'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { CornerUpLeft, Lock } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import {
  type ConversationResponseDto,
  ConversationPriority,
  Priority,
  SenderType,
} from '@/lib/api/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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

function renderPriorityIndicator(priority?: ConversationPriority | Priority | null) {
  if (!priority) return null;

  if (priority === Priority.URGENT) {
    return (
      <span
        className="text-rose-600 dark:text-rose-500 font-bold text-xs tracking-tighter cursor-default"
        title="Urgent Priority"
      >
        !!!
      </span>
    );
  }

  if (priority === Priority.HIGH) {
    return (
      <span
        className="text-amber-600 dark:text-amber-500 font-bold text-xs tracking-tighter cursor-default"
        title="High Priority"
      >
        !!
      </span>
    );
  }

  if (priority === Priority.MEDIUM) {
    return (
      <span
        className="text-muted-foreground/70 font-semibold text-xs tracking-tighter cursor-default"
        title="Medium Priority"
      >
        !
      </span>
    );
  }

  if (priority === Priority.LOW) {
    return (
      <span
        className="text-muted-foreground/40 font-normal text-xs tracking-tighter cursor-default"
        title="Low Priority"
      >
        !
      </span>
    );
  }

  return null;
}

import { useI18n, formatRelativeTime } from '@/lib/i18n';

export function ConversationCard({
  conversation,
  workspaceSlug,
  isSelected,
}: ConversationCardProps) {
  const { locale, t } = useI18n();
  const contactName = conversation.contact?.name || 'Anonymous Visitor';
  const lastMessageText = conversation.lastMessage?.content || '';
  const time = formatRelativeTime(conversation.lastActivityAt || conversation.createdAt, locale);
  const unreadCount = conversation.unreadMessagesCount || 0;
  const channelName = conversation.inbox?.name || 'Inbox';
  const channelMeta = getChannelMeta(conversation.inbox?.channelType);
  const isPrivateNote = conversation.lastMessage?.isPrivate;
  const isAgentReply = conversation.lastMessage?.senderType === SenderType.USER;

  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const targetHref = `/${workspaceSlug}/conversations/${conversation.id}${
    queryString ? `?${queryString}` : ''
  }`;

  return (
    <Link
      href={targetHref}
      scroll={false}
      className={cn(
        'group flex min-w-0 items-start gap-3 p-3 transition-colors hover:bg-muted/40 text-left cursor-pointer relative border-b border-border/40',
        isSelected &&
          'bg-primary/8 dark:bg-primary/12 border-l-[3.5px] border-l-primary hover:bg-primary/10',
      )}
    >
      {/* Left: Contact Avatar with Channel Badge Overlay */}
      <div className="relative shrink-0 mt-0.5">
        <Avatar className="size-10 shrink-0 ring-1 ring-border/50">
          <AvatarImage
            src={conversation.contact?.avatarUrl || '/avatar-contact-default.svg'}
            alt={contactName}
          />
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
            {getInitials(contactName)}
          </AvatarFallback>
        </Avatar>

        {/* Channel Icon Badge Overlay at Bottom-Right */}
        <div className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full bg-background ring-2 ring-background flex items-center justify-center shadow-xs overflow-hidden">
          <Image
            src={channelMeta.iconSrc}
            alt={channelMeta.label}
            width={14}
            height={14}
            unoptimized
            className="size-3 object-contain"
          />
        </div>
      </div>

      {/* Right: Structured 4-Row Information Architecture */}
      <div className="flex flex-1 flex-col gap-1 min-w-0">
        {/* Row 1: Channel icon + Inbox Name (left) & Priority + Time (right) */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0 text-[11px] leading-4 text-muted-foreground">
            <Image
              src={channelMeta.iconSrc}
              alt={channelMeta.label}
              width={13}
              height={13}
              unoptimized
              className="size-3 object-contain shrink-0"
            />
            <span className="truncate font-medium">{channelName}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {renderPriorityIndicator(conversation.priority)}
            <span className="text-[10px] text-muted-foreground tabular-nums">{time}</span>
          </div>
        </div>

        {/* Row 2: Contact Name */}
        <div className="min-w-0">
          <h3
            className={cn(
              'truncate text-sm leading-snug',
              unreadCount > 0 ? 'font-semibold text-foreground' : 'font-medium text-foreground/90',
            )}
          >
            {contactName}
          </h3>
        </div>

        {/* Row 3: Last message snippet preview with Private/Reply indicator + Unread badge */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <p
            className={cn(
              'truncate text-xs flex items-center gap-1.5 flex-1 min-w-0 leading-normal',
              unreadCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground',
            )}
          >
            {isPrivateNote && <Lock className="size-3 text-amber-500 shrink-0" />}
            {!isPrivateNote && isAgentReply && (
              <CornerUpLeft className="size-3 text-muted-foreground shrink-0" />
            )}
            <span className="truncate">{lastMessageText}</span>
          </p>

          {unreadCount > 0 && (
            <span className="size-4.5 min-w-4.5 px-1 bg-emerald-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 shadow-xs">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>

        {/* Row 4: Labels with Square Color Chips & Expand/Overflow */}
        {conversation.labels && conversation.labels.length > 0 && (
          <div className="flex items-center gap-1.5 pt-0.5 flex-wrap min-w-0">
            {conversation.labels.slice(0, 3).map(label => (
              <span
                key={label.id}
                className="inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[10px] font-medium bg-muted/60 border border-border/40 text-foreground/90 max-w-[120px] truncate"
              >
                <span
                  className="size-1.5 rounded-[2px] shrink-0"
                  style={{ backgroundColor: label.color || '#64748b' }}
                />
                <span className="truncate">{label.title}</span>
              </span>
            ))}

            {conversation.labels.length > 3 && (
              <span className="text-[10px] text-muted-foreground font-medium px-0.5">
                +{conversation.labels.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
