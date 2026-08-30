'use client';

import * as React from 'react';
import Link from 'next/link';
import { Search, SlidersHorizontal, User, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ConversationListPlaceholderProps {
  workspaceSlug: string;
  activeConversationId?: string;
}

export function ConversationListPlaceholder({
  workspaceSlug,
  activeConversationId,
}: ConversationListPlaceholderProps) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-card/50">
      {/* Panel Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/80 px-4">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold tracking-tight text-foreground">Conversations</h1>
          <Badge variant="secondary" className="text-[11px] font-normal">
            Inbox
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
        >
          <SlidersHorizontal className="size-3.5" />
          <span className="sr-only">Filter options</span>
        </Button>
      </div>

      {/* Search & Quick Filters Bar */}
      <div className="flex flex-col gap-2 border-b border-border/60 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search conversations..."
            disabled
            className="h-8 w-full rounded-md border border-border/70 bg-background/80 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/70 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-80"
          />
        </div>

        {/* Filter status tabs */}
        <div className="flex items-center gap-1 rounded-lg bg-muted/40 p-0.5">
          <button
            type="button"
            className="flex-1 rounded-md bg-background px-2 py-1 text-[11px] font-medium text-foreground shadow-xs"
          >
            Open
          </button>
          <button
            type="button"
            className="flex-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            Pending
          </button>
          <button
            type="button"
            className="flex-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            Resolved
          </button>
        </div>
      </div>

      {/* Conversation List Scroll Area (Mockup items for Shell) */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/40">
        {[
          {
            id: 'sample-1',
            name: 'Sarah Connor',
            preview: 'Can you confirm if the delivery time for order #4921 is today?',
            time: '5m',
            unread: 2,
            channel: 'Telegram',
            priority: 'urgent',
          },
          {
            id: 'sample-2',
            name: 'Alex Mercer',
            preview: 'Thanks for following up! The integration works smoothly now.',
            time: '24m',
            unread: 0,
            channel: 'Web Chat',
            priority: 'high',
          },
          {
            id: 'sample-3',
            name: 'Minh Nguyen',
            preview: 'Cho mình hỏi về bảng giá gói Enterprise và chiết khấu tháng này.',
            time: '2h',
            unread: 1,
            channel: 'Facebook',
            priority: 'medium',
          },
          {
            id: 'sample-4',
            name: 'Elena Rostova',
            preview: 'We would like to request an API key for the staging server.',
            time: '1d',
            unread: 0,
            channel: 'Email',
            priority: 'none',
          },
        ].map(item => {
          const isSelected = activeConversationId === item.id;
          return (
            <Link
              key={item.id}
              href={`/${workspaceSlug}/conversations/${item.id}`}
              className={cn(
                'group flex flex-col gap-1 p-3.5 transition-colors hover:bg-muted/40 text-left cursor-pointer relative',
                isSelected && 'bg-accent/10 hover:bg-accent/15 border-l-2 border-l-primary',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                    {item.name.charAt(0)}
                  </div>
                  <span
                    className={cn(
                      'truncate text-xs font-medium text-foreground',
                      item.unread > 0 && 'font-semibold',
                    )}
                  >
                    {item.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] text-muted-foreground">{item.time}</span>
                  {item.unread > 0 && (
                    <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                      {item.unread}
                    </span>
                  )}
                </div>
              </div>

              <p className="truncate text-xs text-muted-foreground/90 pl-9">{item.preview}</p>

              <div className="flex items-center gap-1.5 pl-9 pt-1">
                <Badge
                  variant="outline"
                  className="text-[9px] py-0 px-1 font-normal text-muted-foreground border-border/60"
                >
                  {item.channel}
                </Badge>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
