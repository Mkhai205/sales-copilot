'use client';

import * as React from 'react';
import Image from 'next/image';
import { Inbox, ShieldCheck } from 'lucide-react';

import { useI18n } from '@/lib/i18n';

export function ConversationEmptyState() {
  const { t } = useI18n();

  return (
    <div className="relative flex h-full flex-1 flex-col items-center justify-center overflow-hidden p-8 text-center bg-background/50">
      {/* Subtle ambient backdrop */}
      <div className="pointer-events-none absolute -top-24 size-96 rounded-full bg-primary/5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 size-96 rounded-full bg-accent/5 blur-3xl" />

      <div className="relative z-10 flex max-w-md flex-col items-center">
        <div className="mb-4 flex items-center justify-center">
          <Image
            src="/empty-conversations.svg"
            alt={t('conversations.empty.title')}
            width={240}
            height={200}
            priority
            className="max-h-44 w-auto object-contain drop-shadow-xs"
          />
        </div>

        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {t('conversations.empty.title')}
        </h2>

        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          {t('conversations.empty.description')}
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
