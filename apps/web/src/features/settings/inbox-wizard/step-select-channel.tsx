'use client';

import * as React from 'react';
import Image from 'next/image';
import { CheckCircle2 } from 'lucide-react';
import { ChannelType } from '@sales-copilot/shared-contracts';
import { Card } from '@/components/ui/card';
import { SUPPORTED_CHANNELS } from '../constants/inbox-channels';
import { getChannelMeta } from '@/lib/channels';

interface StepSelectChannelProps {
  selectedType: ChannelType;
  onSelectType: (type: ChannelType) => void;
}

export function StepSelectChannel({ selectedType, onSelectType }: StepSelectChannelProps) {
  return (
    <div className="flex flex-col gap-3 py-1">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {SUPPORTED_CHANNELS.map(channel => {
          const isSelected = selectedType === channel.type;
          const meta = getChannelMeta(channel.type);

          return (
            <Card
              key={channel.type}
              onClick={() => onSelectType(channel.type)}
              className={`relative flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all text-left ${
                isSelected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/30 shadow-xs'
                  : 'border-border bg-card/40 hover:border-border/80 hover:bg-card/70'
              }`}
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/30 p-1.5 shadow-xs">
                <Image
                  src={meta.iconSrc}
                  alt={channel.title}
                  width={28}
                  height={28}
                  unoptimized
                  className="size-7 object-contain"
                />
              </div>

              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-foreground">{channel.title}</span>
                  {isSelected && <CheckCircle2 className="size-4 shrink-0 text-primary" />}
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                  {channel.description}
                </p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
