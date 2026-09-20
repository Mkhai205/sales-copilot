'use client';

import * as React from 'react';
import Image from 'next/image';
import { CheckCircle2 } from 'lucide-react';
import { ChannelType } from '@sales-copilot/shared-contracts';
import { Card } from '@/components/ui/card';
import { SUPPORTED_CHANNELS } from '../../../constants/inbox-channels';
import { getChannelMeta } from '@/lib/channels';

interface StepSelectChannelProps {
  selectedType: ChannelType;
  onSelectType: (type: ChannelType) => void;
}

export function StepSelectChannel({ selectedType, onSelectType }: StepSelectChannelProps) {
  const channelTitleMap: Record<ChannelType, string> = {
    [ChannelType.WEB_CHAT]: 'Website Live Chat',
    [ChannelType.FACEBOOK_MESSENGER]: 'Facebook Messenger',
    [ChannelType.TELEGRAM]: 'Telegram Bot',
    [ChannelType.EMAIL]: 'Hỗ trợ qua Email',
    [ChannelType.ZALO]: 'Zalo Official Account',
  };

  const channelDescMap: Record<ChannelType, string> = {
    [ChannelType.WEB_CHAT]:
      'Nhúng widget chat trực tiếp tương tác trên website hoặc gian hàng của bạn.',
    [ChannelType.FACEBOOK_MESSENGER]:
      'Kết nối Fanpage qua OAuth 1-click để tiếp nhận và trả lời tin nhắn khách hàng.',
    [ChannelType.TELEGRAM]:
      'Kết nối Telegram Bot Token để xử lý tin nhắn khách hàng trực tiếp từ Telegram.',
    [ChannelType.EMAIL]:
      'Kết nối hòm thư dùng chung qua SMTP / IMAP để xử lý email dưới dạng hội thoại.',
    [ChannelType.ZALO]:
      'Tiếp cận khách hàng Việt Nam qua tích hợp Zalo OA bằng OA ID và Secret Key.',
  };

  return (
    <div className="flex flex-col gap-3 py-1">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {SUPPORTED_CHANNELS.map(channel => {
          const isSelected = selectedType === channel.type;
          const meta = getChannelMeta(channel.type);
          const title = channelTitleMap[channel.type] || channel.title;
          const description = channelDescMap[channel.type] || channel.description;

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
                  alt={title}
                  width={28}
                  height={28}
                  unoptimized
                  style={{ width: '28px', height: '28px' }}
                  className="size-7 object-contain"
                />
              </div>

              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-foreground">{title}</span>
                  {isSelected && <CheckCircle2 className="size-4 shrink-0 text-primary" />}
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                  {description}
                </p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
