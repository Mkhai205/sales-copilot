'use client';

import * as React from 'react';
import { Globe, Send, Mail, MessageSquare, MessageCircle, CheckCircle2 } from 'lucide-react';
import { ChannelType } from '@sales-copilot/shared-contracts';
import { Card } from '@/components/ui/card';
import { SUPPORTED_CHANNELS, type ChannelTypeMeta } from '../constants/inbox-channels';

export interface ChannelOption extends ChannelTypeMeta {
  icon: React.ReactNode;
  iconBg: string;
}

export const CHANNEL_OPTIONS: ChannelOption[] = [
  {
    ...SUPPORTED_CHANNELS[0],
    icon: <Globe className="size-5 text-blue-500" />,
    iconBg: 'bg-blue-500/10 border-blue-500/20',
  },
  {
    ...SUPPORTED_CHANNELS[1],
    icon: <MessageSquare className="size-5 text-indigo-500" />,
    iconBg: 'bg-indigo-500/10 border-indigo-500/20',
  },
  {
    ...SUPPORTED_CHANNELS[2],
    icon: <Send className="size-5 text-sky-500" />,
    iconBg: 'bg-sky-500/10 border-sky-500/20',
  },
  {
    ...SUPPORTED_CHANNELS[3],
    icon: <Mail className="size-5 text-emerald-500" />,
    iconBg: 'bg-emerald-500/10 border-emerald-500/20',
  },
  {
    ...SUPPORTED_CHANNELS[4],
    icon: <MessageCircle className="size-5 text-amber-500" />,
    iconBg: 'bg-amber-500/10 border-amber-500/20',
  },
];

interface StepSelectChannelProps {
  selectedType: ChannelType;
  onSelectType: (type: ChannelType) => void;
}

export function StepSelectChannel({ selectedType, onSelectType }: StepSelectChannelProps) {
  return (
    <div className="flex flex-col gap-3 py-1">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {CHANNEL_OPTIONS.map(channel => {
          const isSelected = selectedType === channel.type;

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
              <div
                className={`flex size-9 shrink-0 items-center justify-center rounded-lg border ${channel.iconBg}`}
              >
                {channel.icon}
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
