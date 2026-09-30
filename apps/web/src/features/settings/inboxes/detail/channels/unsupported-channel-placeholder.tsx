'use client';

import * as React from 'react';
import { Sparkles, Globe, MessageSquare, Send } from 'lucide-react';
import { ChannelType } from '@sales-copilot/shared-contracts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface UnsupportedChannelPlaceholderProps {
  channelType: ChannelType | string;
}

const CHANNEL_LABELS: Record<string, string> = {
  [ChannelType.ZALO]: 'Zalo Official Account',
  [ChannelType.EMAIL]: 'Hòm thư Email',
};

export function UnsupportedChannelPlaceholder({ channelType }: UnsupportedChannelPlaceholderProps) {
  const channelName = CHANNEL_LABELS[channelType] || channelType;

  return (
    <Card className="border-border bg-card/40">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                Kênh {channelName} đang phát triển
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Giao diện quản lý cấu hình chuyên sâu cho kênh này sắp ra mắt.
              </CardDescription>
            </div>
          </div>
          <Badge
            variant="secondary"
            className="border-primary/20 bg-primary/5 text-primary text-xs font-medium"
          >
            Sắp ra mắt
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-dashed border-border p-6 text-center bg-muted/20">
          <p className="text-sm font-medium text-foreground">
            Tính năng kết nối & điều khiển {channelName} đang được hoàn thiện
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Hệ thống đang tích hợp đồng bộ các API chính thức và đảm bảo tuân thủ nghiêm ngặt chính
            sách bảo mật của nền tảng đối tác. Vui lòng quay lại trong các phiên bản cập nhật tiếp
            theo.
          </p>
        </div>

        <div className="rounded-lg border border-border/80 bg-muted/10 p-4">
          <h4 className="text-xs font-semibold text-foreground mb-2">
            Các kênh trò chuyện đang được hỗ trợ đầy đủ:
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background/60 p-2.5 text-xs">
              <Globe className="size-4 text-success shrink-0" />
              <div className="truncate">
                <p className="font-medium text-foreground">Website Live Chat</p>
                <p className="text-[11px] text-muted-foreground">Widget nhúng trực tiếp</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background/60 p-2.5 text-xs">
              <MessageSquare className="size-4 text-[#1877F2] shrink-0" />
              <div className="truncate">
                <p className="font-medium text-foreground">Facebook Messenger</p>
                <p className="text-[11px] text-muted-foreground">Vệ sĩ bình luận & Fanpage</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background/60 p-2.5 text-xs">
              <Send className="size-4 text-[#229ED9] shrink-0" />
              <div className="truncate">
                <p className="font-medium text-foreground">Telegram Bot</p>
                <p className="text-[11px] text-muted-foreground">BotFather API & Webhook</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
