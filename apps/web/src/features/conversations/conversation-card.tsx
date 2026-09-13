'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { CornerUpLeft, Lock, Flame, Flag, UserX, ImageIcon } from 'lucide-react';
import { type ConversationResponseDto, Priority, SenderType } from '@/lib/api/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { getChannelMeta } from '@/lib/channels';
import { useI18n, formatRelativeTime } from '@/lib/i18n';

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

function getShortName(fullName?: string | null): string {
  if (!fullName) return '';
  const trimmed = fullName.trim();
  const parts = trimmed.split(/\s+/);
  return parts[parts.length - 1] || trimmed;
}

function getLabelBadgeStyle(color?: string) {
  const baseColor = color || '#64748b';
  const isHex = /^#[0-9a-fA-F]{6}$/.test(baseColor);
  return {
    backgroundColor: isHex ? `${baseColor}15` : 'rgba(100, 116, 139, 0.1)',
    borderColor: isHex ? `${baseColor}30` : 'rgba(100, 116, 139, 0.25)',
  };
}

function renderPriorityIndicator(priority?: Priority | null) {
  if (!priority) return null;

  if (priority === Priority.URGENT) {
    return (
      <span
        className="inline-flex items-center gap-0.5 text-rose-600 dark:text-rose-400 shrink-0"
        title="Độ ưu tiên: Khẩn cấp"
      >
        <Flame className="size-3 text-rose-500 fill-rose-500 animate-pulse" />
      </span>
    );
  }

  if (priority === Priority.HIGH) {
    return (
      <span
        className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400 shrink-0"
        title="Độ ưu tiên: Cao"
      >
        <Flag className="size-3 text-amber-500 fill-amber-500" />
      </span>
    );
  }

  return null;
}

export function ConversationCard({
  conversation,
  workspaceSlug,
  isSelected,
}: ConversationCardProps) {
  const { locale } = useI18n();
  const contactName = conversation.contact?.name || 'Khách vãng lai';
  const unreadCount = conversation.unreadMessagesCount || 0;
  const isUnread = unreadCount > 0;
  const time = formatRelativeTime(conversation.lastActivityAt || conversation.createdAt, locale);
  const channelName = conversation.inbox?.name || 'Hộp thư';
  const channelMeta = getChannelMeta(conversation.inbox?.channelType);
  const isPrivateNote = conversation.lastMessage?.isPrivate;
  const isAgentReply = conversation.lastMessage?.senderType === SenderType.USER;

  // Determine last message preview and media indicator
  const hasAttachments = Boolean(
    conversation.lastMessage?.attachments && conversation.lastMessage.attachments.length > 0,
  );
  let lastMessageText = conversation.lastMessage?.content?.trim() || '';
  if (!lastMessageText && hasAttachments) {
    const isImg = conversation.lastMessage?.attachments?.some(
      a => a.fileType === 'IMAGE' || a.contentType?.startsWith('image/'),
    );
    lastMessageText = isImg ? 'Hình ảnh' : 'Tệp đính kèm';
  } else if (!lastMessageText) {
    lastMessageText = 'Chưa có tin nhắn';
  }

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
      {/* Left: Clean Contact Avatar (No redundant badge) */}
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
      </div>

      {/* Right: Structured Information Architecture */}
      <div className="flex flex-1 flex-col gap-1 min-w-0">
        {/* Row 1: Contact Name (left) & Priority + Time (right) */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            {isUnread && (
              <span
                className="size-2 rounded-full bg-primary shrink-0 animate-pulse"
                title="Tin nhắn mới chưa đọc"
              />
            )}
            <h3
              className={cn(
                'truncate text-sm leading-snug',
                isUnread ? 'font-bold text-foreground' : 'font-medium text-foreground/90',
              )}
            >
              {contactName}
            </h3>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground">
            {renderPriorityIndicator(conversation.priority)}
            <span className="text-[11px] tabular-nums">{time}</span>
          </div>
        </div>

        {/* Row 2: Channel icon + Page name (left) & Assignee with short name (right) */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <Image
              src={channelMeta.iconSrc}
              alt={channelMeta.label}
              width={14}
              height={14}
              unoptimized
              style={{ width: '14px', height: '14px' }}
              className="size-3.5 object-contain shrink-0"
            />
            <span
              className="truncate text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              title={channelName}
            >
              {channelName}
            </span>
          </div>

          <div className="shrink-0 flex items-center">
            {conversation.assignee ? (
              <div
                className="flex items-center gap-1 text-[11px] text-muted-foreground/80 font-medium"
                title={`Phụ trách: ${conversation.assignee.name || conversation.assignee.email}`}
              >
                <Avatar className="size-4 shrink-0 ring-1 ring-border/50">
                  <AvatarImage
                    src={conversation.assignee.avatarUrl || undefined}
                    alt={conversation.assignee.name}
                  />
                  <AvatarFallback className="text-[8px] font-bold bg-muted text-muted-foreground">
                    {getInitials(conversation.assignee.name || conversation.assignee.email)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate max-w-[65px] text-[10px] text-muted-foreground">
                  {getShortName(conversation.assignee.name || conversation.assignee.email)}
                </span>
              </div>
            ) : (
              <span
                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                title="Chưa phân công"
              >
                <UserX className="size-3 text-muted-foreground/40" />
                <span>Chưa nhận</span>
              </span>
            )}
          </div>
        </div>

        {/* Row 3: Last message preview (left) & Unread count badge (right) */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <p
            className={cn(
              'truncate text-xs flex items-center gap-1.5 flex-1 min-w-0 leading-normal',
              isUnread ? 'text-foreground font-medium' : 'text-muted-foreground',
            )}
          >
            {isPrivateNote && <Lock className="size-3 text-amber-500 shrink-0" />}
            {!isPrivateNote && isAgentReply && (
              <CornerUpLeft className="size-3 text-muted-foreground shrink-0" />
            )}
            {!isPrivateNote && !isAgentReply && hasAttachments && (
              <ImageIcon className="size-3 text-muted-foreground shrink-0" />
            )}
            <span className="truncate">{lastMessageText}</span>
          </p>

          {unreadCount > 0 && (
            <span className="size-4.5 min-w-4.5 px-1 bg-emerald-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 shadow-xs">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>

        {/* Row 4: Labels (Dedicated row with soft pastel tint pills) */}
        {conversation.labels && conversation.labels.length > 0 && (
          <div className="flex items-center gap-1.5 pt-0.5 flex-wrap min-w-0">
            {conversation.labels.slice(0, 3).map(label => (
              <span
                key={label.id}
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium border max-w-[120px] truncate transition-colors"
                style={{
                  ...getLabelBadgeStyle(label.color),
                  color: label.color || undefined,
                }}
                title={label.title}
              >
                <span
                  className="size-1.5 rounded-full shrink-0 shadow-2xs"
                  style={{ backgroundColor: label.color || '#64748b' }}
                />
                <span className="truncate">{label.title}</span>
              </span>
            ))}

            {conversation.labels.length > 3 && (
              <span
                className="text-[10px] text-muted-foreground/70 font-medium px-1"
                title={conversation.labels
                  .slice(3)
                  .map(l => l.title)
                  .join(', ')}
              >
                +{conversation.labels.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
