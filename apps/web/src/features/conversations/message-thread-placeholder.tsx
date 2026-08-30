'use client';

import * as React from 'react';
import {
  PanelRightClose,
  PanelRightOpen,
  Send,
  Paperclip,
  Smile,
  CheckCircle2,
  Lock,
  UserPlus,
  CheckCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
} from '@/components/ui/message-scroller';
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
  MessageFooter,
} from '@/components/ui/message';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { Marker, MarkerContent } from '@/components/ui/marker';

interface MessageThreadPlaceholderProps {
  conversationId: string;
  isDetailOpen: boolean;
  onToggleDetail: () => void;
}

export function MessageThreadPlaceholder({
  conversationId,
  isDetailOpen,
  onToggleDetail,
}: MessageThreadPlaceholderProps) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Thread Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/80 px-4">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              SC
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-xs font-semibold text-foreground">Sarah Connor</h2>
              <Badge
                variant="outline"
                className="text-[10px] text-emerald-500 border-emerald-500/30 bg-emerald-500/10 py-0 px-1.5 font-medium"
              >
                Open
              </Badge>
            </div>
            <p className="truncate text-[11px] text-muted-foreground">
              via Telegram • ID #{conversationId.slice(0, 8)}
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 font-normal">
            <CheckCircle2 className="size-3.5 text-emerald-500" />
            Resolve
          </Button>

          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 font-normal">
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
              {isDetailOpen ? 'Hide contact info' : 'Show contact info'}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Message Stream Scroll Area via MessageScroller primitive */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <MessageScroller className="h-full">
          <MessageScrollerViewport className="p-4">
            <MessageScrollerContent className="gap-4">
              {/* Date Separator */}
              <Marker variant="separator">
                <MarkerContent>Today</MarkerContent>
              </Marker>

              {/* Inbound Message (Contact) */}
              <MessageScrollerItem>
                <Message align="start">
                  <MessageAvatar>
                    <Avatar className="size-6">
                      <AvatarFallback className="text-[10px] bg-muted-foreground/20">
                        SC
                      </AvatarFallback>
                    </Avatar>
                  </MessageAvatar>
                  <MessageContent>
                    <MessageHeader>Sarah Connor • 10:42 AM</MessageHeader>
                    <Bubble variant="muted" align="start">
                      <BubbleContent>
                        Hi team, can you confirm if the delivery time for order #4921 is today? I
                        have not received the tracking SMS yet.
                      </BubbleContent>
                    </Bubble>
                  </MessageContent>
                </Message>
              </MessageScrollerItem>

              {/* Private Note Sample */}
              <MessageScrollerItem>
                <Marker
                  variant="default"
                  className="text-amber-500 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20 max-w-[85%] mx-auto w-full"
                >
                  <MarkerContent className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-500">
                      <Lock className="size-3" />
                      Private Note (Only visible to internal team)
                    </div>
                    <p className="text-xs text-amber-200/90 leading-relaxed">
                      Checked warehouse inventory: Order #4921 is packaged and waiting for courier
                      pickup at 2:00 PM.
                    </p>
                  </MarkerContent>
                </Marker>
              </MessageScrollerItem>

              {/* Outbound Message (Agent) */}
              <MessageScrollerItem scrollAnchor>
                <Message align="end">
                  <MessageContent>
                    <MessageHeader>You • 10:45 AM</MessageHeader>
                    <Bubble variant="default" align="end">
                      <BubbleContent>
                        Hello Sarah! We just verified with our logistics team. Your package is
                        scheduled for pickup today at 2:00 PM and will be delivered by this evening.
                      </BubbleContent>
                    </Bubble>
                    <MessageFooter>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        Sent <CheckCheck className="size-3 text-primary" />
                      </span>
                    </MessageFooter>
                  </MessageContent>
                </Message>
              </MessageScrollerItem>
            </MessageScrollerContent>
          </MessageScrollerViewport>

          {/* Floating Jump to Latest Button */}
          <MessageScrollerButton direction="end" />
        </MessageScroller>
      </div>

      {/* Composer Shell Container */}
      <div className="border-t border-border/80 p-3 bg-card/30">
        <div className="rounded-lg border border-border bg-background focus-within:border-ring focus-within:ring-1 focus-within:ring-ring transition-all">
          <textarea
            placeholder="Type a message or type '/' for canned responses..."
            rows={2}
            className="w-full resize-none bg-transparent p-3 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
          />
          <div className="flex items-center justify-between border-t border-border/40 px-3 py-2">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground hover:text-foreground"
              >
                <Paperclip className="size-3.5" />
                <span className="sr-only">Attach file</span>
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground hover:text-foreground"
              >
                <Smile className="size-3.5" />
                <span className="sr-only">Emoji</span>
              </Button>
            </div>
            <Button size="sm" className="h-6 text-xs gap-1.5">
              <span>Send</span>
              <Send className="size-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
