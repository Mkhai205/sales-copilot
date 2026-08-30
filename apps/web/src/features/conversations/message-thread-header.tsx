'use client';

import * as React from 'react';
import {
  PanelRightClose,
  PanelRightOpen,
  CheckCircle2,
  RotateCcw,
  UserPlus,
  Mail,
  Send,
  MessageCircle,
  Globe,
  MessageSquare,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ChannelType,
  ConversationStatus,
  Priority,
  type ConversationResponseDto,
} from '@/lib/api/types';

interface MessageThreadHeaderProps {
  conversation?: ConversationResponseDto;
  isLoading?: boolean;
  isDetailOpen: boolean;
  onToggleDetail: () => void;
  onResolve?: () => void;
}

function getChannelInfo(inboxName?: string, channelType?: ChannelType | string) {
  if (
    channelType === ChannelType.FACEBOOK_MESSENGER ||
    inboxName?.toLowerCase().includes('messenger')
  ) {
    return { label: 'Messenger', icon: MessageCircle, color: 'text-blue-500' };
  }
  if (channelType === ChannelType.TELEGRAM || inboxName?.toLowerCase().includes('telegram')) {
    return { label: 'Telegram', icon: Send, color: 'text-sky-500' };
  }
  if (
    channelType === ChannelType.EMAIL ||
    inboxName?.toLowerCase().includes('email') ||
    inboxName?.toLowerCase().includes('mail')
  ) {
    return { label: 'Email', icon: Mail, color: 'text-amber-500' };
  }
  if (
    channelType === ChannelType.WEB_CHAT ||
    inboxName?.toLowerCase().includes('web') ||
    inboxName?.toLowerCase().includes('live')
  ) {
    return { label: 'Live Chat', icon: Globe, color: 'text-emerald-500' };
  }
  if (channelType === ChannelType.ZALO || inboxName?.toLowerCase().includes('zalo')) {
    return { label: 'Zalo', icon: MessageSquare, color: 'text-blue-600' };
  }
  return { label: inboxName || 'Chat', icon: MessageSquare, color: 'text-muted-foreground' };
}

function getStatusBadge(status?: ConversationStatus) {
  switch (status) {
    case ConversationStatus.OPEN:
      return (
        <Badge
          variant="outline"
          className="text-[10px] text-emerald-500 border-emerald-500/30 bg-emerald-500/10 py-0 px-1.5 font-medium"
        >
          Open
        </Badge>
      );
    case ConversationStatus.PENDING:
      return (
        <Badge
          variant="outline"
          className="text-[10px] text-amber-500 border-amber-500/30 bg-amber-500/10 py-0 px-1.5 font-medium"
        >
          Pending
        </Badge>
      );
    case ConversationStatus.RESOLVED:
      return (
        <Badge
          variant="outline"
          className="text-[10px] text-muted-foreground border-border bg-muted py-0 px-1.5 font-medium"
        >
          Resolved
        </Badge>
      );
    case ConversationStatus.SNOOZED:
      return (
        <Badge
          variant="outline"
          className="text-[10px] text-purple-500 border-purple-500/30 bg-purple-500/10 py-0 px-1.5 font-medium"
        >
          Snoozed
        </Badge>
      );
    default:
      return null;
  }
}

function getPriorityBadge(priority?: Priority) {
  if (!priority) return null;
  switch (priority) {
    case Priority.URGENT:
      return (
        <Badge
          variant="outline"
          className="text-[10px] text-rose-500 border-rose-500/30 bg-rose-500/10 py-0 px-1.5 font-medium gap-1"
        >
          <AlertTriangle className="size-2.5" />
          Urgent
        </Badge>
      );
    case Priority.HIGH:
      return (
        <Badge
          variant="outline"
          className="text-[10px] text-orange-500 border-orange-500/30 bg-orange-500/10 py-0 px-1.5 font-medium"
        >
          High
        </Badge>
      );
    case Priority.MEDIUM:
      return null;
    case Priority.LOW:
      return (
        <Badge
          variant="outline"
          className="text-[10px] text-slate-400 border-slate-500/30 bg-slate-500/10 py-0 px-1.5 font-medium"
        >
          Low
        </Badge>
      );
    default:
      return null;
  }
}

export function MessageThreadHeader({
  conversation,
  isLoading = false,
  isDetailOpen,
  onToggleDetail,
  onResolve,
}: MessageThreadHeaderProps) {
  const contact = conversation?.contact;
  const channelInfo = getChannelInfo(conversation?.inbox?.name);
  const ChannelIcon = channelInfo.icon;
  const isResolved = conversation?.status === ConversationStatus.RESOLVED;

  const contactInitials = contact?.name
    ? contact.name
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'SC';

  const displayId = conversation?.displayId
    ? `#${conversation.displayId}`
    : conversation?.id
      ? `#${conversation.id.slice(0, 8)}`
      : '';

  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/80 px-4 bg-background/95 backdrop-blur-xs">
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative">
          <Avatar className="size-8.5 ring-1 ring-border">
            {contact?.avatarUrl && <AvatarImage src={contact.avatarUrl} alt={contact.name || ''} />}
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {contactInitials}
            </AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-0.5 -right-0.5 rounded-full bg-background p-0.5 shadow-xs">
            <ChannelIcon className={`size-3 ${channelInfo.color}`} />
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-xs font-semibold text-foreground">
              {contact?.name || 'Contact'}
            </h2>
            {getStatusBadge(conversation?.status)}
            {getPriorityBadge(conversation?.priority)}
          </div>
          <p className="truncate text-[11px] text-muted-foreground">
            via {channelInfo.label}
            {displayId ? ` • ID ${displayId}` : ''}
            {conversation?.assignee?.name ? ` • Assigned to ${conversation.assignee.name}` : ''}
          </p>
        </div>
      </div>

      {/* Header Action Buttons */}
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={onResolve}
          disabled={isLoading || !conversation}
          className="h-7 text-xs gap-1.5 font-normal"
        >
          {isResolved ? (
            <>
              <RotateCcw className="size-3.5 text-muted-foreground" />
              Reopen
            </>
          ) : (
            <>
              <CheckCircle2 className="size-3.5 text-emerald-500" />
              Resolve
            </>
          )}
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={isLoading || !conversation}
          className="h-7 text-xs gap-1.5 font-normal"
        >
          <UserPlus className="size-3.5 text-muted-foreground" />
          Assign
        </Button>

        <div className="h-4 w-px bg-border mx-0.5" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggleDetail}
              className="text-muted-foreground hover:text-foreground"
            >
              {isDetailOpen ? (
                <PanelRightClose className="size-4" />
              ) : (
                <PanelRightOpen className="size-4" />
              )}
              <span className="sr-only">Toggle contact details</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {isDetailOpen ? 'Hide contact details' : 'Show contact details'}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
