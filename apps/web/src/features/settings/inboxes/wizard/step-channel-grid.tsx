'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CHANNEL_CARDS, type ChannelCardItem } from './types';

interface StepChannelGridProps {
  onSelectChannel: (channelKey: string) => void;
}

export function StepChannelGrid({ onSelectChannel }: StepChannelGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {CHANNEL_CARDS.map((channel: ChannelCardItem) => {
        const isDisabled = channel.disabled;

        return (
          <Card
            key={channel.key}
            onClick={() => {
              if (!isDisabled) {
                onSelectChannel(channel.key);
              }
            }}
            onKeyDown={e => {
              if ((e.key === 'Enter' || e.key === ' ') && !isDisabled) {
                e.preventDefault();
                onSelectChannel(channel.key);
              }
            }}
            role="button"
            tabIndex={isDisabled ? -1 : 0}
            aria-disabled={isDisabled}
            className={
              isDisabled
                ? 'relative flex flex-col justify-between rounded-xl border border-border/60 bg-muted/20 p-5 opacity-60 cursor-not-allowed select-none'
                : 'group relative flex flex-col justify-between cursor-pointer rounded-xl border border-border bg-card/40 p-5 transition-all hover:border-primary/50 hover:bg-card/80 hover:shadow-sm'
            }
          >
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between">
                <div
                  className={`flex size-11 items-center justify-center rounded-xl border border-border/60 p-2 shadow-xs transition-colors ${
                    isDisabled
                      ? 'bg-muted/30 grayscale'
                      : 'bg-muted/40 group-hover:border-primary/40 group-hover:bg-primary/5'
                  }`}
                >
                  <img
                    src={channel.logoSrc}
                    alt={channel.title}
                    className="size-7 object-contain"
                  />
                </div>
                {channel.badge && (
                  <Badge
                    variant="secondary"
                    className={`text-[10px] font-medium ${
                      isDisabled
                        ? 'border-muted text-muted-foreground bg-muted/60'
                        : 'border-primary/20 text-primary'
                    }`}
                  >
                    {channel.badge}
                  </Badge>
                )}
              </div>

              <div>
                <h2
                  className={`text-sm font-semibold transition-colors ${
                    isDisabled
                      ? 'text-muted-foreground'
                      : 'text-foreground group-hover:text-primary'
                  }`}
                >
                  {channel.title}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {channel.description}
                </p>
              </div>
            </div>

            <div
              className={`mt-5 pt-3 border-t border-border/50 flex items-center justify-between text-xs font-medium ${
                isDisabled ? 'text-muted-foreground/60' : 'text-primary'
              }`}
            >
              <span>{isDisabled ? 'Chưa khả dụng' : 'Bắt đầu kết nối'}</span>
              <span
                className={isDisabled ? '' : 'transition-transform group-hover:translate-x-0.5'}
              >
                {isDisabled ? '—' : '→'}
              </span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
