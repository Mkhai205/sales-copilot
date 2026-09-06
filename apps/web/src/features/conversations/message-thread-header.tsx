'use client';

import * as React from 'react';
import Image from 'next/image';
import {
  PanelRightClose,
  PanelRightOpen,
  CheckCircle2,
  RotateCcw,
  UserPlus,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ConversationStatus, Priority, type ConversationResponseDto } from '@/lib/api/types';
import { getChannelMeta } from '@/lib/channels';

import { useI18n } from '@/lib/i18n';

interface MessageThreadHeaderProps {
  conversation?: ConversationResponseDto;
  isLoading?: boolean;
  isDetailOpen: boolean;
  onToggleDetail: () => void;
  onResolve?: () => void;
  isCopilotOpen?: boolean;
  onToggleCopilot?: () => void;
  pendingSuggestionsCount?: number;
}

export function MessageThreadHeader({
  conversation,
  isLoading = false,
  isDetailOpen,
  onToggleDetail,
  onResolve,
  isCopilotOpen = false,
  onToggleCopilot,
  pendingSuggestionsCount = 0,
}: MessageThreadHeaderProps) {
  const { t } = useI18n();

  const getStatusBadge = (status?: ConversationStatus) => {
    switch (status) {
      case ConversationStatus.OPEN:
        return (
          <Badge
            variant="outline"
            className="text-[10px] text-emerald-500 border-emerald-500/30 bg-emerald-500/10 py-0 px-1.5 font-medium"
          >
            {t('conversations.status.open')}
          </Badge>
        );
      case ConversationStatus.PENDING:
        return (
          <Badge
            variant="outline"
            className="text-[10px] text-amber-500 border-amber-500/30 bg-amber-500/10 py-0 px-1.5 font-medium"
          >
            {t('conversations.status.pending')}
          </Badge>
        );
      case ConversationStatus.RESOLVED:
        return (
          <Badge
            variant="outline"
            className="text-[10px] text-muted-foreground border-border bg-muted py-0 px-1.5 font-medium"
          >
            {t('conversations.status.resolved')}
          </Badge>
        );
      case ConversationStatus.SNOOZED:
        return (
          <Badge
            variant="outline"
            className="text-[10px] text-purple-500 border-purple-500/30 bg-purple-500/10 py-0 px-1.5 font-medium"
          >
            {t('conversations.status.snoozed')}
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
            {t('conversations.priority.urgent')}
          </Badge>
        );
      case Priority.HIGH:
        return (
          <Badge
            variant="outline"
            className="text-[10px] text-orange-500 border-orange-500/30 bg-orange-500/10 py-0 px-1.5 font-medium"
          >
            {t('conversations.priority.high')}
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
            {t('conversations.priority.low')}
          </Badge>
        );
      default:
        return null;
    }
  };
  const contact = conversation?.contact;
  const channelMeta = getChannelMeta(conversation?.inbox?.channelType);
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
              className="size-3.5 object-contain"
            />
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
          <p className="truncate text-[11px] text-muted-foreground flex items-center gap-1">
            <span>via {channelMeta.label}</span>
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
              {t('conversations.actions.reopen')}
            </>
          ) : (
            <>
              <CheckCircle2 className="size-3.5 text-emerald-500" />
              {t('conversations.actions.resolve')}
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
          {t('conversations.actions.assignee')}
        </Button>

        {onToggleCopilot && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isCopilotOpen ? 'secondary' : 'outline'}
                size="sm"
                onClick={onToggleCopilot}
                className={cn(
                  'h-7 text-xs gap-1.5 font-normal transition-colors',
                  pendingSuggestionsCount > 0
                    ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Sparkles className="size-3.5 text-primary" />
                <span>Copilot</span>
                {pendingSuggestionsCount > 0 && (
                  <Badge variant="default" className="h-4 px-1 text-[9px] font-bold">
                    {pendingSuggestionsCount}
                  </Badge>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {isCopilotOpen ? 'Đóng trợ lý Sales Copilot' : 'Mở trợ lý Sales Copilot'}
            </TooltipContent>
          </Tooltip>
        )}

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
