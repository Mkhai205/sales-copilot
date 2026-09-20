'use client';

import * as React from 'react';
import Image from 'next/image';
import {
  PanelRightClose,
  PanelRightOpen,
  AlertTriangle,
  Bot,
  UserRoundCheck,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ConversationStatus,
  Priority,
  type ConversationResponseDto,
} from '@sales-copilot/shared-contracts';
import { getChannelMeta } from '@/lib/channels';
import { useInbox } from '@/features/settings';
import { useTakeoverConversation } from './hooks/use-takeover-conversation';

interface MessageThreadHeaderProps {
  conversation?: ConversationResponseDto;
  workspaceSlug?: string;
  isLoading?: boolean;
  isDetailOpen: boolean;
  onToggleDetail: () => void;
  onResolve?: () => void;
  onOpenPosDrawer?: () => void;
}

export function MessageThreadHeader({
  conversation,
  workspaceSlug,
  isDetailOpen,
  onToggleDetail,
}: MessageThreadHeaderProps) {
  const takeoverMutation = useTakeoverConversation({
    workspaceId: conversation?.workspaceId,
    workspaceSlug,
  });

  const { data: inbox } = useInbox(
    conversation?.workspaceId,
    (conversation?.inbox as any)?.settings ? undefined : conversation?.inboxId,
  );
  const inboxSettings = (conversation?.inbox as any)?.settings || inbox?.settings;
  const isAiConfigured = Boolean(inboxSettings?.aiCommercePolicy?.enabled);
  const isAiActive = isAiConfigured && !conversation?.isAiPaused;
  const isStaffTakeover = isAiConfigured && Boolean(conversation?.isAiPaused);

  const getStatusBadge = (status?: ConversationStatus) => {
    switch (status) {
      case ConversationStatus.OPEN:
        return (
          <Badge
            variant="outline"
            className="text-[10px] text-emerald-500 border-emerald-500/30 bg-emerald-500/10 py-0 px-1.5 font-medium"
          >
            {'Đang mở'}
          </Badge>
        );
      case ConversationStatus.PENDING:
        return (
          <Badge
            variant="outline"
            className="text-[10px] text-amber-500 border-amber-500/30 bg-amber-500/10 py-0 px-1.5 font-medium"
          >
            {'Đang chờ'}
          </Badge>
        );
      case ConversationStatus.RESOLVED:
        return (
          <Badge
            variant="outline"
            className="text-[10px] text-muted-foreground border-border bg-muted py-0 px-1.5 font-medium"
          >
            {'Đã giải quyết'}
          </Badge>
        );
      case ConversationStatus.SNOOZED:
        return (
          <Badge
            variant="outline"
            className="text-[10px] text-purple-500 border-purple-500/30 bg-purple-500/10 py-0 px-1.5 font-medium"
          >
            {'Tạm hoãn'}
          </Badge>
        );
      default:
        return null;
    }
  };

  const getPriorityBadge = (priority?: Priority) => {
    if (!priority) return null;
    switch (priority) {
      case Priority.URGENT:
        return (
          <Badge
            variant="outline"
            className="text-[10px] text-rose-500 border-rose-500/30 bg-rose-500/10 py-0 px-1.5 font-medium gap-1"
          >
            <AlertTriangle className="size-2.5" />
            {'Khẩn cấp'}
          </Badge>
        );
      case Priority.HIGH:
        return (
          <Badge
            variant="outline"
            className="text-[10px] text-orange-500 border-orange-500/30 bg-orange-500/10 py-0 px-1.5 font-medium"
          >
            {'Cao'}
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
            {'Thấp'}
          </Badge>
        );
      default:
        return null;
    }
  };
  const contact = conversation?.contact;
  const channelMeta = getChannelMeta(conversation?.inbox?.channelType);

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
          <Avatar className="size-10 ring-1 ring-border/50">
            <AvatarImage
              src={contact?.avatarUrl || '/avatar-contact-default.svg'}
              alt={contact?.name || ''}
            />
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {contactInitials}
            </AvatarFallback>
          </Avatar>
          <div
            className="absolute -bottom-1 -right-1 size-4.5 rounded-full border-2 border-background bg-card shadow-xs flex items-center justify-center shrink-0"
            title={channelMeta.label}
          >
            <Image
              src={channelMeta.iconSrc}
              alt={channelMeta.label}
              width={14}
              height={14}
              unoptimized
              style={{ width: '14px', height: '14px' }}
              className="size-3.5 object-contain"
            />
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-xs font-semibold text-foreground">
              {contact?.name || 'Khách vãng lai'}
            </h2>
            {getStatusBadge(conversation?.status)}
            {getPriorityBadge(conversation?.priority)}
            {isAiActive && (
              <Badge
                variant="outline"
                className="text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/10 py-0 px-1.5 font-medium flex items-center gap-1"
              >
                <Bot className="size-2.5" />
                <span>{'AI Autopilot'}</span>
              </Badge>
            )}
            {isStaffTakeover && (
              <Badge
                variant="outline"
                className="text-[10px] text-amber-500 border-amber-500/30 bg-amber-500/10 py-0 px-1.5 font-medium flex items-center gap-1"
              >
                <UserRoundCheck className="size-2.5" />
                <span>{'Nhân viên'}</span>
              </Badge>
            )}
          </div>
          <p className="truncate text-[11px] text-muted-foreground flex items-center gap-1">
            <span>qua {channelMeta.label}</span>
            {displayId ? ` • ID ${displayId}` : ''}
            {conversation?.assignee?.name ? ` • Phân công: ${conversation.assignee.name}` : ''}
          </p>
        </div>
      </div>

      {/* Header Action Buttons */}
      <div className="flex items-center gap-1.5">
        {isAiActive && conversation?.id && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => takeoverMutation.mutate(conversation.id)}
            disabled={takeoverMutation.isPending}
            className="h-7 text-xs gap-1.5 border-amber-500/40 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 font-medium cursor-pointer"
          >
            {takeoverMutation.isPending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <UserRoundCheck className="size-3.5" />
            )}
            <span>{'Tiếp quản từ AI'}</span>
          </Button>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggleDetail}
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {isDetailOpen ? (
                <PanelRightClose className="size-4" />
              ) : (
                <PanelRightOpen className="size-4" />
              )}
              <span className="sr-only">Ẩn/hiện thông tin liên hệ</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {isDetailOpen ? 'Ẩn thông tin liên hệ' : 'Hiện thông tin liên hệ'}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
