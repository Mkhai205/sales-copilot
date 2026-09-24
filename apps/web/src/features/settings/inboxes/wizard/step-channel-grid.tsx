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
      {CHANNEL_CARDS.map((channel: ChannelCardItem) => (
        <Card
          key={channel.key}
          onClick={() => onSelectChannel(channel.key)}
          className="group relative flex flex-col justify-between cursor-pointer rounded-xl border border-border bg-card/40 p-5 transition-all hover:border-primary/50 hover:bg-card/80 hover:shadow-sm"
        >
          <div className="flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <div className="flex size-11 items-center justify-center rounded-xl border border-border/60 bg-muted/40 p-2 shadow-xs transition-colors group-hover:border-primary/40 group-hover:bg-primary/5">
                <img src={channel.logoSrc} alt={channel.title} className="size-7 object-contain" />
              </div>
              {channel.badge && (
                <Badge
                  variant="secondary"
                  className="text-[10px] font-medium border-primary/20 text-primary"
                >
                  {channel.badge}
                </Badge>
              )}
            </div>

            <div>
              <h2 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                {channel.title}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {channel.description}
              </p>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-border/50 flex items-center justify-between text-xs font-medium text-primary">
            <span>Bắt đầu kết nối</span>
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </div>
        </Card>
      ))}
    </div>
  );
}
