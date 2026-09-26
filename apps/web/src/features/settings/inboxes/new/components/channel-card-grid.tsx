'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SUPPORTED_CHANNELS, type ChannelDefinition } from '../channel-registry';
import { useNewInbox } from '../context/new-inbox-context';
import type { SupportedChannelKey } from '../types';

interface ChannelCardGridProps {
  onSelectChannel?: (channelKey: SupportedChannelKey) => void;
}

export function ChannelCardGrid({ onSelectChannel }: ChannelCardGridProps = {}) {
  const { selectChannel } = useNewInbox();
  const handleSelect = onSelectChannel || selectChannel;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-foreground">Chọn loại kênh bạn muốn kết nối</h2>
        <p className="text-xs text-muted-foreground">
          Sales Copilot hỗ trợ đa kênh chăm sóc khách hàng tập trung tại một nơi.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SUPPORTED_CHANNELS.map((channel: ChannelDefinition) => {
          return (
            <Card
              key={channel.key}
              onClick={() => handleSelect(channel.key)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSelect(channel.key);
                }
              }}
              role="button"
              tabIndex={0}
              className="group relative flex flex-col justify-between cursor-pointer rounded-xl border border-border bg-card/40 p-5 transition-all hover:border-primary/50 hover:bg-card/80 hover:shadow-sm"
            >
              <div className="flex flex-col gap-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex size-11 items-center justify-center rounded-xl border border-border/60 bg-muted/40 p-2 shadow-xs transition-colors group-hover:border-primary/40 group-hover:bg-primary/5">
                    <img
                      src={channel.logoSrc}
                      alt={channel.title}
                      className="size-7 object-contain"
                    />
                  </div>
                  {channel.badge ? (
                    <Badge
                      variant="secondary"
                      className="text-[10px] font-medium border-primary/20 text-primary"
                    >
                      {channel.badge}
                    </Badge>
                  ) : null}
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                    {channel.title}
                  </h3>
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
          );
        })}
      </div>
    </div>
  );
}
