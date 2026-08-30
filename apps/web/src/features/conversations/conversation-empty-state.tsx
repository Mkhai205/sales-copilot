'use client';

import * as React from 'react';
import { MessageSquare, Sparkles, Inbox, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function ConversationEmptyState() {
  return (
    <div className="relative flex h-full flex-1 flex-col items-center justify-center overflow-hidden p-8 text-center bg-background/50">
      {/* Subtle ambient backdrop */}
      <div className="pointer-events-none absolute -top-24 size-96 rounded-full bg-primary/5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 size-96 rounded-full bg-accent/5 blur-3xl" />

      <div className="relative z-10 flex max-w-md flex-col items-center">
        <div className="relative mb-6 flex size-16 items-center justify-center rounded-2xl border border-border/80 bg-card/80 shadow-sm backdrop-blur-sm">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MessageSquare className="size-5" />
          </div>
          <div className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border border-card bg-primary text-[10px] text-primary-foreground shadow-xs">
            <Sparkles className="size-3" />
          </div>
        </div>

        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          No Conversation Selected
        </h2>

        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Select an active customer conversation from the list on the left to review message
          history, reply across channels, or update assignment status.
        </p>

        <div className="mt-8 grid grid-cols-2 gap-3 w-full max-w-sm text-left">
          <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-card/40 p-3">
            <Inbox className="mt-0.5 size-4 text-primary shrink-0" />
            <div>
              <p className="text-xs font-medium text-foreground">Omnichannel Routing</p>
              <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                Facebook, Telegram, Web Chat & Email synced
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-card/40 p-3">
            <ShieldCheck className="mt-0.5 size-4 text-emerald-500 shrink-0" />
            <div>
              <p className="text-xs font-medium text-foreground">Realtime Sync</p>
              <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                Instant delivery & presence updates
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
